## Answer

Copy the **shape** of `@sanity/personalization-plugin`'s async loader (`experiments: T[] | ((client: SanityClient) => Promise<T[]>)`, resolved once via `suspend-react` behind a root-form-input gate). Diverge on **six specific points** where the upstream implementation is either buggy, silently non-functional, or inadequate for PostHog. Concretely: richer `Experiment` type (PostHog needs `featureFlagKey` + `status`), an explicit refresh path, an error/loading UI of our own, no dead config knobs, no `@sanity/studio-secrets`, one document type instead of N generated object types.

### Provenance (read this first — the repo in the ticket title is dead)

`github.com/sanity-io/sanity-plugin-personalization` is **archived** (GitHub API `archived: true`, `pushed_at 2026-06-18T14:16:52Z`). Its README is one line redirecting to the monorepo. Live source:

```
https://github.com/sanity-io/plugins/tree/main/plugins/@sanity/personalization-plugin
monorepo HEAD 58907794e9924b68210901f8a7d6b0dcf48a2439 (2026-07-30)
npm dist-tags.latest = 3.0.11, published 2026-07-23T08:38:28.387Z
```

Anything sourced from the archived repo is **v2.5.0 — one major version stale**.

---

## 1. The loader signature, verbatim

`src/types.ts` (v3.0.11, re-read from clone — exact, including declaration order):

```ts
export type VariantType = {
  id: string
  label: string
}
export type ExperimentType = {
  id: string
  label: string
  variants: VariantType[]
}
```

The loader is not a standalone type. It is a **union on one config key**:

```ts
experiments: ExperimentType[] | ((client: SanityClient) => Promise<ExperimentType[]>)
```

`SanityClient` is imported `import type {... SanityClient} from 'sanity'`. The single argument is the Studio's authenticated client from `useClient({apiVersion})`. There is **no options bag, no AbortSignal, no cache hint, no second argument**. A zero-arg `async () => [...]` type-checks fine (README Option 2 does exactly that).

Resolved-context type:

```ts
export type ExperimentContextProps = Required<FieldPluginConfig> & {
  experiments: ExperimentType[]
}
```

## 2. The config type, verbatim

`src/types.ts`:

```ts
export type FieldPluginConfig = {
  fields: (string | FieldDefinition)[]
  experiments: ExperimentType[] | ((client: SanityClient) => Promise<ExperimentType[]>)
  apiVersion?: string
  experimentNameOverride?: string
  variantNameOverride?: string
  variantId?: string
  variantArrayName?: string
  experimentId?: string
}
```

Defaults, `src/components/ExperimentContext.tsx:11-19`:

```ts
export const CONFIG_DEFAULT = {
  fields: [],
  apiVersion: '2024-11-07',
  experimentNameOverride: 'experiment',
  variantNameOverride: 'variant',
  variantId: 'variantId',
  variantArrayName: 'variants',
  experimentId: 'experimentId',
}
```

`experiments` has **no** default despite being required at the type level — omit it and you get `undefined` at runtime.

### API trap: 3 of the 8 keys are declared and then ignored

`src/fieldExperiments.tsx:211-217`, verbatim:

```ts
export const fieldLevelExperiments = definePlugin<FieldPluginConfig>((config) => {
  const pluginConfig = {...CONFIG_DEFAULT, ...config}
  const {fields, experimentNameOverride, variantNameOverride} = pluginConfig

  const experimentId = `${experimentNameOverride}Id`
  const variantArrayName = `${variantNameOverride}s`
  const variantId = `${variantNameOverride}Id`
```

The user-supplied `variantId`, `variantArrayName`, `experimentId` are destructured away and never read; derived locals are spread **last** into the provider (`{...pluginConfig, variantId, variantArrayName, experimentId}`) so they always win. **37% of their public config surface is a no-op.** Do not replicate.

## 3. Invocation / caching semantics, verbatim

`src/components/ExperimentContext.tsx:34-52`:

```tsx
const client = useClient({apiVersion: experimentFieldPluginConfig.apiVersion})
const workspace = useWorkspace()

// Fetch or return experiments
const experiments = Array.isArray(experimentFieldPluginConfig.experiments)
  ? experimentFieldPluginConfig.experiments
  : suspend(
      async () => {
        if (typeof experimentFieldPluginConfig.experiments === 'function') {
          return experimentFieldPluginConfig.experiments(client)
        }
        return experimentFieldPluginConfig.experiments
      },
      [workspace],
      {equal},
    )
```

- **Discrimination**: bare `Array.isArray()`, with a redundant `typeof === 'function'` re-check inside the thunk.
- **Cache**: hand-rolled via `suspend-react@^0.1.3` — a module-level `const globalCache = []`. Not SWR, not react-query, no rxjs.
- **Key**: `[workspace]` only, deep-compared with `fast-deep-equal`. Not the document, not the config.
- **No `lifespan` is passed**, so the entry never expires. The fetcher runs **once per workspace per browser tab**, surviving unmount and document navigation. `suspend-react` exports `clear(keys)` and `preload(fn, keys)`; the plugin imports **neither** and exposes no refetch/invalidate.
- **A failed fetch is cached as a permanent error.** `suspend-react` stores rejections and rethrows in render phase. With no lifespan, it never retries — the editor must reload the tab.

**Loading and error UI: there is none.** `grep -rn "Suspense|ErrorBoundary|lifespan|clear("` over `src/` returns zero matches. Loading = a thrown promise handed to whatever Suspense boundary the Studio already has; errors = thrown in render, taking out the whole document form via Sanity's boundary. The only in-plugin state UI is the empty case (`src/components/ExperimentInput.tsx`):

```tsx
if (!experiments.length)
  return (
    <Card padding={[3, 3, 4]} radius={2} shadow={1} tone="caution">
      <Text align="center" size={[2, 2, 3]}>
        There are no defined {props.experimentNameOverride}s
      </Text>
    </Card>
  )
```

Both vendor adapters lean on this: `if (!secret) return []` — a missing credential surfaces as an empty list, not an error.

## 4. Where it mounts, verbatim

`src/fieldExperiments.tsx:227-265` — the gate that stops the fetcher firing on documents with no experiments:

```tsx
return {
  name: 'sanity-personalistaion-plugin-field-level-experiments',
  schema: {
    types: fieldSchemaConfig,
  },
  form: {
    components: {
      input: (props) => {
        const isRootInput = props.id === 'root' && isObjectInputProps(props)

        if (!isRootInput) {
          return props.renderDefault(props)
        }

        const flatFields = flattenSchemaType(props.schemaType)
        const hasExperiment = flatFields.some(
          (field) =>
            field.type.name.startsWith(experimentNameOverride) ||
            field.name.startsWith(experimentNameOverride),
        )

        if (!hasExperiment) {
          return props.renderDefault(props)
        }

        const providerProps = {
          ...props,
          experimentFieldPluginConfig: {
            ...pluginConfig,
            variantId,
            variantArrayName,
            experimentId,
          },
        }
        return ExperimentProvider(providerProps)
      },
    },
  },
}
```

Note `ExperimentProvider(providerProps)` is called as a **plain function, not JSX** — its hooks run in the parent root-input's hook slot, which is why the `suspend()` throw propagates from the root form input. The typo `personalistaion` is in shipped source; both vendor adapters register under the *same* string `'sanity-growthbook-personalistaion-plugin-field-level-experiments'` (`growthbook/index.ts:14`, `launchDarkly/index.ts:13`) — a real name collision.

## 5. What the plugin defines (relevant to our scope)

- **Zero document types.** `grep -rn "type: 'document'" src/` → no hits. It emits exactly two `type: 'object'` types per entry in `fields`: `experiment<Field>` and `variant<Field>`.
- **Page-level A/B is a documentation pattern, not an export.** You pass a `reference` FieldDefinition into `fields:` and hand-author a `routeExperiment` document yourself. Public runtime surface, pinned by inline snapshot in `src/index.test.ts`:

```
{
  ".": {
    "fieldLevelExperiments": "function",
    "flattenSchemaType": "function",
  },
  "./growthbook": {
    "fieldLevelExperiments": "function",
  },
  "./launchDarkly": {
    "fieldLevelExperiments": "function",
  },
}
```

  Published `dist/index.d.ts:226` exports 13 names (types are invisible to the runtime snapshot): `ArrayInputProps, ExperimentContextProps, ExperimentGeneric, ExperimentType, FieldPluginConfig, GrowthbookExperiment, GrowthbookFeature, ObjectFieldWithPath, VariantGeneric, VariantPreviewProps, VariantType, fieldLevelExperiments, flattenSchemaType`. Note `ExperimentContextProps` is exported but `useExperimentContext` is **not** — third parties cannot read resolved context.
- **Hardcoded, no escape hatch**: inner field names `default`, `value`, `active`; the capitalisation scheme; the beaker (`GiSoapExperiment` from `react-icons/gi`) and `CloseIcon` field actions; `flattenSchemaType` maxDepth 5. Only `experimentNameOverride` and `variantNameOverride` are honoured, and renaming cascades into stored JSON and GROQ.
- **`flattenSchemaType` silently degrades** on non-documents (`src/utils/flattenSchemaType.ts:9-12`):

```ts
if (!isDocumentSchemaType(schemaType)) {
  console.error(`Schema type is not a document`)
  return []
}
```
  It logs and returns `[]`, which makes `hasExperiment` false and no-ops the plugin. No throw.

## 6. Dependency + build posture (the template for our package.json)

Published `3.0.11` manifest (verified live against `registry.npmjs.org`):

```json
"type": "module",
"types": "./dist/index.d.ts",
"exports": {
  ".": "./dist/index.js",
  "./growthbook": "./dist/growthbook/index.js",
  "./launchDarkly": "./dist/launchDarkly/index.js",
  "./package.json": "./package.json"
},
"dependencies": {
  "@sanity/ui": "^3.4.3",
  "react-icons": "^5.7.0",
  "@sanity/uuid": "^3.0.3",
  "@sanity/icons": "^5.2.0",
  "suspend-react": "^0.1.3",
  "fast-deep-equal": "^3.1.3",
  "@sanity/studio-secrets": "^4.0.14"
},
"peerDependencies": {
  "react": "^19.2",
  "sanity": "^5 || ^6.0.0-0",
  "react-dom": "^19.2"
},
"engines": {"node": ">=20.19 <22 || >=22.12"}
```

`"files": ["dist"]` IS declared in source — npm strips it from registry metadata, so its absence there is not evidence. `@sanity/ui` and `@sanity/icons` are **direct deps, not peers** — that is the current Sanity-official posture. ESM-only: the 3.0.11 tarball is exactly `dist/index.js`, `dist/growthbook/index.js`, `dist/launchDarkly/index.js`, `dist/fieldExperiments-DVb0HN3p.js` + `.d.ts`/`.map`. Zero `.cjs`, zero `.mjs`.

Build config is the entire file `tsdown.config.ts`:

```ts
import {defineConfig} from '@sanity/tsdown-config'
import type {UserConfig} from 'tsdown'

export default defineConfig({
  entry: ['./src/index.ts', './src/launchDarkly/index.ts', './src/growthbook/index.ts'],
  reactCompiler: true,
}) satisfies Promise<UserConfig>
```

`tsconfig.json`: `{"extends": ["@sanity/tsconfig/strictest"], "include": ["**/*.ts", "**/*.tsx"], "exclude": ["dist", "node_modules"]}`. Scripts: `{"build": "tsdown", "prepack": "turbo run build"}`. `@sanity/pkg-utils` + `package.config.ts` (dual CJS/ESM, v2.5.0) is **gone**.

`CHANGELOG.md` 3.0.0 Major Changes (PR #971), verbatim bullets: *React Compiler enabled*; *ESM-only: CommonJS support has been removed*; *React 19.2+ required*; *react-dom 19.2+ required*; *Sanity Studio v5+ required (Sanity v3 and v4 are no longer supported)*; *Node.js 20.19+ required*; *Sanity v2 compatibility shim removed*.

Studio v6 is GA — `npm dist-tags` for `sanity`: `latest = 6.7.0` (2026-07-28), `stable = 6.6.0`, `next = 6.8.0-next.30`, `maintenance-v5 = 5.31.1`.

---

## COPY

1. **The union config key.** `experiments: T[] | ((client) => Promise<T[]>)`. Array form is what makes the plugin testable and demoable without any PostHog account; the function form is the escape hatch. One key, two shapes, `Array.isArray()` discrimination.
2. **Pass the Studio's authenticated `SanityClient` as the fetcher argument.** It lets a host implement the fetcher as `client.fetch(...)` against a dataset-cached experiment list, or as a call to their own server route — which is exactly our locked "no client-side personal API key" story.
3. **The root-form-input gate.** `props.id === 'root' && isObjectInputProps(props)` → detect → early `renderDefault` → only then mount the provider. This is the mechanism that stops the fetcher firing on unrelated documents; without it every document open hits PostHog.
4. **`suspend-react` over react-query/SWR.** ~1KB, no provider setup, integrates with the Studio's existing Suspense boundary. Keep it.
5. **The exports snapshot test.** `vitest-package-exports` + `getPackageExportsManifest({importMode: 'dist', ...})` and an inline snapshot. Cheap tripwire against accidental public-API changes on a package that is public API forever.
6. **Package posture wholesale**: `"type": "module"`, ESM-only, `"files": ["dist"]`, `tsdown` + `@sanity/tsdown-config`, `@sanity/tsconfig/strictest`, `@sanity/ui` as a direct dep, `peerDependencies: {"react": "^19.2", "react-dom": "^19.2", "sanity": "^5 || ^6.0.0-0"}`, `engines.node ">=20.19 <22 || >=22.12"`. Sanity has abandoned Studio v3/v4 support; matching them is the low-friction choice.
7. **README spine**: Install → When to use (table) → Studio Usage → Loading Experiments (options) → Shape of stored data → Querying (GROQ) → Runtime → Advanced → License/Develop. It works. Also copy the in-Studio screenshots-plus-tips walkthrough (`overview.gif`, `field-experiment.png`, `page-experiment.png` + inline beaker-icon tips) — for a Studio-only plugin that is the most transferable part of their doc design.

## DIVERGE

1. **Do not publish config knobs you don't honour.** Their `variantId` / `variantArrayName` / `experimentId` are declared and silently overwritten. Every key in our config type must be read. Add a unit test asserting each key changes observable output.
2. **`ExperimentType` must be richer.** `{id, label, variants: [{id, label}]}` cannot represent PostHog. PostHog experiments are backed by a **multivariate feature flag**, so the flag key is a distinct identity from the experiment id — upstream would force you to smuggle it into `id`. We also need lifecycle state (draft/running/complete/archived) so editors don't attach a page variant to a finished experiment. Proposed (recommendation, not prior art):

   ```ts
   export type PostHogVariant = {
     key: string          // the flag variant key, must match what the proxy reads
     label?: string
     rolloutPercentage?: number
   }
   export type PostHogExperiment = {
     id: string           // PostHog experiment id
     name: string
     featureFlagKey: string   // NOT derivable from id — the proxy keys off this
     status: 'draft' | 'running' | 'complete' | 'archived'
     variants: PostHogVariant[]
   }
   ```
   Because `flagKey`/`status` are Studio-visible, we get the status Badge and "this experiment has ended" affordance upstream has no precedent for (their `VariantPreview` renders status nowhere — title/subtitle only).
3. **Ship a refresh path.** Their cache key is `[workspace]` with no `lifespan`, so the list is frozen for the tab's lifetime and a failed fetch is cached as a permanent error with no retry. Minimum: `suspend(fetcher, [workspace, refreshToken], {equal})` with a bumpable token behind a visible "Reload experiments" button, or `clear([workspace, token])` from `suspend-react`. PostHog experiment lists change mid-editing-session far more than a GrowthBook flag list does.
4. **Own the loading and error UI.** Upstream renders no `<Suspense>` and no error boundary — a failing fetcher takes out the whole document form and never retries. We wrap our provider in our own boundary and render a `tone="critical"` Card with the error message plus the retry button from (3). Their `tone="caution"` empty-state Card is the right pattern for zero experiments; keep that.
5. **One document type, not N generated object types.** Page-level-only means we do not need their `fields: (string | FieldDefinition)[]` × 2-object-types-per-entry generator, nor the `default`/`value`/`active`/capitalisation machinery. A single `pageExperiment` (or similarly named) document type with `flagKey`, `status`, `targetRoute`, and a variants array of `{variantKey, page: reference}` is a smaller public API and a smaller GROQ contract. Consequence: our root-input detection is a document-`_type` check, not `flattenSchemaType` prefix matching — one detection path, no maxDepth-5 recursion, no silent `return []` degradation. (Upstream has **three** divergent detection rules: base checks `field.type.name.startsWith(x) || field.name.startsWith(x)`; GrowthBook checks only `.startsWith('experiment')` on type names; LaunchDarkly only `.startsWith('flag')`.)
6. **No `@sanity/studio-secrets`, and say so loudly in the README.** Their vendor adapters are exactly the pattern ROB-2468 ruled out — `*[_id == 'secrets.growthbook'][0].secrets.apiKey` fetched in the browser, then `fetch(url, {headers: {Authorization: \`Bearer ${secret}\`}})` straight to the vendor API. Note `@sanity/studio-secrets` is a hard dependency of the **base** package, so it ships to everyone regardless. We drop it entirely (and `react-icons`, which upstream pulls in whole for one beaker icon — use `@sanity/icons` deep imports). Readers arriving from that plugin will *expect* the key-prompt flow, so add a short "prior art we rejected, and why" note.
7. **Runtime prompts must be self-contained.** Their README's own quality bar exists but is inconsistent: the split-testing `proxy.ts` block (lines 686-748, 61 lines) has a filename comment, all imports, the query constant, cookie handling, and `export const config = {matcher: [...]}` — paste-and-run. The Step 4 proxy (lines 388-415) says `// proxy.ts` but uses an unimported `client` and a `ROUTE_EXPERIMENT_QUERY` defined three sections earlier. Every prompt we ship must restate its file path, its imports, its query constants and its install line.
8. **Add the "What this plugin does NOT do" section they never wrote.** Their README has no Limitations/Out-of-scope heading at all; refusals are implicit (delegation, a demo repo, unimplemented stubs). Ours states up front: Studio-only, page-level only, no field-level, no stats engine, no analytics dashboard, no exposure tracking inside the plugin.
9. **State the framework-agnostic contract before the Next.js code.** Every runtime example upstream is Next.js App Router, unlabelled, with one parenthetical "(e.g., Next.js proxy)" as the entire concession. Write the contract once — cookie name, deterministic hash, rewrite target, exposure event, distinct_id reconciliation — then show Next.js as one implementation.
10. **Don't fork near-duplicate vendor docs.** `growthbook.md` and `launchdarkly.md` are ~90% identical and have already drifted: `launchdarkly.md:35-50` imports `{fieldLevelExperiments}` then calls `launchDarklyFieldLevel({...})` (ReferenceError on paste); `growthbook.md:46` documents a `projectId` key when the type field is `project`; both still claim `> This is a **Sanity Studio v3** plugin.` on a package that requires v5+. One README, PostHog-specific.
11. **Pick one plugin name and test it.** All three of their registered names are defective (base has a `personalistaion` typo; both vendor adapters register the *same* string). Assert ours in the exports snapshot test.

### Upstream bugs — do not copy verbatim if you crib code

- `src/components/ExperimentInput.tsx:37`: `useDocumentOperation(getPublishedId(id), props.schemaType.name)` — on a `type: 'string'` field this passes `'string'` where the **document** type is expected. Latent bug (inferred from schema wiring; not observed at runtime).
- `src/components/ExperimentItem.tsx`: ungated `props.inputProps.onChange(set(true, ['active']))` during render, firing on every render where `active` is falsy. A setState-during-render pattern in a package built with React Compiler enabled.
- `src/fieldExperiments.tsx` experiment preview: `const title = base?.title || base?.name || typeof base === 'string' ? base : ''` — `||` binds tighter than `?:`, so `title` is the whole `base` object whenever base is truthy.
- `src/launchDarkly/utils.ts`: `const offset = 0` declared `const` inside a `while (hasMore)` pagination loop, never incremented.


=== RECOMMENDATIONS ===
- Target the v3.0.11 posture exactly: ESM-only, "type": "module", "files": ["dist"], tsdown + @sanity/tsdown-config with reactCompiler: true, @sanity/tsconfig/strictest, peerDependencies {react: ^19.2, react-dom: ^19.2, sanity: ^5 || ^6.0.0-0}, engines.node ">=20.19 <22 || >=22.12". Do not attempt Studio v3/v4 support — Sanity themselves dropped it in 3.0.0.
- Adopt the union config key verbatim in shape: `experiments: PostHogExperiment[] | ((client: SanityClient) => Promise<PostHogExperiment[]>)`, passing the Studio's authenticated client from useClient({apiVersion}) as the sole argument. The array form is our test/demo path, the function form is the host's server-route escape hatch.
- Extend the experiment type beyond upstream's {id, label, variants:[{id,label}]} to carry featureFlagKey (distinct from experiment id — PostHog experiments are backed by a multivariate flag) and status ('draft'|'running'|'complete'|'archived'), plus optional rolloutPercentage per variant. Surface status as a Badge in the input; upstream renders status nowhere.
- Keep suspend-react as the cache, but key it [workspace, refreshToken] and ship a visible 'Reload experiments' button. Upstream's [workspace]-only key with no lifespan freezes the list for the tab lifetime AND caches a failed fetch as a permanent, never-retried error.
- Wrap our provider in our own error boundary rendering a tone="critical" Card + retry. Upstream renders no Suspense and no boundary, so a failing fetcher takes out the entire document form.
- Every key in our config type must be read by the implementation, enforced by a unit test per key. Upstream declares variantId/variantArrayName/experimentId and silently overwrites all three (src/fieldExperiments.tsx:214-216) — 37% of their public config is a no-op.
- Define one page-experiment DOCUMENT type rather than upstream's N-generated-object-types-per-field generator. Consequence: detection becomes a document _type check, replacing flattenSchemaType prefix matching (which has maxDepth 5 and silently returns [] on non-documents), giving us exactly one detection path where upstream has three divergent ones.
- Drop @sanity/studio-secrets and react-icons entirely; use @sanity/icons deep imports (v3 style: import {CloseIcon} from '@sanity/icons/Close'). Add a README note naming the studio-secrets browser-side-API-key flow as prior art we deliberately rejected, since readers arriving from that plugin will expect it.
- Add the exports snapshot test (vitest-package-exports, importMode: 'dist', toMatchInlineSnapshot) on day one, and include the plugin name string in what it pins — all three upstream plugin names are defective (base typo 'personalistaion'; GrowthBook and LaunchDarkly register the identical string).
- README: keep their spine (Install / When to use table / Usage / Loading Experiments / Stored data / GROQ / Runtime / Advanced) plus their screenshot-and-tip Studio walkthrough, but add the 'What this plugin does NOT do' section they never wrote, state the framework-agnostic runtime contract before any Next.js code, and make every runtime prompt self-contained (file path, imports, query constants, install line) to the standard of their split-testing proxy.ts block — not their Step 4 fragment.
- If cribbing implementation code, avoid four confirmed upstream defects: ExperimentInput.tsx:37 passes props.schemaType.name to useDocumentOperation where a document type is expected; ExperimentItem.tsx does an ungated onChange during render (hostile to React Compiler); the experiment preview's title expression has an || vs ?: precedence bug; launchDarkly/utils.ts declares `const offset = 0` inside its pagination loop.

=== OPEN QUESTIONS ===
- PostHog-side specifics were NOT verified against posthog.com in this ticket's research: the exposure event name ($feature_flag_called), the /api/projects/:id/experiments endpoint shape, holdout semantics, us/eu host handling, and how server-side assignment reconciles distinct_id with posthog-js. All of that is training-knowledge and needs its own primary-source pass before the fetcher contract is frozen.
- Whether any unreleased page-level-specific API exists in a branch or open PR on sanity-io/plugins. Both researchers used shallow/single-branch clones, so 'only origin/main exists' is a clone-flag artifact, not evidence. Remote branches and open PRs were never enumerated.
- What @sanity/tsdown-config@^0.21.2 actually emits — chunking strategy, .d.ts generation, whether it injects per-export "types" conditions. The published 3.0.11 manifest has a top-level "types" and no per-export types condition, which may or may not be what we want. Package source not read.
- The demo repo github.com/demo-repositories/personalization-plugin-example (exists, HTTP 200; linked from README line 9) was never cloned. It is where the upstream README offloads all assembled runtime code, so it is the highest-value remaining source for the runtime-half prompts we are shipping as documentation.
- No Studio was run and no screenshots/gif were inspected. All editor-UX description is read off component source, including the claim that the suspend() throw lands on Sanity's own Suspense boundary — that specific behaviour is inferred, not observed.
- Whether our page-level document type should model the target route as a string path, a reference to a route document, or both. Upstream documents two mutually incompatible page-level patterns (routeExperiment with a reference field, vs routing with a custom `path` string type and imurmurhash bucketing) and picks neither as canonical.

=== CRITIC GAPS ===
- Nobody decided WHO assigns the variant: our own hash in the proxy, or PostHog's flag evaluation. The resolution's DIVERGE #9 says the contract includes a "deterministic hash", which silently picks self-assignment — the most consequential unexamined decision in the whole ticket. :: Self-assignment breaks PostHog's experiment analysis. Rollout percentages, release conditions, holdouts and persistence-across-auth all live inside PostHog's flag; a local murmur hash ignores every one of them. PostHog's own troubleshooting doc (posthog.com/docs/experiments/troubleshooting) states that PostHog "only counts users whose exposure event has a valid variant" and that users whose variant was decided before the flag could be evaluated "are silently dropped from the experiment... your results are skewed, not just smaller." The canonical demo I cloned does exactly the broken thing: apps/web/src/lib/experiments.ts computes ONE global userGroup as `MurmurHash3(userId).result() % EXPERIMENT_VARIANTS.length` over a hardcoded 4-element list, stores it in a single `ab-test` cookie, and reuses that same bucket for EVERY experiment on the site. Its own 2-variant `blog-title` experiment therefore sends ~50% of users to variant-b/variant-c, which do not exist, so `getExperimentValue` returns `variant: undefined` and they collapse to control. This is both statistically invalid (correlated assignment across experiments) and a live bug in the reference we would be cribbing from. The choice also feeds back into the Studio type: `rolloutPercentage` is authoritative if PostHog assigns, but display-only decoration if we hash.
- It was never verified that PostHog exposes experiment metadata to any credential other than a personal API key. The locked "host-supplied async fetcher" decision was designed around this constraint but the constraint itself was never confirmed. :: PostHog issue posthog-js#3593, "Feature Request: Expose experiment metadata in SDKs" (open), describes our exact use case and states the alternatives are: "Using the existing /experiments API: This works but requires a personal API key, which is difficult to manage securely in serverless environments (like Vercel Edge). Storing experiments manually in the CMS: This adds duplication, potential drift between PostHog and the CMS. Relying solely on feature flags via the SDK: Doesn't give us enough metadata to power a good CMS experience or preview environment for marketers and content teams." So there is confirmed to be NO project-token or SDK path to an experiment list — the host cannot implement the fetcher with anything they already ship to the browser. That makes "stand up a server route holding a personal API key" a hard prerequisite of using the plugin at all, not an optional advanced topic, and it is the single biggest adoption friction. The README currently plans to present the fetcher as a simple config callback.
- The demo repo github.com/demo-repositories/personalization-plugin-example was still never cloned. I cloned it; it contains the canonical page-level implementation, and it contradicts DIVERGE #5 and answers open question #6 outright. :: This is the highest-value source in the ticket and it flatly changes two decisions. (1) Open question #6 is answered: apps/studio/schemaTypes/documents/route-experiment.ts models the target as a STRING path — `targetRoute` with `options.list` of `/` and `/blog` — matched by exact equality in apps/web/src/lib/route-experiments.ts (`experiments.find((exp) => exp.targetRoute === pathname)`). Not a reference. It also carries an `isActive` boolean the resolution's proposed doc type omits. (2) DIVERGE #5 ("one document type, not N generated object types") is contradicted by the canonical pattern: the `routeExperiment` document's `page` field is `type: "experimentPage"` — i.e. the plugin-GENERATED object type — so page-level experiments are built ON TOP of the field-level generator, not instead of it. Dropping the generated object type is still defensible, but it means abandoning the only worked GROQ contract that exists (the ROUTE_EXPERIMENTS_QUERY projecting `page{experimentId, default{...}, variants[]{variantId, value->}}`), and the resolution treats this divergence as obvious rather than as a real tradeoff. (3) Most importantly, apps/studio/utils/experiments.ts — the file the studio config passes as `experiments:` — is named `experimentsFromStatsig` but is a HARDCODED STATIC ARRAY with a comment saying "This is intentionally a local/static list for now. When you're ready to connect to a 3rd party, replace this export with an async loader." There is no working async-fetcher example anywhere in the upstream ecosystem. COPY #2 treats the fetcher as a proven pattern; it is an untested one.
- Two open upstream PRs were never enumerated (declared as open question #2 but left open). Both are open right now and they invalidate quoted-verbatim source plus roughly a third of the DIVERGE list. :: PR #1226 "feat(personalization): add field-level personalization" (stipsan, opened 2026-06-18) RENAMES the type the resolution quotes as authoritative: `FieldPluginConfig` becomes `ExperimentFieldPluginConfig`, `ExperimentContextProps` becomes `Required<ExperimentFieldPluginConfig>`, all components move from src/components/*.tsx into src/components/experiment/, and a parallel `fieldLevelPersonalization` plugin plus `PersonalizationFieldPluginConfig` and `segments:` loader are added. PR #1208 "fix(personalization-plugin): address review feedback from #971" fixes ALL FOUR bugs in the resolution's "upstream bugs — do not copy" list (LaunchDarkly `const offset` pagination, the `||`-vs-ternary preview title, the ExperimentItem render-phase `onChange` moved into a guarded useEffect, plus a VariantPreview optional-chaining fix) AND fixes the `personalistaion` typo and the LaunchDarkly/GrowthBook plugin-name collision (which is the entire basis of DIVERGE #11) AND rewrites growthbook.md/launchdarkly.md (the basis of DIVERGE #10). Neither is merged as of 2026-07-30, and neither is in the published 3.0.11 — so the resolution's facts are true of the shipped artifact but the surrounding argument ("upstream is buggy, therefore diverge") is aimed at code that is already fixed in flight.
- The proposed PostHog status enum is wrong. DIVERGE #2 specifies `status: 'draft' | 'running' | 'complete' | 'archived'`. :: Verified live against the PostHog API via the experiment-list tool schema, whose documented status enum is: "draft" (not yet launched), "running" (launched, flag active), "paused" (launched, flag deactivated — mutually exclusive with running), "exposure_frozen" (launched, enrollment frozen to the already-exposed cohort while metrics keep flowing), "stopped" or "complete" (both mean ended). `archived` is a SEPARATE boolean filter parameter, not a status value. So the proposal omits `paused` and `exposure_frozen` entirely and mis-models `archived` as a status. This is a public API type on a package that is public API forever, and it is the exact field DIVERGE #2 says earns us the status Badge and the "this experiment has ended" affordance — an editor would see no badge, or a crash, for a paused or exposure-frozen experiment, which are common mid-flight states.
- The actual JSON shape of a PostHog experiment object was never observed, and I could not observe it either — the connected PostHog project (Roboto Studio / Website, id 203176) contains ZERO experiments, and docs-search returned prose, not the REST response schema. :: The entire fetcher contract and the `PostHogExperiment` type hang on field names that remain unverified. In particular DIVERGE #2 asserts `featureFlagKey` as a top-level field distinct from `id`. PostHog's REST API is snake_case, so it is very likely `feature_flag_key` or a nested `feature_flag` object, and the variant list is most likely under `parameters.feature_flag_variants[]` with `{key, rollout_percentage}` rather than a top-level `variants` array. The docs confirm only the concept ("Each experiment is backed by a feature flag... you use this feature flag key to check which experiment variant the user has been assigned to"), not the serialization. If the mapping is wrong, every README example fetcher is wrong on day one.
- No dev/test harness and no plugin-distribution requirements. A Sanity plugin author would ask both immediately. :: The resolution specifies build tooling (tsdown, @sanity/tsconfig/strictest), package exports and an exports-snapshot test, but nothing about how anyone actually runs the plugin in a Studio during development — yet Sanity's own monorepo has exactly that pattern, visible in PR #1226's file list as `dev/test-studio/src/personalization/index.tsx`, where each plugin gets a registered workspace in a shared test studio. Without an equivalent, every UI claim stays inferred (which is precisely why open question #5 exists — no Studio was ever run, and the load-bearing claim that the `suspend()` throw lands on Sanity's own Suspense boundary is unobserved). That claim is what COPY #4 rests on; if the Studio has no boundary at that position, a slow fetcher blanks the document form instead of showing a spinner, and DIVERGE #4 (own the loading/error UI) becomes mandatory rather than a nicety. Separately, nothing covers discoverability: the `sanity-plugin` npm keyword and the plugin marketplace listing requirements are what get an open-source plugin found at all, and they are the whole point of publishing publicly.

=== BACKFILL ===

## Nobody decided WHO assigns the variant: our own hash in the proxy, or PostHog's flag evaluation. The resolution's DIVERGE #9 says the contract includes a "deterministic hash", which silently picks self-assignment — the most consequential unexamined decision in the whole ticket.
- [verified-primary] The real Babel Street production implementation already chose Option A (PostHog assigns). There is no hash anywhere in the repo — the proxy calls posthog-node and rewrites to the returned variant.
  /Users/jono/dev/babel/sanity-babel-street/proxy.ts lines 219-255, verbatim:

```ts
	// --- PostHog: evaluate feature flags (with cache) ---
	let flags: Record<string, string | boolean> = {};

	// Check cache first
	const cached = getCachedFlags(distinctId);
	if (cached) {
		flags = cached;
	} else {
		const posthog = PostHogClient();
		if (posthog) {
			try {
				flags = await posthog.getAllFlags(distinctId);
				setCachedFlags(distinctId, flags);
			} catch {
				// Flag evaluation failed — proceed without A/B testing
			} finally {
				await posthog.shutdown();
			}
		}
	}

	// Extract experiment flags (multivariate flags return variant strings)
	const experimentFlags: Record<string, string> = {};
	for (const [key, value] of Object.entries(flags)) {
		if (typeof value === 'string') {
			experimentFlags[key] = value;
		}
	}

	// --- A/B test rewrite ---
	if (Object.keys(experimentFlags)
- [verified-primary] DIVERGE #9's 'deterministic hash' contradicts the reference implementation. Copying the demo's murmur hash would be a regression away from what Babel Street actually shipped.
  The murmur hash lives only in the @sanity/personalization-plugin demo monorepo, not in Babel Street. Confirmed verbatim at scratchpad/demorepo/apps/web/src/lib/experiments.ts:

```ts
export const EXPERIMENT_VARIANTS = [
  "control",
  "variant-a",
  "variant-b",
  "variant-c",
] as const;
...
    const hash = MurmurHash3(userId).result();
    const variantIndex = Math.abs(hash) % EXPERIMENT_VARIANTS.length;
    const userGroup = EXPERIMENT_VARIANTS[variantIndex];
...
    response.cookies.set("ab-test", JSON.stringify({ userGroup, userId }), {
```

The bug described in the gap is confirmed: one global `userGroup` in one `ab-test` cookie, reused for every experiment, while the demo's own `blog-title` experiment declares only `[control, variant-a]`, so `getExperimentValue` returns `{variant: undefined}` for the ~50% of users bucketed to variant-b/variant-c.
- [verified-primary] The A-vs-B tradeoff as framed is a false dichotomy: PostHog's exact bucketing algorithm is a pure local SHA-1 computation, published in posthog-node source, and is already available as in-process local evaluation with zero per-request network call.
  posthog-node 5.46.1, src/extensions/feature-flags/feature-flags.ts, verbatim:

```ts
const LONG_SCALE = 0xfffffffffffffff
...
// # This function takes a bucketing identifier and a feature flag key and returns a float between 0 and 1.
// # Given the same bucketing identifier and key, it'll always return the same float. These floats are
// # uniformly distributed between 0 and 1, so if we want to show this feature to 20% of traffic
// # we can do _hash(key, bucketing_identifier) < 0.2
async function _hash(key: string, bucketingValue: string, salt: string = ''): Promise<number> {
  const hashString = await hashSHA1(`${key}.${bucketingValue}${salt}`)
  return parseInt(hashString.slice(0, 15), 16) / LONG_SCALE
}
```

Rollout gate (same file):
```ts
    if (rolloutPercentage != undefined && (await _hash(flag.key, bucketingValue)) > rolloutPercentage / 100.0) {
      return 'out_of_rollout_boun
- [verified-primary] posthog-node local evaluation is the 'Option A semantics at Option B latency' path. It needs a server-side secretKey and polls flag definitions; it is enabled by default when secretKey is set.
  posthog-node 5.46.1 src/types.ts verbatim:

```ts
  /**
   * Credential that enables local feature flag evaluation and remote config.
   *
   * Accepts either a Personal API Key (`phx_...`) or a Project Secret API Key (`phs_...`).
   * When provided, the client can evaluate feature flags locally and decrypt remote
   * config payloads via `getRemoteConfigPayload`. Prefer this over the deprecated
   * `personalApiKey` option; when both are set, `secretKey` takes precedence.
   */
  secretKey?: string
  /**
   * @deprecated Use `secretKey` instead.
   */
  personalApiKey?: string
...
  // The interval in milliseconds between polls for refreshing feature flag definitions. Defaults to 30 seconds.
  featureFlagsPollingInterval?: number
...
  // Whether to enable feature flag polling for local evaluation by default. Defaults to true when secretKey is provided.
  enableLocalEvaluation?: boolean
- [verified-primary] 'Persistence across auth' (PostHog's ensure_experience_continuity) is explicitly INCOMPATIBLE with local evaluation — it forces a remote call per evaluation.
  posthog-node 5.46.1 src/extensions/feature-flags/feature-flags.ts verbatim:

```ts
    if (flag.ensure_experience_continuity) {
      throw new InconclusiveMatchError('Flag has experience continuity enabled')
    }
```

and the warning emitted by the poller:
```ts
      console.warn(
        `[PostHog] You are using local evaluation but ${experienceContinuityFlags.length} flag(s) have experience ` +
          `continuity enabled: ${experienceContinuityFlags.map((f) => f.key).join(', ')}. ` +
          `Experience continuity is incompatible with local evaluation and will cause a server request on every ` +
          `flag evaluation, negating local evaluation cost savings. ` +
          `To avoid server requests and unexpected costs, either disable experience continuity on these flags ` +
          `in PostHog, use strictLocalEvaluation: true in client init, or pass onlyEvaluateLocally: t
- [verified-primary] `getFeatureFlag` — the method Option A in the gap description names — is deprecated in current posthog-node. The runtime prompt must use `evaluateFlags` + `flags.getFlag(key)`.
  posthog-node 5.46.1 src/client.ts, verbatim JSDoc on getFeatureFlag:

```
   * @deprecated Use {@link evaluateFlags} and call `flags.getFlag(key)` on the returned snapshot.
   *   This consolidates flag evaluation into a single `/flags` request per incoming request and
   *   avoids drift between the values your code branched on and the values attached to events.
   *   Will be removed in the next major version.
```

and the runtime warning it emits:
```ts
    emitDeprecationWarningOnce(
      'getFeatureFlag',
      '`getFeatureFlag` is deprecated and will be removed in a future major version. ' +
        'Use `posthog.evaluateFlags(distinctId, ...)` and call `flags.getFlag(key)` instead — ' +
        'this consolidates flag evaluation into a single `/flags` request per incoming request.'
    )
```

Recommended shape, verbatim from the evaluateFlags JSDoc:
```ts
 * const flags = await c
- [verified-primary] `getAllFlags` (what Babel Street uses) fires NO exposure event. `evaluateFlags(...).getFlag(key)` fires one automatically, with a complete, correct property payload including `$feature/<key>`.
  getAllFlags delegates straight to getAllFlagsAndPayloads and never touches the capture path (src/client.ts:1668-1684) — verified by tracing `_captureFlagCalledEventIfNeeded`, which is called only from `_getFeatureFlagResult` (client.ts:1273) and from FeatureFlagEvaluations._recordAccess.

src/feature-flag-evaluations.ts `_recordAccess`, verbatim — this is the exact exposure payload to specify in the contract:
```ts
    const properties: Record<string, any> = {
      $feature_flag: key,
      $feature_flag_response: response,
      $feature_flag_id: flag?.id,
      $feature_flag_version: flag?.version,
      $feature_flag_reason: flag?.reason,
      locally_evaluated: flag?.locallyEvaluated ?? false,
      [`$feature/${key}`]: response,
      $feature_flag_request_id: this._requestId,
      $feature_flag_evaluated_at: flag?.locallyEvaluated ? Date.now() : this._evaluatedAt,
    }

    if 
- [verified-primary] Exposure-event dedup in posthog-node is per-client-instance and in-memory, and Babel Street constructs a fresh client per request then shuts it down — so any server-side exposure would fire on every single page view.
  src/client.ts `_captureFlagCalledEventIfNeeded`, verbatim:
```ts
    const featureFlagReportedKey = `${key}_${response}${groupSuffix}`

    if (
      distinctId in this.distinctIdHasSentFlagCalls &&
      this.distinctIdHasSentFlagCalls[distinctId].has(featureFlagReportedKey)
    ) {
      return
    }
```
`this.distinctIdHasSentFlagCalls` is instance state. /Users/jono/dev/babel/sanity-babel-street/lib/posthog-server.ts verbatim:
```ts
/**
 * Create a PostHog server-side client.
 *
 * Returns a new instance each call — server functions in Next.js are short-lived,
 * so events must be sent immediately (flushAt: 1, flushInterval: 0).
 * Always call `await client.shutdown()` when done.
 */
export default function PostHogClient() {
	const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
	if (!key) return null;

	return new PostHog(key, {
		host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://u
- [verified-primary] Babel Street fires the exposure event client-side, in a useEffect, after the variant page has already been served — the highest-risk part of the current design and the one PostHog's troubleshooting doc warns about.
  /Users/jono/dev/babel/sanity-babel-street/components/ab-test-tracker.tsx verbatim:
```tsx
	useEffect(() => {
		if (!posthog.__loaded || tracked.current) return;
		tracked.current = true;

		// Tell PostHog which variant this user saw — this is the experiment exposure event
		posthog.capture('$feature_flag_called', {
			$feature_flag: flagKey,
			$feature_flag_response: variant,
		});

		// Register super properties — all subsequent events carry the experiment info
		posthog.register({
			ab_test_flag: flagKey,
			ab_variant: variant,
		});
	}, [flagKey, variant]);
```
Mitigation already in place: the proxy writes a `ph_bootstrap` cookie `{distinctID, featureFlags}` (maxAge 300s) and instrumentation-client.ts feeds it to `posthog.init({..., bootstrap})`, so the browser SDK starts with the server's distinct_id and the server's variant — no client re-evaluation, no drift. Failure modes that
- [verified-primary] Goal events carry `$feature/<flagKey>` automatically once flags are bootstrapped into posthog-js — no manual property plumbing needed on the client. Server-side captures do NOT get it unless you pass the evaluateFlags snapshot.
  posthog-js 1.373.2, lib/src/persistence-key-transforms.js verbatim:
```js
var transformEnabledFeatureFlagsToEventProperties = function (value) {
    if (!(0, core_1.isObject)(value)) { return {}; }
    var eventProperties = {};
    var keys = Object.keys(value);
    for (var i = 0; i < keys.length; i++) {
        eventProperties["$feature/".concat(keys[i])] = value[keys[i]];
    }
    return eventProperties;
};
```
wired via lib/src/persistence-key-policy.js:
```js
    _a[constants_1.ENABLED_FEATURE_FLAGS] = {
        exposure: 'derived',
        shouldSkipFromEventProperties: function (_, shouldSkip) { return shouldSkip(); },
        transformToEventProperties: persistence_key_transforms_1.transformEnabledFeatureFlagsToEventProperties,
    },
```
and ENABLED_FEATURE_FLAGS is populated from bootstrap at init (lib/src/posthog-featureflags.js, `PostHogFeatureFlags.prototype.initialize`, wh
- [verified-secondary] PostHog explicitly sanctions self-assignment, but only under conditions the plugin README would have to enforce: configure a CUSTOM exposure event in the experiment, and manually stamp `$feature/<flag-key>` on both the exposure event and every metric event.
  From https://posthog.com/docs/experiments/running-experiments-without-feature-flags: "Your feature flag system handles the variant assignment. PostHog only needs to know which variant was shown to each user through the events you send." and "When using PostHog's Feature Flags with our SDKs, this property is added automatically to all events. When using your own feature flag system, you must manually add it." It also warns you must still create the flag key in PostHog: "This key is used to identify which events belong to your experiment when PostHog calculates results."

From https://posthog.com/docs/experiments/exposures: default exposure requires a `$feature_flag_called` event carrying `$feature_flag` = the flag key and `$feature_flag_response` = a variant value; custom exposure is set via "Include people when" → Custom event; and "metric events are only counted if they occur after a us
- [verified-primary] The troubleshooting-doc claim quoted in the ticket is accurate.
  Verified live at https://posthog.com/docs/experiments/troubleshooting: "If the variant on your exposure event is decided before the data needed to evaluate the flag is available... PostHog only counts users whose exposure event has a valid variant. Those incorrectly evaluated users are silently dropped from the experiment." and "If the dropped users aren't random, and they usually aren't, your results are skewed, not just smaller." Also documents that the web SDK deduplicates `$feature_flag_called` per identity by default, so returning users may not re-register as exposed after an experiment launches — mitigated by `advanced_feature_flags_dedup_per_session` (confirmed present in posthog-js 1.373.2 source, `_config.advanced_feature_flags_dedup_per_session`, which resets `FLAG_CALL_REPORTED` on session change).
- [verified-primary] Latency benchmark of the remote /flags call: ~225 ms steady-state TTFB from a UK client to us.i.posthog.com, ~700-780 ms cold including DNS+TCP+TLS. This is an upper bound, not a Vercel-edge number.
  Measured 2026-07-30 against `POST https://us.i.posthog.com/flags/?v=2` with the Roboto Website project token.
Cold (new connection each request, n=8): total 0.694-0.781 s; time_connect ~0.22-0.28 s; time_appconnect (TLS done) ~0.45-0.55 s; TTFB 0.678-0.781 s.
Warm (connection reused, n=6): first request total 0.704 s (num_connects=1), subsequent num_connects=0 with TTFB/total 0.2215, 0.2242, 0.2264, 0.2287, 0.2317 s — i.e. **~225 ms marginal cost per request** dominated by transatlantic RTT (~220 ms).
Server-side compute is small: TTFB minus TLS-complete on cold requests is ~0.23 s and equals the warm figure, so the response itself is essentially one RTT.
The project's real flag payload (2 flags, both no_condition_match) returns `{"errorsWhileComputingFlags":false,"flags":{...},"requestId":...,"evaluatedAt":...}` with per-flag `reason.code` and `metadata.has_experiment` — the v2 shape po
- [verified-primary] The 'rolloutPercentage is authoritative vs decorative' half of the gap is already answered by the reference implementation: it stores NO rollout percentage in Sanity at all.
  /Users/jono/dev/babel/sanity-babel-street/sanity/schemas/documents/ab-test.ts stores only `variants[] = { variantKey: string (input: PostHogVariantKeySelect, description 'Synced from PostHog'), page: reference to page }`, with `Rule.required().min(2)` and a custom rule rejecting duplicate variantKeys. There is no percentage field anywhere in the schema. Rollout percentages are surfaced read-only, live from PostHog, by app/api/posthog/experiments/route.ts:
```ts
				const variants: { key: string; rollout_percentage: number }[] =
					exp.parameters?.feature_flag_variants?.map((v: any) => ({
						key: v.key,
						rollout_percentage: v.rollout_percentage ?? 0,
					})) ?? [];
```
(that route is the async-fetcher analogue; it holds POSTHOG_PERSONAL_API_KEY server-side and CORS-allowlists the Studio origins).

And @sanity/personalization-plugin@3.0.11's own type has no rollout concept eithe
- [inferred] Adjacent defect in the reference proxy worth fixing before it goes into a copy-paste prompt: it treats EVERY string-valued flag in the project as an experiment and encodes all of them into the rewritten path.
  proxy.ts extracts `experimentFlags` as every entry of `getAllFlags()` whose value is `typeof value === 'string'` — that includes multivariate flags that are ordinary feature flags, not experiments (posthog-node exposes `metadata.has_experiment` per flag, which is what should be filtered on). All of them are then JSON'd and base64url'd into `/test/<flagsParam>/<slug>`, so the CDN cache key multiplies across the cartesian product of every multivariate flag combination in the project, not just the flags referenced by a published abTest document. The runtime prompt should (a) scope evaluation with `evaluateFlags(distinctId, { flagKeys })` using only the flag keys of published abTest docs, and (b) encode only the single flag key relevant to the matched route.

## It was never verified that PostHog exposes experiment metadata to any credential other than a personal API key. The locked "host-supplied async fetcher" decision was designed around this constraint but the constraint itself was never confirmed.
- [verified-primary] The constraint is REAL and now empirically confirmed: a PostHog project token (phc_...) cannot read the experiments API. Live probe returns HTTP 401.
  Live probe on 2026-07-30 against the user's own project (id 203176, token phc_LiOBG1cTYz1AK9Efpm405CTYOlrqgcf3seNv9Gb14AF):

$ curl -H "Authorization: Bearer phc_LiOB..." https://us.posthog.com/api/projects/203176/experiments/?limit=1
HTTP 401
{"type":"authentication_error","code":"authentication_failed","detail":"Personal API key found in request Authorization header is invalid.","attr":null}

Unauthenticated:
HTTP 401
{"type":"authentication_error","code":"not_authenticated","detail":"Authentication credentials were not provided.","attr":null}

The error text is diagnostic: PostHog treats any Bearer token on this route as a candidate personal API key. There is no project-token code path at all.
- [verified-primary] posthog.com/docs/api/experiments confirms scope experiment:read and documents ONLY a personal API key in every example.
  Verbatim from the rendered docs page (fetched to scratchpad/backfill/experiments.html):

"List all experiments — List experiments for the current project. Supports filtering by status and archival state.
Required API key scopes: experiment:read"

Example request, verbatim:

  GET /api/projects/:project_id/experiments

  export POSTHOG_PERSONAL_API_KEY=[your personal api key]
  curl \
    -H "Authorization: Bearer $POSTHOG_PERSONAL_API_KEY" \
    <ph_app_host>/api/projects/:project_id/experiments/

Query parameters: archived (boolean), created_by_id, event, feature_flag_id (integer), limit (integer), offset (integer), order, prompt_name, search, status — status is one of "all" | "complete" | "draft" | "exposure_frozen" | "paused" | "running" | "stopped".

NOTE FOR THE README/FETCHER: `status=running` is the filter you want, and the response is paginated ({count, next, previous, results}).
- [verified-primary] PostHog now documents THREE auth mechanisms, not one. The API overview names Personal API keys, Project secret API keys, and OAuth.
  Verbatim from https://posthog.com/docs/api:

"It contains two types of endpoints: Public POST-only endpoints such as /i/v0/e and /flags are used for capturing events, batching events, updating person or group information, and evaluating feature flags. These don't require authentication, but use your project token to handle the request. Private GET, POST, PATCH, DELETE endpoints are used for querying, creating, updating, or deleting nearly all data in PostHog. They give the same access as if you were logged into your PostHog instance, but require authentication with your personal API key."

"Authentication — Private endpoints require authentication. There are three ways to authenticate, and which one you should use depends on who the integration is for:
- Personal API keys – Use these when you're using PostHog from your own scripts, automations, or any integration tied to your own account
- [verified-primary] The newer scoped-API-key mechanism (Project Secret API Keys, phs_...) does NOT narrow the constraint — it does not work on the experiments endpoint. Confirmed in PostHog source two independent ways.
  Gate 1 — the view must opt in by listing ProjectSecretAPIKeyAuthentication. GitHub code search across PostHog/posthog for `ProjectSecretAPIKeyAuthentication` returns 16 files; the only product viewsets are:
  products/feature_flags/backend/api/feature_flag.py
  products/feature_flags/backend/api/remote_config_shadow.py
  products/endpoints/backend/presentation/views/api.py
  products/customer_analytics/backend/presentation/views/external.py
  products/tasks/backend/presentation/views/loops.py
Experiments is absent.

Gate 2 — the view must declare `psak_allowed_actions`. From posthog/permissions.py, APIScopePermission.has_permission, verbatim:

        if is_psak:
            psak_allowed_actions = getattr(view, "psak_allowed_actions", self.psak_allowed_actions)
            if self._get_action(request, view) not in psak_allowed_actions:
                self.message = "This action does not
- [verified-primary] PostHog HAS already extended project secret keys to feature flags — but only to the remote_config action, never to experiments. This is the clearest evidence the exclusion is deliberate, not an oversight.
  products/feature_flags/backend/api/feature_flag.py, verbatim:

    scope_object = "feature_flag"
    ...
    psak_allowed_actions = ["remote_config"]

and on the action itself:

    @action(
        detail=True,
        required_scopes=["feature_flag:read"],
        authentication_classes=[
            TeamSecretTokenAuthentication,
            ProjectSecretAPIKeyAuthentication,
        ],
        permission_classes=[TeamSecretTokenPermission],
        throttle_classes=[RemoteConfigThrottle, RemoteConfigProjectSecretApiKeyTeamThrottle],
    )
    def remote_config(self, request: request.Request, **kwargs):

So PostHog knows how to expose a non-personal server credential and chose to do it for flags/remote config only. Experiments remains personal-key/OAuth territory.
- [verified-primary] MATERIAL NUANCE the gap statement missed: OAuth is a live, self-serve alternative to a personal API key, and experiment:read is a real OAuth scope. Verified against PostHog's live authorization-server metadata.
  The experiments viewset inherits the default authenticator stack from posthog/api/routing.py (TeamAndOrgViewSetMixin.get_authenticators), verbatim:

        authentication_classes.extend(
            [
                IDJagAccessTokenAuthentication,
                JwtAuthentication,
                OAuthAccessTokenAuthentication,
                PersonalAPIKeyAuthentication,
                SessionAuthentication,
            ]
        )

So OAuth access tokens CAN read experiments. Live check of https://us.posthog.com/.well-known/oauth-authorization-server on 2026-07-30: scopes_supported contains 203 scopes including verbatim 'experiment:read', 'experiment:write', 'experiment_holdout:read', 'experiment_holdout:write', 'experiment_saved_metric:read', 'experiment_saved_metric:write', 'feature_flag:read', 'feature_flag:write'. Endpoints: authorization_endpoint https://us.posthog.com/oauth/
- [verified-primary] posthog-js#3593 is still OPEN as of 2026-07-30, has zero comments after ~15 months, and was last touched 2026-06-23. Treat 'it might land' as effectively zero for v1 planning.
  Live GitHub API (gh api repos/PostHog/posthog-js/issues/3593):
{"closed_at": null, "state": "open", "title": "Feature Request: Expose experiment metadata in SDKs", "created_at": "2025-04-09T19:40:07Z", "updated_at": "2026-06-23T10:51:52Z", "comments": 0, "labels": ["enhancement", "team/experiments", "feature/experiments"]}

Opened 2025-04-09, still open 2026-07-30, ZERO comments — no PostHog staff response at all, no linked PR, no resolution. Labels are triage labels (team/experiments, feature/experiments), not a commitment. The requested API is quoted verbatim in the body as "A lightweight, SDK method (posthog.getExperiments() ?) that exposes only non-sensitive experiment metadata associated with feature flags". Notably the issue body itself describes a Next.js app integrating PostHog experiments with a headless CMS (Sanity) — i.e. our exact use case, filed by someone else, and ignored 
- [verified-primary] No SDK path exists: posthog-node 5.46.1 (current latest) exposes no experiment-listing method. The only experiment signal in the SDK is a per-flag boolean.
  npm view posthog-node version => 5.46.1 (current). npm view posthog-js version => 1.408.1 (current). Grepping all of posthog-node@5.46.1 dist/*.d.ts for 'experiment' yields no getExperiments/listExperiments — only:

types.d.ts (on PostHogFeatureFlag):
    experiment_set: number[];
    /** Whether the flag is linked to an experiment. Absent when the server does not report it. */
    has_experiment?: boolean;

feature-flag-evaluations.d.ts (on EvaluatedFlagRecord, marked @internal):
    /** Whether the flag is linked to an experiment; undefined when the server did not report it. */
    hasExperiment: boolean | undefined;

That is a boolean per evaluated flag — no experiment name, description, dates, status, or variant list. It is nowhere near enough to drive a Studio UI, which confirms alternative #3 in issue 3593 ("Relying solely on feature flags via the SDK: Doesn't give us enough metada
- [verified-primary] posthog-node's server credential option was renamed to secretKey and accepts BOTH phx_ and phs_ keys — worth mirroring in our README's env-var naming so we don't hardcode 'personal'.
  Verbatim from posthog-node@5.46.1 dist/types.d.ts:

    /**
     * Credential that enables local feature flag evaluation and remote config.
     *
     * Accepts either a Personal API Key (`phx_...`) or a Project Secret API Key (`phs_...`).
     * When provided, the client can evaluate feature flags locally and decrypt remote
     * config payloads via `getRemoteConfigPayload`. Prefer this over the deprecated
     * `personalApiKey` option; when both are set, `secretKey` takes precedence.
     *
     * @example
     * ```ts
     * const client = new PostHog('phc_...', { secretKey: 'phs_...' })
     * ```
     */
    secretKey?: string;
    /**
     * @deprecated Use `secretKey` instead.
     */
    personalApiKey?: string;

Note the personal API key prefix is `phx_` (not the older `phc_`/`phk_` you may remember) and project secret keys are `phs_`. PostHog source confirms: posthog/auth.py
- [verified-primary] Rate limits on the experiments endpoint are generous enough that the Studio fetcher needs no caching layer for v1, but the limit is org-wide and shared.
  Verbatim from https://posthog.com/docs/api: "For the rest of the create, read, update, and delete endpoints, the rate limits are 480/minute and 4800/hour." And critically: "These limits apply to the entire team (i.e. all users within your PostHog organization). For example, if a script requesting feature flag metadata hits the rate limit, and another user, using a different personal API key, makes a single request to the persons API, this gets rate limited as well."

Implication for the plugin: the Studio fetcher should not poll aggressively. Fetch on mount / on explicit refresh, not on an interval. A misbehaving Studio could rate-limit the customer's entire PostHog org.
- [inferred] RECOMMENDED README RESTRUCTURE (the actionable output of this gap).
  1. PREREQUISITE section, not a footnote — titled something like "Step 1: Deploy the experiments proxy route". Lead with the honest statement: PostHog exposes experiment metadata only to a server-side credential (personal API key phx_, or OAuth). There is no project-token or SDK path. Cite posthog-js#3593 as the open upstream request.

2. Complete copy-paste Next.js App Router handler. Shape verified against the docs example:

// app/api/posthog/experiments/route.ts
import {NextResponse} from 'next/server'

export async function GET() {
  const host = process.env.POSTHOG_API_HOST ?? 'https://us.posthog.com'
  const res = await fetch(
    `${host}/api/projects/${process.env.POSTHOG_PROJECT_ID}/experiments/?status=running&limit=100`,
    {
      headers: {Authorization: `Bearer ${process.env.POSTHOG_API_KEY}`},
      cache: 'no-store',
    },
  )
  if (!res.ok) return NextResponse.json({err

## The demo repo github.com/demo-repositories/personalization-plugin-example was still never cloned. I cloned it; it contains the canonical page-level implementation, and it contradicts DIVERGE #5 and answers open question #6 outright.
- [verified-primary] The demo repo exists, is current (last commit 2026-04-07), and models the page-level experiment target as a STRING `targetRoute`, not a reference.
  Clone: /private/tmp/claude-502/-Users-jono-dev-babel/2fbe4965-2b65-41df-920f-543ac08080de/scratchpad/backfill/demorepo, HEAD 82f2f934f6d771c19b785c44ee6a8e3c38bf58b9 (2026-04-07 10:25:37 -0400) "add video walkthrough and reorganize". apps/studio/schemaTypes/documents/route-experiment.ts verbatim field:

defineField({
  name: "targetRoute",
  title: "Target Route",
  type: "string",
  description:
    "The URL path this experiment applies to (e.g., '/' for homepage, '/pricing' for pricing page)",
  validation: (Rule) => Rule.required(),
  options: {
    list: [
      { title: "Homepage (/)", value: "/" },
      { title: "Blog Index (/blog)", value: "/blog" },
    ],
  },
}),

Open question #6 is answered: string path, hardcoded options.list, no reference to a page document. Note the list is authored by hand in schema — it does not enumerate real routes dynamically.
- [verified-primary] The document also carries `isActive` (boolean, initialValue false) and a `page` field of the plugin-generated type `experimentPage`, with a custom validation rule.
  Verbatim:

defineField({
  name: "isActive",
  title: "Active",
  type: "boolean",
  initialValue: false,
  description: "Enable/disable this experiment",
}),
defineField({
  name: "page",
  title: "Page Experiment",
  type: "experimentPage",
  description:
    "Select a default page and optional per-variant pages (variants must match your experiment/cookie variant IDs).",
  validation: (rule) =>
    rule.custom((experiment: unknown) => {
      const exp = experiment as
        | { default?: unknown; variants?: Array<{ _key?: string; value?: unknown }> }
        | undefined;
      if (!exp?.default) return "Default page is required";
      const invalidVariants = exp.variants?.filter((v) => !v.value) ?? [];
      if (invalidVariants.length) {
        return invalidVariants.map((item) => ({
          message: "Variant page is required",
          path: ["variants", { _key: item._key }, "v
- [verified-primary] Route matching is EXACT string equality against pathname — there is no prefix, glob, or regex support anywhere in the CMS-driven path.
  apps/web/src/lib/route-experiments.ts verbatim:

export function getExperimentForRoute(
  experiments: RouteExperiment[],
  pathname: string
): RouteExperiment | undefined {
  return experiments.find((exp) => exp.targetRoute === pathname);
}

Consequence confirmed by reading proxy.ts: pattern routes like /blog/* cannot be expressed. The demo works around this with a SEPARATE hardcoded regex branch in proxy.ts that is not CMS-driven at all:

if (pathname.match(/^\/blog\/[^\/]+$/) && !pathname.endsWith("/")) { ... url.pathname = `${pathname}/${variant}`; ... }

So the canonical repo itself demonstrates that exact-match is insufficient and falls back to code for pattern routes.
- [verified-primary] The reference GROQ contract is ROUTE_EXPERIMENTS_QUERY, filtered on `isActive == true`, projecting the generated object shape `page{experimentId, default, variants[]{variantId, value}}` with reference deref flattened into pageId/pageSlug/pageType.
  Verbatim from apps/web/src/lib/route-experiments.ts:

const ROUTE_EXPERIMENTS_QUERY = `
  *[_type == "routeExperiment" && isActive == true]{
    _id,
    name,
    targetRoute,
    page{
      experimentId,
      "default": {
        "pageId": default->_id,
        "pageSlug": default->slug.current,
        "pageType": default->_type
      },
      "variants": variants[]{
        _key,
        experimentId,
        variantId,
        "value": {
          "pageId": value->_id,
          "pageSlug": value->slug.current,
          "pageType": value->_type
        }
      }
    }
  }
`;

Accompanying TS types are hand-written (not typegen): RouteExperimentVariant {pageId: string; pageSlug: string | null; pageType: string}, RouteExperimentPageVariant {_key?; experimentId?; variantId: string; value: RouteExperimentVariant}, RouteExperimentPageExperiment {experimentId?; default; variants?}, Rou
- [verified-primary] DIVERGE #5 re-argued: the generated object type's exact field names are produced by the plugin from CONFIG_DEFAULT, so dropping it means hand-reimplementing four field names AND the variant-picker UI, not just a schema shape.
  From the published dist (pp3/dist/fieldExperiments-*.js), CONFIG_DEFAULT verbatim:

const CONFIG_DEFAULT = {
	fields: [],
	apiVersion: "2024-11-07",
	experimentNameOverride: "experiment",
	variantNameOverride: "variant",
	variantId: "variantId",
	variantArrayName: "variants",
	experimentId: "experimentId"
}

and in the plugin factory: experimentId = `${experimentNameOverride}Id`; variantArrayName = `${variantNameOverride}s`; variantId = `${variantNameOverride}Id`.

createExperimentType names the type `${experimentNameOverride}${Capitalized(fieldName)}` — so defineField({name:"page", type:"reference", to:[{type:"page"},{type:"homePage"}]}) yields type name `experimentPage`, and createVariantType yields `variantPage`. Generated `experimentPage` object fields, in order: `default` (the supplied field, renamed to "default"), `active` (boolean, hidden:true, initialValue:false), `experimentId` 
- [verified-primary] CONTRADICTS the ticket's premise: working async-fetcher examples DO exist upstream — the plugin itself ships two, at @sanity/personalization-plugin/growthbook and /launchDarkly.
  Both submodules wrap the core plugin and pass a function to `experiments`. GrowthBook, verbatim from dist/growthbook/index.js:

plugins: [fieldLevelExperiments$1({ fields, experiments: (client) => getExperiments({ client, environment, baseUrl, project, convertBooleans, tags }) })]

where getExperiments is `async ({client, environment, baseUrl, project, convertBooleans, tags}) => { let query = `*[_id == 'secrets.growthbook'][0].secrets.apiKey`, secret = await client.fetch(query); if (!secret) return []; ... await fetch(url, {headers: {Authorization: `Bearer ${secret}`}}) ... }` with paging via hasMore/nextOffset against `${baseUrl}/features` (default baseUrl "https://api.growthbook.io/api/v1"), mapping feature.environments[environment].rules of type "experiment-ref"|"experiment" into {id,label,variants:[{id,label}]}.

LaunchDarkly is the same pattern against https://app.launchdarkly.com/a
- [verified-primary] The async fetcher is a first-class part of the public type and is resolved via suspend-react keyed on the workspace — meaning it is fetched once per workspace per session with no refetch or invalidation.
  Public type, verbatim from dist/index.d.ts (identical in 2.5.0 and 3.0.11):

type FieldPluginConfig = {
  fields: (string | FieldDefinition)[];
  experiments: ExperimentType[] | ((client: SanityClient) => Promise<ExperimentType[]>);
  apiVersion?: string;
  experimentNameOverride?: string;
  variantNameOverride?: string;
  variantId?: string;
  variantArrayName?: string;
  experimentId?: string;
};
type ExperimentType = { id: string; label: string; variants: VariantType[] };
type VariantType = { id: string; label: string };

Resolution site in ExperimentProvider (minified):

Array.isArray(cfg.experiments) ? cfg.experiments : suspend(async () => typeof cfg.experiments == "function" ? cfg.experiments(client) : cfg.experiments, [workspace], { equal })

The client passed in is `useClient({apiVersion: cfg.apiVersion})`, default apiVersion "2024-11-07". Practical implications for our plugin: (
- [verified-primary] The demo's Studio-side `experiments:` input is a hardcoded static array with a comment inviting an async loader — confirming the ticket's observation, but it is NOT the only upstream evidence.
  apps/studio/utils/experiments.ts verbatim (whole file):

/**
 * Studio-side experiment + variant definitions for `@sanity/personalization-plugin`.
 *
 * This is intentionally a local/static list for now. When you're ready to connect
 * to a 3rd party, replace this export with an async loader:
 * - `experiments: async () => fetch(...).then(r => r.json())`
 * - or `experiments: async (client) => client.fetch(...)`
 *
 * Shape must be: {id, label, variants: [{id, label}]}
 * Variant IDs must match whatever you use in cookies / routing (e.g. `control`, `variant-a`).
 */
import type { ExperimentType } from "@sanity/personalization-plugin";
export const experimentsFromStatsig: ExperimentType[] = [
  { id: "route-page", label: "Route Page", variants: [{id:"control",label:"Control"},{id:"variant-a",label:"Variant A"},{id:"variant-b",label:"Variant B"},{id:"variant-c",label:"Variant C"}] },
  { i
- [verified-primary] Studio config wires the plugin with a `reference` field definition, which is what produces `experimentPage`.
  apps/studio/sanity.config.ts verbatim:

fieldLevelExperiments({
  // Field(s) you want to experiment on. Passing a full schema field
  // definition gives us more control (e.g. reference, hidden, etc.)
  fields: [
    "string",
    defineField({
      name: "page",
      type: "reference",
      to: [{ type: "page" }, { type: "homePage" }],
    }),
  ],
  // Experiments + variants (must match cookie values)
  experiments: experimentsFromStatsig,
}),

The bare "string" entry produces `experimentString`, used at blog.ts:22 (`defineField({name:'newTitle', type:'experimentString', group: GROUP.MAIN_CONTENT})`). So the page-level doc type and the field-level example share one plugin instantiation.
- [verified-primary] Only the `/` targetRoute is actually functional end-to-end; the `/blog` option in options.list is dead.
  proxy.ts rewrite logic verbatim:

if (pathname === "/") {
  url.pathname = `/home/${userVariant}`;
} else if (selectedPage.pageSlug) {
  // For other route experiments, rewrite to /[slug]/[variant]
  url.pathname = `${selectedPage.pageSlug}/${userVariant}`;
}
url.searchParams.set("pageId", selectedPage.pageId);

The repo has apps/web/src/app/home/[variant]/page.tsx but NO [slug]/[variant] route. The non-"/" branch lands in app/[...slug]/page.tsx, which queries `*[_type == "page" && slug.current == $slug][0]` with slug = `/<pageSlug>/<variant>` — no such document → notFound(). Additionally the exported helper getRewritePath() in route-experiments.ts is dead code: grep shows the only occurrence in the repo is its own definition; proxy.ts inlines equivalent logic instead.
- [verified-primary] The variant page renders via a searchParam `pageId`, using a coalesce draft-preferring GROQ query — an approach worth flagging as a preview-safety hazard.
  apps/web/src/app/home/[variant]/page.tsx reads `searchParams: Promise<{pageId?: string}>`, validates `variant` against a locally re-declared const EXPERIMENT_VARIANTS = ["control","variant-a","variant-b","variant-c"] (a third copy of that list — the others are apps/web/src/lib/experiments.ts and apps/studio/utils/experiments.ts), and calls queryPageById. That query, verbatim from apps/web/src/lib/sanity/query.ts:

export const queryPageById = defineQuery(/* groq */ `
  coalesce(
    *[_id == "drafts." + $id][0],
    *[_id == $id][0]
  ){ _id, _type, title, description, "slug": slug.current, ${pageBuilderFragment} }
`);

It unconditionally prefers the DRAFT document, in production, for any id passed via an unvalidated query string. Do not copy this into prompts. generateStaticParams() also prerenders all four variants, while the actual content is chosen by a searchParam.
- [verified-primary] The demo's proxy runs on the Edge runtime by default and contains 5 console.log debug lines plus a module-level 60s cache — all three confirmed, and the runtime default is confirmed from Vercel docs.
  apps/web/src/proxy.ts (Next 16 proxy.ts convention; web/package.json pins "next": "16.1.6") exports `proxy` and a `config` with only a `matcher` — no `runtime` key. Vercel Routing Middleware docs: "export const config = { runtime: 'nodejs', // or 'edge' (default) }" — so this is Edge. The debug lines are literally `console.log("[Route Experiments] pathname:", pathname)`, `... userVariant`, `... experiment found:`, `... selectedPage:` (JSON.stringify), `... Rewriting to:`. The cache in route-experiments.ts is module scope:

let cachedExperiments: RouteExperiment[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 60 * 1000; // 1 minute cache

On Edge this is per-isolate: hit rate is unpredictable, staleness is unbounded across isolates, and every cold isolate does a blocking @sanity/client fetch (useCdn: true, apiVersion "2026-01-27") before responding. The catch branch returns sta
- [verified-primary] Version drift: the demo pins @sanity/personalization-plugin ^2.5.0 (lockfile resolves 2.5.0), while npm latest is 3.0.11. The FieldPluginConfig type is byte-identical between the two.
  apps/studio/package.json: "@sanity/personalization-plugin": "^2.5.0"; pnpm-lock.yaml resolves '@sanity/personalization-plugin@2.5.0' against sanity@5.13.0 / react 19.2.4. `npm pack @sanity/personalization-plugin` (no tag) fetched 3.0.11 as of 2026-07-30. Diffing dist/index.d.ts across the two: FieldPluginConfig, ExperimentType, VariantType, ExperimentGeneric, VariantGeneric are identical in substance (3.x is reformatted and re-bundled — ESM-only exports map, deps bumped to @sanity/icons ^5.2.0, @sanity/ui ^3.4.3, plus @sanity/studio-secrets ^4.0.14; 2.5.0 shipped both .mjs and .js, 3.0.11 is `"type": "module"` with ".": "./dist/index.js" only). Repo of record moved: package.json homepage is https://github.com/sanity-io/plugins/tree/main/plugins/@sanity/personalization-plugin (monorepo), NOT the standalone sanity-plugin-personalization repo the demo README still links to.
- [verified-primary] Variant assignment in the demo is MurmurHash3-based and entirely client/edge-side; there is no PostHog anywhere in the demo, and exposure tracking is a TODO stub.
  apps/web/src/lib/experiments.ts: EXPERIMENT_VARIANTS = ['control','variant-a','variant-b','variant-c'] as const; setCookiesValue resolves userId as `getUserIdFromSession(request) ?? request.cookies.get("ab-user-id")?.value ?? v4()`, then `const hash = MurmurHash3(userId).result(); const variantIndex = Math.abs(hash) % EXPERIMENT_VARIANTS.length;` and writes cookie `ab-test` = JSON {userGroup, userId} with maxAge 60*60*24*30, path "/", plus a companion `ab-user-id` cookie. getUserIdFromSession is a stub returning undefined. apps/web/src/components/tracking.tsx is a client component whose entire body is `console.log("Viewed Experiment, send tracking", {userGroup, userId})` with a `// TODO: track with Google Analytics, Segment, etc.` So the demo provides NO precedent for PostHog feature-flag-driven assignment or $feature_flag_called exposure events — that half of ROB-2468 has no upstream re
- [inferred] Recommendation on the targetRoute contract: adopt `targetRoute` string + `isActive` boolean, but do NOT adopt the demo's exact-equality matcher as the only mode.
  Evidence-based reasoning, not a primary-source claim. The demo proves exact-match is the shipped contract AND proves it is insufficient (it needed a separate hardcoded regex branch for /blog/:slug). A minimal superset that stays trivially implementable in an edge proxy: keep `targetRoute` as a string, add an optional `matchType` string field with options ['exact','prefix'] defaulting to 'exact', and match with `matchType === 'prefix' ? pathname === t || pathname.startsWith(t.endsWith('/') ? t : t + '/') : pathname === t`. Also: if multiple experiments can match one pathname, the demo's `.find()` silently takes document order — an explicit priority/first-match rule should be specified. Note the demo's options.list of routes is hand-authored; for our plugin the route list should be a plugin-config option (host supplies known routes) rather than baked into schema.
