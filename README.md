# sanity-plugin-posthog-ab-testing

> **Nothing is built yet.** This folder is a placeholder created 2026-07-30 to hold the project once
> [ROB-2475](https://linear.app/roboto/issue/ROB-2475) settles the toolchain and the package name.
> **The directory name is provisional** — it matches the recommended npm name, but that is still an open decision.

A Studio-only Sanity plugin for PostHog-driven, page-level A/B testing. Extracted from the working
implementation in `BabelStreet/sanity-babel-street` (@ `1b9a164`).

## Where the plan lives

Wayfinder map: **[ROB-2468](https://linear.app/roboto/issue/ROB-2468)** in Roboto Linear. Read the map before
touching anything — it holds the destination, the locked decisions, and the fog.

## Do this first

Two decisions block scaffolding, both on [ROB-2475](https://linear.app/roboto/issue/ROB-2475):

1. **Build toolchain.** `tsdown` + `@sanity/tsdown-config` (what Sanity's own plugins now use) **or**
   `@sanity/plugin-kit` + `@sanity/pkg-utils` (the documented external path, whose `verify-package` *rejects*
   a tsdown build). Mutually exclusive.
2. **Package name.** `sanity-plugin-ab-testing` is taken by an active competitor; `sanity-plugin-posthog` and
   `sanity-plugin-personalization` are also taken. `sanity-plugin-posthog-ab-testing` and
   `sanity-plugin-posthog-experiments` are both free.

## Locked decisions

- **Studio-only.** The runtime half ships as README documentation plus copy-paste implementation prompts —
  not as a second npm package.
- **Page-level variants only.** Field-level is out of scope; `@sanity/personalization-plugin` covers that.
- **Experiments arrive via a host-supplied async fetcher** in plugin config. Never a client-side personal API key.
- **PostHog assigns variants.** Never hash locally — it invalidates PostHog's experiment analysis.

## Constraints worth knowing before you start

- PostHog exposes experiment metadata **only** via the `/experiments` REST API behind a **personal API key**
  (posthog-js#3593). A host-side server route is a prerequisite of adoption, not an advanced topic.
- `sanity-io/sanity-plugin-personalization` is **archived**. Live source is the `sanity-io/plugins` monorepo
  (npm 3.0.11) — and that monorepo is Sanity-internal only, so a standalone repo is the only route.
- Publishing to npm does **not** list you on the Sanity Exchange. Submission is manual
  ([ROB-2477](https://linear.app/roboto/issue/ROB-2477)). Roboto's own `sanity-plugin-chat-gpt` proves it —
  correct keywords, 404s on the Exchange.

## docs/research

Full artifacts from the 2026-07-30 research pass (30 agents, ~2.45M tokens). Dense, with verbatim type
signatures, versions and adversarial corrections. The Linear resolution comments on ROB-2470 and ROB-2471 are
the readable summaries; these are the working notes behind them.
