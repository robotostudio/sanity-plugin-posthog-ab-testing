# dev-studio — vanilla test harness (ROB-2478)

A minimal Sanity Studio that exercises `sanity-plugin-posthog-ab-testing` **through its built `dist/` output** (`"sanity-plugin-posthog-ab-testing": "file:.."` — npm symlinks the repo root, and the package's `exports` resolve to `dist/index.js`). One vanilla `page` document type (title + slug), the plugin registered via its real public API, and switchable experiment fixtures covering the ROB-2473 editor state matrix.

Not published, not a workspace — a throwaway harness.

## Boot

```sh
# from the repo root: build the plugin first — the harness consumes dist/
npm run build

cd dev-studio
npm install
npm run dev        # http://localhost:3333
```

`npm run build` (in here) runs `sanity build` and needs no auth — use it to prove the config + plugin compile together.

**To actually open the Studio** you need a real Sanity project: set `SANITY_STUDIO_PROJECT_ID`, run `npx sanity login`, and make sure `http://localhost:3333` is a CORS origin on the project. With the default `placeholder` projectId the dev server serves the HTML shell but the workspace cannot authenticate.

After changing plugin code, re-run `npm run build` at the repo root (the symlink picks up the fresh `dist/` on the next dev-server reload).

## Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `SANITY_STUDIO_PROJECT_ID` | `placeholder` | Sanity project id. |
| `SANITY_STUDIO_DATASET` | `production` | Dataset. |
| `SANITY_STUDIO_AB_FIXTURE` | `static` | Which experiments fixture the plugin gets (below). |
| `SANITY_STUDIO_AB_EXPERIMENTS_URL` | *(unset)* | Absolute URL of a real Part-1 experiments route; required by `route` mode. |

Env vars are inlined at build/dev-server start — restart `npm run dev` after changing them.

## Fixture modes (`SANITY_STUDIO_AB_FIXTURE`)

| Mode | What it is | ROB-2473 states it demonstrates |
| --- | --- | --- |
| `static` (default) | Static `PostHogExperiment[]` — one experiment per status (running, draft, paused, exposure_frozen, complete), a 3-way multivariate flag, rollout percentages present/absent/mixed | All five status badges + status cards (ended/draft/paused/frozen copy), rollout chips + max-rollout highlight, ownership line, out-of-sync warning + "Add missing variants", deleted-experiment card (paste a key not in the list, e.g. `deleted-experiment`), happy path. Static array = no fetch, no Suspense. |
| `empty` | Async fetcher resolving `[]` | Empty state: caution "No experiments found in PostHog…" card + manual flag-key input (reached through the fetch path, honouring the `[]`-means-none contract). |
| `throwing` | Async fetcher that throws | Error state: plugin's own error boundary, critical card with the error message, Retry button (token bump — retries must actually refetch), manual input fallback. |
| `slow` | 5 s delay, then the static set | Loading state: suspend() into the plugin's own `<Suspense>` fallback ("Loading experiments from PostHog…"); also makes "Reload experiments" re-suspension visible. |
| `route` | Fetches `SANITY_STUDIO_AB_EXPERIMENTS_URL` (throws on non-2xx) | The real production path against a live host route / PostHog project, once one exists. |

The unconfigured state (no `experiments` key) is a config-level state — to see it, temporarily remove the `experiments` line in `sanity.config.ts` (TypeScript will object; that's the point).

## Still to observe — record onto ROB-2473

These need a real projectId + `npx sanity login` to open the Studio, **which needs Jono**. The suspend()/error-boundary behaviour must be OBSERVED, not assumed, and the findings recorded onto the ROB-2473 ticket:

- [ ] `slow`: opening an A/B test document shows the plugin's own Suspense fallback card ("Loading experiments from PostHog…") — not a blank form, not a Studio-level spinner.
- [ ] `throwing`: the thrown fetcher is caught by the **plugin's own** error boundary — the critical card renders inside the field, the rest of the document form stays alive and editable, and the manual flag-key input is reachable. (The whole point of the owned boundary: rob2470 verified upstream renders neither.)
- [ ] `throwing` → Retry: pressing Retry re-runs the fetcher (new suspend key). A failure is never permanently cached for the tab's lifetime.
- [ ] `slow` → "Reload experiments": the input re-suspends into the shared loading card (no separate spinner state).
- [ ] `empty`: caution card + manual input, distinct copy from the error card (error vs empty split).
- [ ] `static`: all five badges/cards render with the ROB-2473 copy; out-of-sync "Add missing variants" appends stubs only (never removes); deleted-experiment key renders "{value} (not found in PostHog)" + caution card.
- [ ] `variants[].variantKey` mirrors: "Select a PostHog experiment first.", "— already assigned" disabled options, control badge.
