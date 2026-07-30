# ROB-2472 — Plugin config API: frozen

**Decision in one line:** one required key (`experiments`, upstream's union shape), five optional keys (`schemaType`, `title`, `pageTypes`, `languageField`, `apiVersion`), everything else fixed by convention — the host may rename the *document type* and pick its *page types*; it may never rename fields, the `control` key, or the stored-JSON/GROQ contract.

All Babel line references are to `BabelStreet/sanity-babel-street` @ `1b9a164`.

## The complete public TypeScript interface

```ts
import type {Plugin, SanityClient} from 'sanity'

/** One variant of a PostHog experiment, as shown in the Studio. */
export type PostHogVariant = {
  /** The feature-flag variant key. Stored verbatim in `variants[].variantKey`. */
  key: string
  /** Optional display label. Falls back to `key` in the UI. */
  label?: string
  /** Display-only. PostHog is authoritative; never stored in Sanity. Chips hidden when absent. */
  rolloutPercentage?: number
}

/**
 * Experiment lifecycle state. Mirrors PostHog's /experiments status filter enum
 * (draft | running | paused | exposure_frozen | stopped | complete), with
 * `stopped` normalised to `complete` — PostHog documents both as "ended".
 * The README route prompt performs that normalisation.
 */
export type PostHogExperimentStatus =
  | 'draft'
  | 'running'
  | 'paused'
  | 'exposure_frozen'
  | 'complete'

/** A PostHog experiment, as returned by the host's fetcher. */
export type PostHogExperiment = {
  /** PostHog experiment id. Used only as a stable list key in the UI. */
  id: number
  name: string
  /**
   * The multivariate feature-flag key backing the experiment. Distinct from `id`;
   * this is what gets stored in `posthogFlagKey` and what the runtime proxy evaluates.
   */
  featureFlagKey: string
  status: PostHogExperimentStatus
  variants: PostHogVariant[]
}

/**
 * Host-supplied experiments source. `client` is the Studio's authenticated
 * client from `useClient({apiVersion})`. Must be re-callable: the plugin
 * invokes it lazily (first time an A/B test document form opens) and again on
 * every press of the "Reload experiments" button. On failure, THROW — do not
 * return []. An empty array means "no experiments exist", not "fetch failed".
 */
export type ExperimentsResolver = (client: SanityClient) => Promise<PostHogExperiment[]>

export interface PostHogAbTestingConfig {
  /**
   * REQUIRED. Static array (demo/test path — no fetch, no Suspense) or async
   * resolver (production path — typically hits the host's server route that
   * holds the PostHog personal API key). Discriminated via Array.isArray().
   */
  experiments: PostHogExperiment[] | ExperimentsResolver

  /**
   * Document type name for the A/B test document. Default: 'posthogAbTest'.
   * Set once, before content exists — renaming later orphans documents and
   * breaks the GROQ in your runtime code. Appears in every runtime prompt's
   * query filter (`_type == "<schemaType>"`).
   */
  schemaType?: string

  /** Display title for the document type. Default: 'A/B Test'. */
  title?: string

  /**
   * Document type name(s) a variant page reference may point to.
   * Default: ['page']. Becomes `to: types.map(t => ({type: t}))` on the
   * `variants[].page` reference field.
   */
  pageTypes?: string[]

  /**
   * i18n opt-in. When set (e.g. 'language'), the schema gains a hidden,
   * read-only string field of that name — compatible with
   * @sanity/document-internationalization — and the README prompts add the
   * `&& <languageField> == $language` GROQ filter line. Default: undefined
   * (no field, no filter; v1 is otherwise locale-unaware).
   */
  languageField?: string

  /** apiVersion for the `useClient` instance passed to the resolver. Default: '2026-07-01'. */
  apiVersion?: string
}

export declare const posthogAbTesting: Plugin<PostHogAbTestingConfig>
```

Public export surface, pinned by the exports-snapshot test (per ROB-2469: types + the plugin function, nothing else): `posthogAbTesting`, `PostHogAbTestingConfig`, `PostHogExperiment`, `PostHogVariant`, `PostHogExperimentStatus`, `ExperimentsResolver`. `definePlugin` name string: `'posthog-ab-testing'` (asserted in the snapshot test — all three upstream plugin name strings are defective, rob2470 DIVERGE #11).

**Every key is honoured, enforced by one unit test per key** asserting an observable schema/behaviour change. This is the direct answer to upstream's 37%-no-op config surface (rob2470, `fieldExperiments.tsx:211-217`).

## Resolutions, one by one

### 1. Document type name — configurable (`schemaType`), default `'posthogAbTest'`

- **Why configurable at all:** collision safety in host studios and workspaces, and the reproduction source itself needs it — Babel uses `'ab-test'` (`sanity/schemas/documents/ab-test.ts:7`), so Babel's own migration to the plugin is `schemaType: 'ab-test'`. A knob whose first user is the canonical source is a knob that earns its keep.
- **Why the default is prefixed:** bare `abTest` is a plausible pre-existing type in any studio; `posthogAbTest` is collision-safe without resorting to dotted namespacing (`posthog.abTest` works in Sanity but produces ugly typegen names and quoting everywhere).
- **Consequence, documented loudly:** every runtime prompt's query hardcodes the default (`*[_type == "posthogAbTest" && enabled == true ...]`, adapted from `sanity/queries/ab-test.ts`); a host that renames must edit one line in the shared query constant. README states "set once, never change after content exists" — upstream's rename knobs cascade into stored JSON, the exact trap rob2470 documents.

### 2. Field names — fixed, not renameable

`name`, `posthogFlagKey`, `enabled`, `variants`, `variants[].variantKey`, `variants[].page` ship exactly as in Babel (`ab-test.ts:18-127`). Rationale: the field names ARE the GROQ contract every README prompt is written against (`AB_TEST_BY_SLUG_QUERY` projects `posthogFlagKey`, `variants[]{variantKey, page->slug.current}`). Upstream's `experimentNameOverride`/`variantNameOverride` make stored JSON a function of config — their worst design decision, and the source of their 3-divergent-detection-paths mess. Fixed names give us one detection path (`_type === schemaType` at the root input) and prompts that are correct as pasted. Also fixed: `enabled` initialValue `false`, `disableNew: true` on the page reference (`ab-test.ts:86` — variant pages should be authored deliberately, not created in a reference modal), min-2 + duplicate-key validation (`ab-test.ts:51-65`), both previews, `@sanity/icons` icons.

### 3. Variant pages reference type — configurable (`pageTypes: string[]`), default `['page']`

The one genuinely unavoidable knob: Babel hardcodes `to: [{type: 'page'}]` (`ab-test.ts:84`) and no generic host is guaranteed a type literally named `page`. Array, not string — the upstream demo's own wiring uses two page types (`to: [{type: 'page'}, {type: 'homePage'}]`, rob2470 backfill). Multiple `pageTypes` make the runtime prompt's `page->slug.current` deref the host's responsibility to keep uniform — README notes that all listed types must carry a `slug` (the prompts' one structural assumption about host pages).

### 4. i18n — one optional knob (`languageField`), default off

- Babel's hidden read-only `language` field (`ab-test.ts:12-17`) exists solely so `@sanity/document-internationalization` can manage the document, and the GROQ filter `language == $language` (`sanity/queries/ab-test.ts`) lives in *runtime* code, not the plugin.
- So the cost of supporting i18n is one hidden field, conditionally emitted — and the cost of *not* supporting it is that no internationalized studio (including Babel) can adopt v1.
- Decision: `languageField?: string`, presence-enables. Mirrors doc-internationalization's own `languageField` option (default there is `'language'`, so the README recipe is `languageField: 'language'`). When unset, v1 is locale-unaware: no field, no filter line in prompts. The README carries a short "Internationalization" recipe showing both halves (plugin config + the one extra GROQ line, marked optional in the shared query prompt).
- Rejected: a richer `i18n: {…}` options bag (nothing else to configure yet — a bag is pre-committed surface), and "v1 doesn't know about locales" (locks out the reproduction source).

### 5. The `'control'` magic key — fixed by convention, not configurable, not exported

`'control'` appears in the variant preview (`ab-test.ts:106`), the badge tone (`PostHogVariantKeySelect.tsx:75`), and load-bearing in the runtime control-page gate (`app/(main)/test/[variant]/[...slug]/page.tsx:95-103`) and fallback resolution (line 112). PostHog itself fixes the first experiment variant's key as `control`; a config knob would be a lie the PostHog side cannot honour. Per ROB-2469 soft-edge ruling 1, the plugin exports no runtime constants — `'control'` is stated once in the shared `lib/ab-testing.ts` prompt (recommend to ROB-2474: add `export const CONTROL_VARIANT_KEY = 'control'` there so every runtime prompt imports rather than restates it). Recommended cheap safety net inside the plugin: a **warning-level** (not error) schema validation that the variants array contains a `'control'` entry — the runtime gate silently never applies the test without one.

### 6. Target route — Babel's page-reference + control-slug model wins; no `targetRoute` field

The target route is **derived**: the control variant's referenced page slug *is* the route the test applies to. No string field. Reasons:

- **No drift by construction.** A string `targetRoute` duplicates information the control reference already carries; rename the page's slug and a string field silently points at nothing, while the derived model follows. The runtime lookup `$slug in variants[].page->slug.current` and the control-page gate need the references anyway.
- **The string model is empirically a dead end.** The upstream demo's `targetRoute` string with exact-equality matching needed a separate hardcoded regex branch for `/blog/:slug`, and only its `/` option worked end-to-end (rob2470 backfill, "Only the `/` targetRoute is actually functional"; `route-experiments.ts` exact `.find()`).
- **Scope coherence.** Page-level-only is locked; a free-string route would permit targeting non-Sanity routes the plugin cannot map variants for.

Documented consequence: only routes backed by a referenced page document can be tested — which is precisely the locked scope. Rejected: string `targetRoute` (drift + dead-end evidence), string + `matchType` (rob2470's own inferred suggestion — solves a pattern-route problem that page-level scope excludes), and shipping both (widest surface, two sources of truth).

### 7. Fetcher signature and semantics — upstream's union, with the six recorded divergences honoured

**Signature:** `experiments: PostHogExperiment[] | ((client: SanityClient) => Promise<PostHogExperiment[]>)`, verbatim in shape from `@sanity/personalization-plugin@3.0.11` (`src/types.ts`), discriminated by `Array.isArray()`. The sole argument is the Studio's authenticated client from `useClient({apiVersion})` — the host's production fetcher is typically `() => fetch('<their server route>')`, and the client argument keeps the dataset-cached option open. No options bag, no AbortSignal (refresh is user-initiated and rare; every extra parameter is API forever — rejected).

**Invocation/caching — the plugin caches, the host does not:**
- **Lazy:** resolved behind the root-input gate, only when a document of `schemaType` is open. No fetch at Studio load, no fetch on unrelated documents (upstream's gate mechanism, our `_type` check).
- **Cached:** `suspend(fetcher, [workspace, refreshToken], {equal})` — suspend-react per ROB-2471, keyed per workspace **plus a bumpable refresh token** (the ROB-2469 frozen surface). One fetch per tab per workspace until refreshed.
- **Re-callable:** refresh bumps the token → fresh suspend key → fetcher runs again. This also fixes upstream's permanently-cached-failure bug: a failed fetch is only cached under the old key, and Retry uses a new one. Contract note in the type's JSDoc: the fetcher must be re-callable and idempotent.
- **No polling.** Fetch on open + explicit refresh only — PostHog's private-API rate limit is 480/min shared across the customer's whole org (rob2470); an interval-polling Studio could rate-limit their entire PostHog account.

**Error contract:**
- **Failure = throw.** The plugin's own error boundary (owned loading/error UI divergence) renders a `tone="critical"` Card with the message + Retry button. Fetchers must not swallow errors into `[]` — upstream's `if (!secret) return []` makes an outage look like "no experiments"; the README says so explicitly.
- **Empty array = legitimate.** Renders the caution Card + manual flag-key text input fallback (survives from `PostHogExperimentSelect.tsx:85-97`), same for `PostHogVariantKeySelect.tsx:43-54`.
- **Malformed result = plugin-internal validation** (ROB-2469 soft-edge ruling 2): non-array, or entries missing `featureFlagKey`/`variants`, surface in the owned error Card naming the offending field. No exported validator.
- **Missing `experiments` config = explicit config-error Card**, not upstream's silent `undefined`.

**Type divergences from Babel's hook (`usePostHogExperiments.ts:3-18`), per the map:** camelCase `featureFlagKey`/`rolloutPercentage` (the plugin type is our contract, not PostHog's snake_case wire format — the README route prompt owns the mapping, exactly as Babel's route already maps `parameters.feature_flag_variants` → its own shape); the 5-state status enum replacing Babel's 3-state one (the critic verified `paused` and `exposure_frozen` are real, common mid-flight states — Babel's UI would show a paused experiment as "Draft"); `rolloutPercentage` optional and display-only (Sanity stores no percentages — verified against the schema); `start_date`/`end_date`/`created_at`/`archived` **dropped** — no Studio component reads them (grep-verified against both selects), the route prompt filters `archived` server-side via the `archived=false` query param, and every field kept in this type is frozen API against a PostHog JSON shape research never directly observed. Smallest true contract wins.

**Status→UI mapping committed here** (extends `ExperimentStatusBadge`, `PostHogExperimentSelect.tsx:20-30, 219-240`): `running` positive; `draft` caution "launch it in PostHog first"; `paused` caution "paused in PostHog — variants are not being served"; `exposure_frozen` positive-with-note (still serving, enrollment frozen); `complete` critical "experiment has ended — disable this A/B test or the winning variant keeps being served".

## What the host is allowed to rename — summary table

| Thing | Verdict |
|---|---|
| Document type name | **Configurable** (`schemaType`, default `posthogAbTest`; set-once warning) |
| Document display title | **Configurable** (`title`, default `A/B Test`) |
| Variant page reference targets | **Configurable** (`pageTypes`, default `['page']`) |
| Language field | **Configurable presence + name** (`languageField`, default absent) |
| Client apiVersion | **Configurable** (`apiVersion`) |
| Field names (`posthogFlagKey`, `enabled`, `variants`, `variantKey`, `page`) | **Fixed** — they are the GROQ contract |
| `'control'` variant key | **Fixed by PostHog convention** — stated once in the shared runtime prompt |
| Target-route modelling | **Fixed** — derived from the control variant's page slug; no field |
| Icons, previews, validation rules, `disableNew`, kill-switch default | **Fixed** |
| Experiment type field names/enum | **Fixed** — exported types are the frozen contract |

## Rejected alternatives (beyond those inline above)

- **`experimentNameOverride`-style field renaming** — upstream's proven trap: stored JSON becomes a function of config, prompts stop being paste-correct.
- **Exporting `CONTROL_VARIANT_KEY` or a query builder from the package** — reopens the no-runtime-exports ruling through a side door; ROB-2469 already ruled the shared-prompt module closes drift.
- **`fetchExperiments` as a separate named config key** — one union key is upstream-compatible, smaller, and makes the demo path (static array) first-class.
- **AbortSignal / options-bag second argument on the resolver** — speculative surface; nothing consumes it.
- **`status` as free `string`** — forfeits the exhaustive badge mapping and the ended-experiment warning, the plugin's core editor value.

## Handoffs / carried caveats (verifiable without Jono)

- **ROB-2474:** add `CONTROL_VARIANT_KEY` to the `lib/ab-testing.ts` shared prompt; route prompt normalises PostHog `stopped` → `complete` and passes `archived=false`; prompts show the `languageField` GROQ line as a clearly-marked optional line.
- **Carried from ROB-2469/2470:** the live PostHog `/experiments` JSON was never observed — the route prompt's mapping block remains the frozen contract, and should be smoke-tested against a real project (one with experiments; the Roboto project had zero) before the README freezes. Same pass can confirm PostHog's experiment UI fixes the `control` key (currently strong-convention evidence, not a live probe).


---

## Amendments after adversarial audit (2026-07-30)

**1. `PostHogExperimentStatus` freeze is conditional — live-JSON smoke test is a BLOCKER, not a caveat.** The 5-state enum was verified against the experiment-list tool's *status query parameter* (rob2470 research, lines 350–351); the actual experiment JSON response was never observed, and the Roboto PostHog project has zero experiments to test against. Until a live `/experiments` response (with at least one running, one paused, one ended experiment) is observed: (a) the enum is frozen as the *target* shape, and (b) the host-route prompt (ROB-2474 prompt 1) must specify an explicit fallback mapping — if the response carries no usable status field, derive status from `start_date` / `end_date` / `archived` exactly as Babel's route does (`app/api/posthog/experiments/route.ts:74–99`). Needs Jono: a PostHog project with real experiments.

**2. Mandated upstream PR re-check — done 2026-07-30.** `sanity-io/plugins` #1226 and #1208 are both still **open, unmerged**. #1226 ports field-level personalization in (renames `FieldPluginConfig` → `ExperimentFieldPluginConfig` with a deprecated alias, adds a parallel `segments: T[] | ((client) => Promise<T[]>)` union) — it *confirms* rather than invalidates the experiments union pattern we copy. #1208 fixes the `personalistaion` plugin-name typos and internal bugs; no public API changes. Nothing in either PR changes this decision. Corrected justification: the exports-snapshot test rationale should cite the name-typo defect as **fixed-in-flight in #1208**, not as a standing upstream property.
