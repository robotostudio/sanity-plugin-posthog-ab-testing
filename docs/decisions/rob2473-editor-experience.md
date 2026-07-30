# ROB-2473 — Editor experience: sync, status warnings, degraded states — decided

**Decision in one line:** keep every Babel behaviour (they are the extraction's value), extend status handling from 3 states to the corrected 5-state enum, add three things Babel never built — an additive-only one-click variant sync, a deleted-experiment warning, and a real unconfigured/first-run state — and make one principle govern every degraded state: **the manual flag-key input is always reachable; the plugin never hard-blocks editing.**

Babel references are to `BabelStreet/sanity-babel-street` @ `1b9a164`. Builds directly on the ROB-2472 frozen config API (5-state `PostHogExperimentStatus`, throw-on-failure fetcher contract, suspend-react + refresh token) and the ROB-2469 inventory.

## Architecture the states hang off

One provider mounts at the root-input gate (`_type === schemaType`), wrapped in the plugin's **own** `<Suspense>` and error boundary — mandatory, not a nicety: rob2470 verified upstream renders neither, so a failing fetcher takes out the whole document form and a thrown suspend promise lands on an unverified Studio boundary. The provider resolves `experiments` (static array bypasses Suspense entirely — the demo path) and exposes `{experiments, refresh}` via context. Both inputs — `PostHogExperimentSelect` on `posthogFlagKey` and `PostHogVariantKeySelect` on `variants[].variantKey` — consume the context. This replaces Babel's SWR request-dedup (`usePostHogExperiments.ts:66-80`) with one fetch per tab per workspace, and deletes the hardcoded endpoint switching (`usePostHogExperiments.ts:33-57`) entirely.

## Behaviour verdicts

### 1. Status badges — KEEP, extended to 5 states
Not derived from `start_date`/`end_date` (both dropped from the type per ROB-2472); the README route prompt maps PostHog's real status enum and normalises `stopped` → `complete`. Babel's 3-state switch (`PostHogExperimentSelect.tsx:20-30`) would render a paused or exposure-frozen experiment — common mid-flight states — as "Draft" via the default arm. Badge mapping:

| Status | Badge | Tone |
|---|---|---|
| `draft` | Draft | default |
| `running` | Running | positive |
| `paused` | Paused | caution |
| `exposure_frozen` | Enrollment frozen | positive |
| `complete` | Ended | critical (Babel used primary/"Complete" — under-sells the footgun) |

The selected-experiment Card tone follows: positive for running/exposure_frozen, caution for draft/paused, critical for complete. Rollout chips (`rollout_percentage`, `PostHogExperimentSelect.tsx:166-207`) kept including the max-rollout highlight, hidden when `rolloutPercentage` is absent (it is optional and display-only in the frozen type). The `— Complete` / `— Draft` suffixes in the `<option>` labels kept and extended to all non-running states.

### 2. Out-of-sync warning — KEEP; one-click sync — ADD, additive-only
Babel's set-equality check (`PostHogExperimentSelect.tsx:60-68`) survives, but the warning gets teeth and precision:

- Copy now splits the divergence: **"Variant pages don't match PostHog. Missing here: {a, b}. Not in the selected experiment: {c}."** Babel's "Expected: {keys}" makes the editor diff two lists in their head.
- **New: an "Add missing variants" button** on that Card. It appends one stub entry per missing PostHog key — `{_key: randomKey(), variantKey: <key>}` with `page` empty — via `useDocumentOperation(documentId, schemaType).patch` (a field input's own `onChange` can only patch its own path; sibling-array mutation needs the document operation). The `Rule.required()` on `page` (`ab-test.ts:88`) then drives the editor to finish each mapping.
- **It never removes or overwrites.** Stale keys (in Sanity, not in PostHog) stay warning-only in the Card. Rationale: the additive half only saves clicks the variant-key dropdown already makes safe; the destructive half would silently delete page references an editor authored, and deletion is exactly where a drifted PostHog list (or a mid-refresh race) does real damage. Rejected: full replace-sync, and rejected doing nothing — the current warning names a problem while offering no state-modifying affordance, and this is the ticket's explicit question.

### 3. Ended-experiment warning — KEEP, verbatim, tone critical
The single most valuable string in the component (`PostHogExperimentSelect.tsx:219-231`): **"This experiment has ended in PostHog. Disable this A/B test in Sanity or the winning variant will keep being served."** Icon becomes `WarningOutlineIcon` from `@sanity/icons` (lucide dropped per ROB-2469). Rejected: a one-click "Disable this test" button on the Card — whether to keep serving the winner during content migration is an editorial judgment, the `enabled` toggle is adjacent in the same form, and the sync button is the only sibling-mutation affordance this input gets.

### 4. Draft warning — KEEP
`PostHogExperimentSelect.tsx:233-240`, caution tone: **"This experiment is still a draft. Launch it in PostHog before enabling this A/B test."** Rejected: enforcing this as document validation — validation rules must stay offline-checkable (they cannot call the host fetcher), so PostHog-status intelligence lives only in the input UI.

### 5. Paused warning — ADD (caution)
**"This experiment is paused in PostHog. Variants are not being served; the control page is shown to everyone. Resume it in PostHog to continue the test."**

### 6. Exposure-frozen note — ADD (muted note, positive badge)
**"Enrollment is frozen in PostHog. Existing participants keep their variant; new visitors are no longer enrolled."**

### 7. Ownership line — KEEP
Shown when running and in sync (`PostHogExperimentSelect.tsx:242-247`): **"Traffic split, targeting, and scheduling are managed in the PostHog dashboard."** It encodes the locked ownership split in the exact place an editor would go looking for a percentage field.

### 8. Manual refresh — KEEP, redesigned
Babel's refetch button with local `isRefreshing` state (`PostHogExperimentSelect.tsx:49-56, 129-146`) becomes a **"Reload experiments"** ghost Button (`RefreshIcon`) that bumps the provider's suspend token — new key, fresh fetch, and the fix for upstream's permanently-cached-failure bug (rob2470: a failed fetch under `[workspace]`-only keying never retries for the tab's lifetime). While refetching, the input simply re-suspends into the shared loading Card; no separate spinner state to manage. **No polling, no focus revalidation** — Babel's SWR 5-minute deduping window goes with SWR; PostHog's private-API limit is 480/min shared across the customer's whole org, and a misbehaving Studio could rate-limit their entire PostHog account.

### 9. Deleted-experiment detection — ADD
Babel's gap: when the stored `posthogFlagKey` matches nothing in the list, `selected` is undefined and the Select silently shows the placeholder while the stored value persists invisibly. New behaviour: inject a disabled `<option>` rendering the stored value as **"{value} (not found in PostHog)"** so the control tells the truth, plus a caution Card: **"`{value}` was not found in PostHog. The experiment may have been deleted or its flag key changed. Reload experiments, pick a replacement, or disable this A/B test."**

### 10. Control-presence warning — KEEP (from ROB-2472), copy fixed here
Warning-level (not error) schema validation on `variants` — offline-checkable, so it is allowed in validation: **"No 'control' variant is mapped. PostHog serves unassigned visitors the control; without a control page this test never applies."** This mirrors the runtime gate (`app/(main)/test/[variant]/[...slug]/page.tsx:95-103`) which silently never applies the test without a control entry.

## Degraded states — the full matrix

Governing principle: **error, empty, and unconfigured are three different states with three different audiences, and the manual `renderDefault` string input appears in all of them.** Babel collapsed error and empty into one caution Card (`PostHogExperimentSelect.tsx:85-97`) — an outage and "no experiments exist yet" got identical copy. Upstream is worse: `if (!secret) return []` plus zero error UI (rob2470). The fetcher contract (throw on failure, `[]` means genuinely none) makes the split possible; the UI must honour it.

**PostHogExperimentSelect (`posthogFlagKey`):**

| State | Rendering |
|---|---|
| Loading / refreshing | Suspense fallback Card, spinner: *"Loading experiments from PostHog…"* |
| Fetcher threw | **critical** Card: *"Couldn't load experiments from PostHog: {error.message}."* + **Retry** button (bumps token) + muted line *"You can paste the feature flag key manually below."* + `renderDefault` |
| Malformed fetcher result | Same critical Card; message names the offending field (plugin-internal validation per ROB-2469, no exported validator) |
| Empty array | **caution** Card: *"No experiments found in PostHog. Create one in PostHog and reload — or paste a feature flag key manually below."* + Reload button + `renderDefault` |
| No `experiments` config | **critical** Card addressed to the developer: *"No experiments source is configured. Pass `experiments` (an array or an async fetcher) to `posthogAbTesting()` in sanity.config — see the README."* + `renderDefault`, so editors keep working while the developer fixes config. Never a silent plain string field. |
| Stored key not in list | Behaviour 9 above |
| Happy path | Select + Reload + selected-experiment Card with badge, flag key, variant chips, and the applicable status/sync messaging |

**PostHogVariantKeySelect (`variants[].variantKey`):** mirrors the provider states. No experiment chosen → `renderDefault` + muted *"Select a PostHog experiment first."* (`PostHogVariantKeySelect.tsx:43-53`, kept). Error/empty/no-match → `renderDefault` manual input (kept). Happy path keeps the already-assigned duplicate guard (`disabled` options, *"— already assigned"*, lines 27-29, 62-70) and the control-aware badge + rollout line (lines 73-82); the badge's `'control'` special-casing stays hardcoded per the ROB-2472 fixed-by-convention ruling.

## Dropped as Babel-specific

- SWR, its dedup window, and focus/interval revalidation (`usePostHogExperiments.ts:1, 66-72`) — replaced by suspend-react + token per ROB-2471/2472.
- The three-way hardcoded endpoint switch with Babel hostnames and app IDs (lines 33-57) — the host's fetcher is the endpoint now.
- `lucide-react` (`TriangleAlert`, `RefreshCw`, schema icons) → `@sanity/icons` per ROB-2469.
- The merged error/empty caution Card — split as above.
- Local `isRefreshing` state — subsumed by re-suspension.

## Rejected alternatives (beyond those inline)

- **Fail louder instead of manual fallback** (the ticket's explicit alternative): rejected. The flag key is always obtainable from the PostHog dashboard; blocking the form on an outage converts a PostHog incident into a CMS incident. Louder is achieved by tone/copy separation, not by removing the escape hatch.
- **Destructive or replace-mode sync**: silently deletes authored page references; drift damage concentrates in deletion.
- **One-click disable from the ended-experiment Card**: editorial judgment call; adjacent toggle already exists.
- **Async document validation against PostHog status** (e.g. block enabling a draft): validation stays offline; UI owns live intelligence.
- **Keeping any polling**: org-wide 480/min rate limit (rob2470).

## Handoffs

- **ROB-2474 (README/prompts):** route prompt must emit `status` per the 5-state enum with `stopped`→`complete` normalisation and `archived=false` — every warning above keys off it; README's degraded-states section should restate the error-vs-empty fetcher contract next to the fetcher recipe.
- **Test plan:** one test per state row in the matrix (the same discipline as ROB-2472's one-test-per-config-key), plus one for the additive sync patch (adds missing, preserves existing, generates `_key`s, removes nothing).
- **Carried caveat:** live smoke test against a PostHog project with a paused and an ended experiment before README freeze — also confirms observed serving behaviour matches the paused/exposure-frozen copy.

---

## Amendment after adversarial audit (2026-07-30)

**Drop-list wording corrected:** Babel's SWR hook already set `revalidateOnFocus: false` and configured no `refreshInterval` (`usePostHogExperiments.ts:70–71`) — its JSDoc misdescribes its own options. What is actually dropped is SWR's request-dedup and 5-minute `dedupingInterval`, replaced by `suspend-react` keying. The no-polling rule is a **new guarantee** the plugin makes, not a removal of Babel behaviour.
