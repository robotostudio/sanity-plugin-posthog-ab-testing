# ROB-2469 — Extraction inventory: frozen

**Decision in one line:** the plugin package contains the four Studio files (heavily adapted) plus exported *types only*; all eight runtime files become README prompts; the plugin exports **no runtime constants, no runtime helpers, and no validator** — cookie-name agreement is enforced by README structure (one shared `lib/ab-testing.ts` prompt every other prompt imports from), not by package exports.

All line references are to `BabelStreet/sanity-babel-street` @ `1b9a164`.

## The inventory table

| # | Source file | Verdict | Reason |
|---|---|---|---|
| 1 | `sanity/schemas/documents/ab-test.ts` | **plugin** | The core deliverable. Ships adapted: hidden `language` field (lines 12–17) becomes config-driven (ROB-2472 owns i18n coupling); hardcoded `to: [{type: 'page'}]` (line 84) becomes a config option; `lucide-react` icons (line 1) → `@sanity/icons` per ROB-2471. Duplicate-variant validation (lines 54–65), min-2 rule, and both previews ship as-is. |
| 2 | `sanity/components/PostHogExperimentSelect.tsx` | **plugin** | Ships adapted: data source swaps from the SWR hook to the fetcher-backed context; `lucide-react` (line 17) → `@sanity/icons`. The sync-status warning (lines 210–217), ended-experiment critical card (lines 219–231), manual-key fallback (lines 85–97) and refresh button (lines 129–146) all survive — they are the plugin's actual value. |
| 3 | `sanity/components/PostHogVariantKeySelect.tsx` | **plugin** | Ships adapted (same data-source swap). Already-assigned-key disabling (lines 62–70) and the plain-input fallback (lines 43–54) survive as-is. |
| 4 | `sanity/hooks/usePostHogExperiments.ts` | **plugin — types exported, plumbing rewritten, endpoint logic dropped** | See symbol table below. This is the file the ticket flagged; almost none of its lines survive but its *types* become the package's most important export. |
| 5 | `proxy.ts` | **prompt** | Server/edge code, framework-specific — the definition of what "Studio-only" excludes. The A/B core survives into the prompt: `getDistinctId` (101–109), uuidv7 fallback (213–216), `getAllFlags` + per-distinct_id 5-min in-process cache (21–55, 219–238), string-flag extraction (241–246), base64url rewrite to `/test/<flags>/<slug>` (248–268), `ph_bootstrap` cookie writes (261–266, 278–284). Everything else in the file is dropped (see drop list). |
| 6 | `app/(main)/test/[variant]/[...slug]/page.tsx` | **prompt** | Depends on the host's page fetchers, block renderer, metadata and i18n (lines 2–13). The prompt reproduces the load-bearing logic: `React.cache`-wrapped `resolveVariantPage` (75–130), `decodeFlags` (53–60), and critically the control-page-only gate (94–103) that makes direct navigation to a variant URL render normally. Host-specific fetch calls become clearly-marked placeholders; `AB_TEST_BY_SLUG_QUERY` ships in the prompt (its GROQ shape is coupled to host page types and the i18n filter ROB-2472 owns). |
| 7 | `components/ab-test-tracker.tsx` | **prompt** | 39 lines, only dep is `posthog-js`, reproduced near-verbatim. The `$feature_flag_called` exposure event + `register` super-properties (26–35) are the piece that makes PostHog's experiment analysis work — the README must flag it as non-optional. |
| 8 | `components/ab-test-devtools.tsx` | **prompt (optional appendix)** — decided here, wording delegated to ROB-2474 | Keep it. It is the only way to QA an assignment without burning your own bucket: flag override (85–89), clear overrides (91–97), reset identity (99–107). Its only deps are `posthog-js` and the two shared constants — it costs the README one optional section, not the plugin anything. Ship as a clearly-optional, non-production-gated final prompt. One required edit: the override variant `<select>` hardcodes `control`/`test` (321–323) — genericize to free text. Recommendation to ROB-2474: keep the panel's function list 1:1, feel free to shrink the 250 lines of inline styling. |
| 9 | `lib/ab-testing.ts` | **prompt (the shared runtime module)** | 21 lines: `PH_BOOTSTRAP_COOKIE` (12) and `getPostHogCookieName()` (18–20). Reproduced verbatim as the *first* runtime prompt; every other prompt imports from it. **Not** exported by the plugin — see soft-edge ruling 1. |
| 10 | `lib/posthog-server.ts` | **prompt** | `PostHogClient()` factory with the `flushAt: 1, flushInterval: 0` short-lived-function settings (19–23) ships in the prompt. The line-4 re-export of `getPostHogCookieName` is a Babel legacy-import shim — **dropped**; prompts import it from `lib/ab-testing` directly. |
| 11 | `instrumentation-client.ts` | **prompt** | Next.js 15.3+ specific. Reproduced near-verbatim: bootstrap-cookie read (15–27) and `posthog.init({..., bootstrap})` (29–41) are what prevent flicker and client re-evaluation drift (rob2470 research, "Mitigation already in place", line ~560). README states the framework-agnostic contract (cookie name → bootstrap payload shape) in prose before the Next.js code, per rob2470 lesson #12. |
| 12 | `app/api/posthog/experiments/route.ts` | **prompt + shared type (both)** | Server code holding `POSTHOG_PERSONAL_API_KEY` — cannot live in a Studio bundle, and the map marks the host route a *prerequisite of adoption* the README leads with. The mapping block (74–99) is the canonical implementation of the plugin-exported `PostHogExperiment` type: the prompt is written as "return `PostHogExperiment[]` as exported by the plugin", so shape agreement is by named contract. Babel's hardcoded studio-origin CORS allowlist (3–7) becomes an env-driven placeholder. |

## Symbol-level split for file 4 (`usePostHogExperiments.ts`)

| Symbol | Verdict | Reason |
|---|---|---|
| `PostHogVariant` (3–6), `PostHogExperiment` (8–18) | **plugin, exported** | Crosses the boundary in both directions: the fetcher's return type, the route prompt's response contract, and the select components' data shape. `PostHogVariant` must gain `export` (it is currently unexported). Field-name refinement (e.g. status enum shape) belongs to ROB-2472's config-API freeze; *ownership* — plugin exports it — is frozen here. |
| `getExperimentsEndpoint` + `PRODUCTION_API_HOST` / `STAGING_API_HOST` (26–57) | **dropped** | Hardcoded Babel hostnames and a sanity.io appId sniff (line 50). The multi-host problem is exactly what the locked host-supplied-fetcher solves: the host's closure decides its own endpoint. The *lesson* (a studio on `*.sanity.studio` or `www.sanity.io` cannot use a relative URL, so the route needs CORS) survives as README prose next to the route prompt. |
| SWR usage + `fetcher` (1, 20–24, 67–72) | **dropped, replaced** | ROB-2471 locked: drop SWR for `suspend-react` (Studio v6 strict-mode; matches upstream personalization-plugin). Caching/dedupe move to `suspend(fetcher, [workspace, refreshToken])`. |
| The hook's returned surface — `experiments`, `isLoading`, `isError`, `refetch` (74–79) | **plugin, internal** | Survives as an internal context hook fed by the config fetcher. `refetch` survives as a bumpable refresh token (ROB-2470 diverge: upstream freezes the list for the tab's lifetime and caches failures permanently — our refresh button in ExperimentSelect lines 49–56 needs it). Not exported: keep the public API to types + the plugin function, pinned by the exports-snapshot test. |

## Soft-edge rulings

**1. Plugin does NOT export `PH_BOOTSTRAP_COOKIE` / `getPostHogCookieName()`.** Grep-verified: no Studio file references either symbol — they are shared only *among runtime files* (proxy, instrumentation-client, devtools, posthog-server). So "host and Studio agree by construction" buys nothing: the Studio never reads a cookie. Exporting them would make host apps `npm install` a Studio plugin (with `sanity`/`@sanity/ui` peers) into server/edge runtime code — precisely the runtime-package coupling the locked "runtime is documentation" decision exists to avoid. Drift risk is real but internal to the README, and is closed structurally: `lib/ab-testing.ts` is prompt #1 and every other prompt imports from it, so the constants are stated exactly once (consistent with rob2470 lesson #7 — self-contained prompts — applied with one shared module file).

**2. Route response shape: export the type, skip the validator.** Plugin exports `PostHogExperiment`, `PostHogVariant`, and the fetcher/config type (union `experiments: PostHogExperiment[] | (client => Promise<PostHogExperiment[]>)` per ROB-2470's copy list). The route prompt is written against the exported type by name. No exported runtime validator: the plugin instead validates the fetcher result *internally* and surfaces malformed shapes in its own error Card (which ROB-2470 already mandates we own). An exported validator would double the public API for a contract only the plugin itself consumes. Caveat carried forward: the live PostHog `/experiments` JSON was never observed in research (rob2470 open question re `parameters.feature_flag_variants`), so the route prompt's mapping block — not PostHog's raw response — is the frozen contract.

**3. How much of `usePostHogExperiments` survives:** the *interface* (list + loading + error + refetch) survives internally; the *implementation* (SWR, hardcoded endpoint switching) is 100% replaced. See symbol table.

**4. Devtools:** kept, as an optional appendix prompt; final trimming delegated to ROB-2474 with the recommendation above.

## Dropped entirely (nothing replaces them)

- `proxy.ts` locale system: `locales`/`Locale`/`defaultLocale`/`languageNames` (57–66), `assertConfiguredLocale` (72–84), domain/port locale inference (86–96), locale cookie writes — Babel i18n, orthogonal to A/B.
- `proxy.ts` markdown content negotiation (179–200) — Babel's `/api/md` pipeline.
- `proxy.ts` `dedicatedRoutes` denylist contents (134–143) — Babel's route map; the prompt keeps `isAbTestEligible` as a placeholder the host fills in.
- Hook endpoint constants + appId sniffing (33–54) and the SWR dependency.
- `posthog-server.ts` line-4 re-export shim.
- `lucide-react` throughout the Studio files (→ `@sanity/icons`, per ROB-2471).
- Route hardcoded studio-origin allowlist values (→ env-driven placeholder).

## Rejected alternatives

- **Exporting runtime constants/helpers (even under a `./runtime` subpath export):** rejected — creates a package dependency from host runtime → Studio plugin, breaks framework-agnosticism, and reopens the locked no-runtime-package decision through a side door.
- **Exporting a response validator:** rejected — public-API surface for a contract only the plugin consumes; internal validation + owned error UI covers it.
- **Dropping the devtools file:** rejected — highest-leverage 370 lines in the runtime for QA; costs only an optional README section.
- **Exporting the GROQ query / `resolveVariantPage` helpers:** rejected here — both are coupled to host page types and the i18n decision; they ship in prompts. ROB-2472 may still choose to export a query *builder*; that would be an addition, not a reversal of this inventory.


---

## Amendment after adversarial audit (2026-07-30)

**Ruling 2 clarified to stay consistent with ruling 1:** the host-route README prompt does **not** import `PostHogExperiment` from the plugin package (that would pull Studio peers into server code — exactly what ruling 1 forbids). The prompt inlines the type as a local declaration, with a comment naming the plugin export it mirrors. Shape agreement is maintained by the exports-snapshot test and the verification smoke test, not by a shared import.
