# sanity-plugin-posthog-ab-testing

Page-level A/B testing for Sanity Studio, driven by PostHog experiments. PostHog decides **who sees what**; Sanity decides **what each variant is**. This plugin gives editors an A/B test document that maps every PostHog experiment variant to a Sanity page — with live experiment status, one-click variant sync, and a kill switch — and this README gives your runtime everything else as copy-paste prompts for a coding agent.

> **Unofficial.** This plugin is not affiliated with or endorsed by PostHog or Sanity. Built and maintained by [Roboto Studio](https://robotostudio.com).

## 1. What it is

```
             assigns variants                    rewrites request
  PostHog ─────────────────────▶ your server ───────────────────────▶ /test/<flags>/<slug>
  (experiment,                   (proxy/middleware:                   (variant route: looks up the
   traffic split,                 reads distinct_id,                   A/B test document in Sanity,
   targeting)                     evaluates flags,                     renders the mapped page,
                                  sets bootstrap cookie)               reports exposure)
                                                                             │
                                                    Sanity A/B test document ┘
                                                    (posthogFlagKey → variantKey → page)
```

The visitor's URL never changes — the proxy **rewrites** (never redirects) requests for a control page to a variant-rendering route, carrying the evaluated flags in the path.

**Ownership split** (this is load-bearing; the Studio UI repeats it where editors will look for a percentage field):

| PostHog owns | Sanity owns |
| --- | --- |
| Variant assignment | Which page each variant key maps to |
| Traffic split percentages | The `enabled` kill switch |
| Targeting & scheduling | Page content itself |
| Experiment lifecycle (draft/running/ended) | — |

## 2. What this plugin does NOT do

- **No field-level or block-level experiments.** Page-level only: a variant is a whole page document.
- **No stats, results, or significance testing.** Read results in PostHog.
- **No dashboards in the Studio.**
- **No exposure tracking inside the plugin.** The `$feature_flag_called` exposure event is runtime code (Prompt 3) — and it is non-optional if you want PostHog's experiment analysis to work.
- **No runtime package.** The plugin ships zero runtime code, constants, or helpers. Your runtime is built from the prompts below and belongs to your app.
- **No polling of PostHog.** Experiments are fetched when an A/B test document opens and when an editor presses Reload — never on an interval (PostHog's private-API rate limit of 480 requests/min is shared across your whole organization).

## 3. Requirements

- **Sanity Studio v5 or v6** (`sanity ^5 || ^6`), React `^19.2`, `styled-components ^6.1`. The package is ESM-only.
- **A PostHog project** with (or about to have) experiments, and a personal API key (`phx_…`) for the server route.
- **The runtime prompts target Next.js App Router.** `proxy.ts` (Prompt 4) requires **Next.js 15.5+** (on 15.3–15.4 name it `middleware.ts`); `instrumentation-client.ts` (Prompt 5) requires **Next.js 15.3+**. The [runtime contract](#7-the-runtime-contract) is stated framework-agnostically — any stack that satisfies it works.
- **Every page type you map variants to must carry a `slug` field** (`slug.current`) — the one structural assumption the runtime makes about your pages.

## 4. PART 1 — Prerequisite: the experiments API route

The plugin cannot talk to PostHog directly: there is **no project-token or client-SDK path to experiment metadata** ([posthog-js#3593](https://github.com/PostHog/posthog-js/issues/3593)) — listing experiments requires a personal API key (`phx_…`), which must never reach a browser (it grants access across your whole PostHog organization). So your app hosts a small server route, and the Studio fetches from it. Run this prompt **before** installing the plugin.

Environment variables for this route:

| Variable | Example | Notes |
| --- | --- | --- |
| `POSTHOG_PERSONAL_API_KEY` | `phx_…` | Personal API key. Server-only — never `NEXT_PUBLIC_`. |
| `POSTHOG_PROJECT_ID` | `12345` | Numeric project id (PostHog project settings). |
| `SANITY_STUDIO_ORIGINS` | `https://my-studio.sanity.studio,https://www.sanity.io` | Comma-separated origins allowed via CORS. Needed because a studio on `*.sanity.studio` or `www.sanity.io` cannot use a relative URL. Leave unset if your Studio is embedded on the same origin. |
| `POSTHOG_API_HOST` | `https://us.posthog.com` | Optional. The **API** host (`us.posthog.com` / `eu.posthog.com`), *not* the ingestion host (`us.i.posthog.com`). Defaults to US. |

**Prompt 1 — copy the whole block into a coding agent:**

````text
You are working in a Next.js App Router project. Create a server route that lists PostHog
experiments for a Sanity Studio plugin. It keeps POSTHOG_PERSONAL_API_KEY server-side only.

Required env vars (add to .env.local; ask the human for values if missing):
  POSTHOG_PERSONAL_API_KEY   — PostHog personal API key (starts with phx_)
  POSTHOG_PROJECT_ID         — numeric PostHog project id
  SANITY_STUDIO_ORIGINS      — optional, comma-separated Studio origins for CORS
  POSTHOG_API_HOST           — optional, defaults to https://us.posthog.com

Create the file `app/api/posthog/experiments/route.ts` with exactly this content:

--- app/api/posthog/experiments/route.ts ---
import { NextRequest, NextResponse } from 'next/server';

// This type mirrors the `PostHogExperiment` type exported by
// sanity-plugin-posthog-ab-testing. It is declared locally on purpose:
// server code must not import from a Studio plugin package. If the plugin's
// exported type ever changes, this route must change with it.
type PostHogExperiment = {
  id: number;
  name: string;
  featureFlagKey: string;
  status: 'draft' | 'running' | 'paused' | 'exposure_frozen' | 'complete';
  variants: { key: string; label?: string; rolloutPercentage?: number }[];
};

const KNOWN_STATUSES = new Set(['draft', 'running', 'paused', 'exposure_frozen', 'complete']);

function allowedOrigins(): Set<string> {
  return new Set(
    (process.env.SANITY_STUDIO_ORIGINS ?? '')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  );
}

function corsHeaders(origin: string | null): Record<string, string> {
  if (origin && allowedOrigins().has(origin)) {
    return {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      Vary: 'Origin',
    };
  }
  return {};
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(req.headers.get('origin')),
  });
}

/**
 * Normalise PostHog's status to the plugin's 5-state enum.
 * PostHog documents both `stopped` and `complete` as "ended" — map stopped
 * to complete. If the response carries no usable status field, derive it
 * from the experiment dates instead.
 */
function normaliseStatus(exp: {
  status?: unknown;
  start_date?: string | null;
  end_date?: string | null;
}): PostHogExperiment['status'] {
  if (exp.status === 'stopped') return 'complete';
  if (typeof exp.status === 'string' && KNOWN_STATUSES.has(exp.status)) {
    return exp.status as PostHogExperiment['status'];
  }
  // Fallback mapping when no status field is present:
  if (exp.end_date) return 'complete';
  if (exp.start_date) return 'running';
  return 'draft';
}

/**
 * Proxy for the PostHog Experiments API, used by the Sanity Studio plugin.
 * Deliberately NO status filter — the plugin's ended-experiment warning needs
 * completed experiments in the list. Archived experiments are excluded.
 */
export async function GET(req: NextRequest) {
  const cors = corsHeaders(req.headers.get('origin'));
  const apiKey = process.env.POSTHOG_PERSONAL_API_KEY;
  const projectId = process.env.POSTHOG_PROJECT_ID;

  if (!apiKey || !projectId) {
    return NextResponse.json(
      { error: 'POSTHOG_PERSONAL_API_KEY and POSTHOG_PROJECT_ID must be configured' },
      { status: 500, headers: cors },
    );
  }

  // PostHog has separate hosts: us.i.posthog.com (ingestion) vs us.posthog.com
  // (API). The experiments API lives on the API host.
  const apiHost = process.env.POSTHOG_API_HOST || 'https://us.posthog.com';
  const url = `${apiHost}/api/projects/${projectId}/experiments/?limit=100&archived=false`;

  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
      next: { revalidate: 60 },
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`PostHog API ${res.status} for ${url}:`, text);
      return NextResponse.json(
        { error: `PostHog API error: ${res.status}`, details: text },
        { status: res.status, headers: cors },
      );
    }

    const data = await res.json();

    const experiments: PostHogExperiment[] = (data.results ?? [])
      .filter((exp: any) => !exp.archived)
      .map((exp: any) => ({
        id: exp.id,
        name: exp.name,
        featureFlagKey: exp.feature_flag_key,
        status: normaliseStatus(exp),
        variants:
          exp.parameters?.feature_flag_variants?.map((v: any) => ({
            key: v.key,
            ...(v.name ? { label: v.name } : {}),
            ...(typeof v.rollout_percentage === 'number'
              ? { rolloutPercentage: v.rollout_percentage }
              : {}),
          })) ?? [],
      }));

    return NextResponse.json(experiments, { headers: cors });
  } catch (err) {
    console.error('Failed to fetch PostHog experiments:', err);
    return NextResponse.json(
      { error: 'Failed to fetch PostHog experiments' },
      { status: 500, headers: cors },
    );
  }
}
--- end app/api/posthog/experiments/route.ts ---

The response body is a bare JSON array of PostHogExperiment objects. Do not wrap it in an
object, do not add a status query filter, and do not remove completed experiments — the
Studio plugin needs them to warn editors about ended experiments.

Verify:
1. `npx tsc --noEmit` passes.
2. With env vars set and `npm run dev` running:
   `curl -s http://localhost:3000/api/posthog/experiments | head -c 400`
   returns a JSON array. If the project has experiments, each entry has keys
   id, name, featureFlagKey, status, variants — and every status is one of
   draft | running | paused | exposure_frozen | complete.
3. Temporarily unset POSTHOG_PERSONAL_API_KEY and confirm the route returns HTTP 500 with
   a JSON error (the Studio treats non-2xx as failure — it must never look like an empty
   experiments list). Restore the env var afterwards.
4. Report which checks passed and paste one experiment object from check 2 (redact nothing —
   it contains no secrets).
````

## 5. PART 2 — Install & configure the Studio plugin

```sh
npm install sanity-plugin-posthog-ab-testing
```

```ts
// sanity.config.ts
import {defineConfig} from 'sanity'
import {posthogAbTesting} from 'sanity-plugin-posthog-ab-testing'

export default defineConfig({
  // ...
  plugins: [
    posthogAbTesting({
      // Production path: an async fetcher hitting the Part-1 route.
      // On *.sanity.studio or www.sanity.io this MUST be an absolute URL
      // (and the origin must be listed in SANITY_STUDIO_ORIGINS).
      experiments: async () => {
        const res = await fetch('https://www.your-site.com/api/posthog/experiments')
        if (!res.ok) throw new Error(`Experiments route failed: HTTP ${res.status}`)
        return res.json()
      },
    }),
  ],
})
```

**The fetcher contract:** on failure **throw** — never swallow errors into `[]`. An empty array means "no experiments exist in PostHog", and the plugin renders it that way (a caution card plus a manual flag-key input). A thrown error renders the plugin's own error card with a Retry button. The fetcher must be re-callable and idempotent: it runs when an A/B test document first opens and again on every "Reload experiments".

For demos and tests, `experiments` also accepts a static array (no fetch, no loading state):

```ts
posthogAbTesting({
  experiments: [
    {
      id: 1,
      name: 'Homepage hero',
      featureFlagKey: 'homepage-hero',
      status: 'running',
      variants: [{key: 'control', rolloutPercentage: 50}, {key: 'test', rolloutPercentage: 50}],
    },
  ],
})
```

### Config keys

Every key is honoured (and unit-tested). Everything not listed here is fixed by design — see [§6](#6-stored-document-shape--the-groq-contract).

| Key | Default | What it does |
| --- | --- | --- |
| `experiments` (required) | — | `PostHogExperiment[]` or `(client) => Promise<PostHogExperiment[]>`. The `client` is the Studio's authenticated client (`useClient({apiVersion})`). |
| `schemaType` | `'posthogAbTest'` | Document type name. **Set once, before content exists** — renaming later orphans documents and breaks the GROQ in your runtime code (it appears in every prompt's query filter). |
| `title` | `'A/B Test'` | Display title for the document type. |
| `pageTypes` | `['page']` | Document type(s) the `variants[].page` reference can point to. All listed types must carry a `slug`. |
| `languageField` | *(unset)* | i18n opt-in — see below. |
| `apiVersion` | `'2026-07-01'` | apiVersion for the client passed to your fetcher. |

If you use a custom desk structure, add the document type (your `schemaType` value) to it; with the default auto-generated structure it appears automatically.

### What the editor gets

- An experiment dropdown fed by your fetcher, with live status badges (Running / Draft / Paused / Enrollment frozen / Ended) and rollout chips.
- A **critical warning when an experiment has ended** ("…disable this A/B test in Sanity or the winning variant will keep being served") — plus draft, paused, and enrollment-frozen notices.
- An out-of-sync warning that names exactly which variant keys are missing or stale, with a one-click **"Add missing variants"** button (additive only — it never deletes or overwrites a mapped page).
- Degraded-state handling everywhere: fetch failures, empty experiment lists, deleted experiments, and missing configuration each get their own card — and a manual flag-key input is always reachable. The plugin never hard-blocks editing.

### Internationalization (optional)

If your studio uses [`@sanity/document-internationalization`](https://github.com/sanity-io/document-internationalization), pass `languageField: 'language'` (or whatever `languageField` you configured there). The A/B test schema then gains a hidden, read-only string field of that name so the i18n plugin can manage the document — and you should uncomment the one language-filter line in the shared GROQ query (Prompt 3). When unset, v1 is locale-unaware: no field, no filter.

## 6. Stored document shape & the GROQ contract

A published A/B test document looks like this:

```json
{
  "_type": "posthogAbTest",
  "name": "Homepage hero test",
  "posthogFlagKey": "homepage-hero",
  "enabled": true,
  "variants": [
    {"_key": "a1b2c3", "variantKey": "control", "page": {"_ref": "page-home"}},
    {"_key": "d4e5f6", "variantKey": "test", "page": {"_ref": "page-home-v2"}}
  ]
}
```

**Field names are fixed and are the contract** — `name`, `posthogFlagKey`, `enabled`, `variants`, `variants[].variantKey`, `variants[].page` are exactly what every runtime prompt's GROQ projects. They are deliberately not configurable: renameable fields would make your stored JSON a function of plugin config, and every prompt below would stop being correct as pasted. Also fixed:

- The **`control` variant key** — a PostHog convention (PostHog fixes the first variant's key as `control`). The runtime's control-page gate keys off it; the Studio warns (warning-level, never blocking) when no `control` variant is mapped.
- The **target route is derived**, not stored: the control variant's referenced page slug *is* the route the test applies to. There is no `targetRoute` string to drift out of sync. Consequence: only routes backed by a referenced page document can be tested — which is exactly the page-level scope.
- `enabled` defaults to `false` (tests go live deliberately), and the page reference has `disableNew: true` (variant pages should be authored properly, not created in a reference modal).

## 7. The runtime contract

The prompts in Part 3 are Next.js App Router implementations of this contract. Any framework that satisfies it gets the same behaviour:

1. **Identity** — the server reads the visitor's `distinct_id` from PostHog's own cookie, `ph_<project_api_key>_posthog`, minting a uuidv7 for first-time visitors.
2. **Server-side evaluation + rewrite** — the server evaluates feature flags for that id and **rewrites** (never redirects) requests for a *control* page to a variant-rendering route, carrying the evaluated flags **in the request** (base64url in the path) so the variant route never makes a second flag call.
3. **Bootstrap cookie** — the server sets `ph_bootstrap` = `{"distinctID": …, "featureFlags": …}` with `maxAge: 300`.
4. **Client bootstrap** — the browser initialises `posthog-js` with that payload as its `bootstrap` option, so client and server agree on flags from the first paint: no flicker, no re-evaluation drift.
5. **Exposure** — the client fires `$feature_flag_called` exactly once per view with `$feature_flag` and `$feature_flag_response`. Without this event PostHog silently drops the visitor from experiment analysis.
6. **Control-page rule** — the A/B test applies only when the visitor requests the control page. Direct navigation to a non-control variant's own URL renders that page normally; visitors are never redirected to their assigned variant.

## 8. PART 3 — Build the runtime

Run the prompts in order. The app compiles and has a checkable behaviour after every prompt. (The order is deliberate: the variant route comes **before** the proxy so the proxy's rewrite target exists and every step is verifiable.)

### Prompt 2 — Shared runtime foundations

Two tiny modules with no observable behaviour of their own (the Verify is honestly just a typecheck). `lib/ab-testing.ts` is the **single source of truth** for the cookie names and the `control` key — every later prompt imports from it; nothing restates the constants.

````text
You are working in a Next.js App Router project (15.3+) that uses PostHog. If posthog-js is
not yet installed or NEXT_PUBLIC_POSTHOG_KEY is not set, ask the human before continuing.

Install dependencies:

  npm install posthog-node

Required env (add to .env.local if missing):
  NEXT_PUBLIC_POSTHOG_KEY    — the PostHog project API key (starts with phc_)
  NEXT_PUBLIC_POSTHOG_HOST   — e.g. https://us.i.posthog.com (the ingestion host)

Create the file `lib/ab-testing.ts` with exactly this content:

--- lib/ab-testing.ts ---
/**
 * PostHog-driven A/B testing utilities.
 *
 * PostHog controls: variant assignment, traffic split, experiment lifecycle.
 * Sanity controls: which page content to show for each variant.
 *
 * distinct_id is read from PostHog's own cookie: ph_{project_key}_posthog
 * Feature flags are bootstrapped via a cookie set by the proxy/middleware.
 */

/** Cookie name for bootstrapped PostHog feature flags (set by the proxy) */
export const PH_BOOTSTRAP_COOKIE = 'ph_bootstrap';

/**
 * PostHog fixes the first experiment variant's key as `control`. The variant
 * route's control-page gate and the devtools import this — never restate the
 * literal elsewhere.
 */
export const CONTROL_VARIANT_KEY = 'control';

/**
 * PostHog stores the distinct_id in a cookie named `ph_{project_key}_posthog`.
 * Use this to read the user's distinct_id from the PostHog cookie.
 */
export function getPostHogCookieName(): string {
  return `ph_${process.env.NEXT_PUBLIC_POSTHOG_KEY}_posthog`;
}
--- end lib/ab-testing.ts ---

Create the file `lib/posthog-server.ts` with exactly this content:

--- lib/posthog-server.ts ---
import { PostHog } from 'posthog-node';

/**
 * Create a PostHog server-side client.
 *
 * Returns a new instance each call — server functions in Next.js are
 * short-lived, so events must be sent immediately (flushAt: 1,
 * flushInterval: 0). Always call `await client.shutdown()` when done.
 */
export default function PostHogClient() {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return null;

  return new PostHog(key, {
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
    flushAt: 1,
    flushInterval: 0,
  });
}
--- end lib/posthog-server.ts ---

Every other A/B-testing file imports PH_BOOTSTRAP_COOKIE, CONTROL_VARIANT_KEY, and
getPostHogCookieName from `lib/ab-testing` — do not re-export them from anywhere else.

Verify:
1. `npx tsc --noEmit` passes. (These are pure setup modules — the typecheck is the whole
   verification for this step.)
2. Report the result.
````

### Prompt 3 — Variant route + exposure tracker

"Render the assigned variant and report exposure" is one capability. Two behaviours here are load-bearing: the **control-page-only rule** (a visitor navigating directly to a non-control variant's URL sees that page normally — never their assigned variant), and the **exposure event** — `$feature_flag_called` plus `register` super-properties are what make PostHog's experiment analysis attribute the visitor to a variant. The tracker is not optional.

````text
You are working in a Next.js App Router project (15.3+). Prerequisite: Prompt 2 has been
run — `lib/ab-testing.ts` exists and exports PH_BOOTSTRAP_COOKIE, CONTROL_VARIANT_KEY, and
getPostHogCookieName. If it does not exist, STOP and report it.

This project renders pages from Sanity "page" documents (or equivalents). You will need two
existing host helpers; find them before writing files and use their real import paths:
  - a Sanity fetch helper that runs a GROQ query with params (e.g. sanityFetch from
    next-sanity, or a client.fetch wrapper)
  - a function that loads one renderable page document by its slug (called
    fetchPageBySlug below)
If the project has nothing equivalent, STOP and report what is missing.

Create the file `sanity/queries/ab-test.ts` with this content:

--- sanity/queries/ab-test.ts ---
/**
 * The A/B test GROQ contract. Field names are fixed by the Studio plugin
 * (sanity-plugin-posthog-ab-testing). If you configured a custom schemaType,
 * change "posthogAbTest" below — nowhere else.
 */
export const AB_TEST_BY_SLUG_QUERY = `
  *[_type == "posthogAbTest" && enabled == true
    // && language == $language  // OPTIONAL: uncomment when using languageField,
                                 // and pass $language wherever this query runs
    && $slug in variants[].page->slug.current][0]{
    _id,
    name,
    posthogFlagKey,
    "variantMap": variants[]{
      "key": variantKey,
      "slug": page->slug.current
    }
  }
`;
--- end sanity/queries/ab-test.ts ---

Create the file `components/ab-test-tracker.tsx` with exactly this content:

--- components/ab-test-tracker.tsx ---
'use client';

import { useEffect, useRef } from 'react';
import posthog from 'posthog-js';

interface ABTestTrackerProps {
  flagKey: string;
  variant: string;
}

/**
 * Reports A/B test participation to PostHog.
 *
 * Sends `$feature_flag_called` so PostHog can attribute this user to a variant
 * in experiment analysis. Also sets super properties so all subsequent events
 * (CTA clicks, form views) carry the experiment context.
 *
 * NON-OPTIONAL: without this event PostHog silently drops the visitor from
 * experiment analysis.
 */
export function ABTestTracker({ flagKey, variant }: ABTestTrackerProps) {
  const tracked = useRef(false);

  useEffect(() => {
    if (!posthog.__loaded || tracked.current) return;
    tracked.current = true;

    // Tell PostHog which variant this user saw — the experiment exposure event
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

  return null;
}
--- end components/ab-test-tracker.tsx ---

Create the variant route at `app/test/[variant]/[...slug]/page.tsx`. IMPORTANT: if the
project's Sanity-driven pages live in a route group (e.g. `app/(main)/[slug]`), create it
inside the same group (`app/(main)/test/[variant]/[...slug]/page.tsx`) so variant pages get
the same layout. Content:

--- app/test/[variant]/[...slug]/page.tsx ---
import { cache } from 'react';
import { notFound } from 'next/navigation';
import { ABTestTracker } from '@/components/ab-test-tracker';
import { CONTROL_VARIANT_KEY } from '@/lib/ab-testing';
import { AB_TEST_BY_SLUG_QUERY } from '@/sanity/queries/ab-test';
// TODO(host): replace with this project's real Sanity fetch helper import.
import { sanityFetch } from '@/sanity/lib/fetch';
// TODO(host): replace with this project's real "load one page by slug" helper.
import { fetchPageBySlug } from '@/sanity/lib/fetch';

type ABTestParams = { variant: string; slug: string[] };

type ABTestResult = {
  posthogFlagKey: string | null;
  variantMap: { key: string | null; slug: string | null }[] | null;
} | null;

/** Decode the base64url-encoded flags parameter from the proxy rewrite. */
function decodeFlags(encoded: string): Record<string, string> {
  try {
    return JSON.parse(Buffer.from(encoded, 'base64url').toString('utf-8'));
  } catch {
    return {};
  }
}

/**
 * Convert the URL slug path to the format stored in Sanity's slug.current.
 * The homepage travels as '_home'; other pages store slugs without a leading
 * slash. TODO(host): adjust if this project stores slugs differently.
 */
function toSanitySlug(slugPath: string): string {
  return slugPath === '_home' ? '/' : slugPath;
}

/**
 * Resolve which page to display for this A/B test variant.
 * Wrapped with React.cache() to deduplicate across generateMetadata + render.
 */
const resolveVariantPage = cache(async (params: ABTestParams) => {
  const slugPath = params.slug.join('/');
  const flags = decodeFlags(params.variant);
  const pageSlug = toSanitySlug(slugPath);

  const abTest: ABTestResult = await sanityFetch({
    query: AB_TEST_BY_SLUG_QUERY,
    params: { slug: pageSlug },
  });

  // No active test for this slug — render the requested page normally
  if (!abTest?.variantMap || !abTest.posthogFlagKey) {
    const page = await fetchPageBySlug(pageSlug);
    return { page, slugPath, flagKey: null, variant: null };
  }

  // CONTROL-PAGE RULE: only apply A/B logic when the visitor requested the
  // control page. If they navigated directly to a non-control variant page,
  // render that page normally — never redirect them to their assigned variant.
  const controlEntry = abTest.variantMap.find((v) => v.key === CONTROL_VARIANT_KEY);
  const isControlPage = controlEntry?.slug === pageSlug;

  if (!isControlPage) {
    const page = await fetchPageBySlug(pageSlug);
    return { page, slugPath, flagKey: null, variant: null };
  }

  const flagValue = flags[abTest.posthogFlagKey];
  const variantEntry = abTest.variantMap.find((v) => v.key === flagValue);

  const resolvedSlug = variantEntry?.slug ?? controlEntry?.slug;
  const resolvedVariant = variantEntry && flagValue ? flagValue : CONTROL_VARIANT_KEY;

  if (!resolvedSlug) {
    const page = await fetchPageBySlug(pageSlug);
    return { page, slugPath, flagKey: null, variant: null };
  }

  const page = await fetchPageBySlug(resolvedSlug);
  return { page, slugPath, flagKey: abTest.posthogFlagKey, variant: resolvedVariant };
});

export async function generateMetadata(props: { params: Promise<ABTestParams> }) {
  const params = await props.params;
  const { page, slugPath } = await resolveVariantPage(params);
  if (!page) return {};
  const canonicalSlug = slugPath === '_home' ? '/' : slugPath;
  // TODO(host): build metadata from `page` with this project's metadata helper,
  // using canonicalSlug (the ORIGINAL requested URL) as the canonical — never
  // the variant page's own slug.
  return {};
}

export default async function ABTestPage(props: { params: Promise<ABTestParams> }) {
  const params = await props.params;
  const { page, flagKey, variant } = await resolveVariantPage(params);

  if (!page) notFound();

  return (
    <>
      {flagKey && variant && <ABTestTracker flagKey={flagKey} variant={variant} />}
      {/* TODO(host): render `page` with the exact component tree the normal
          page route uses (blocks renderer, structured data, etc.). */}
    </>
  );
}
--- end app/test/[variant]/[...slug]/page.tsx ---

Fill in every TODO(host) using this project's real helpers. Do not add redirects. Do not
"improve" the control-page rule — it is what makes direct navigation to variant URLs safe.

Verify:
1. `npx tsc --noEmit` passes.
2. `npm run dev`, then open http://localhost:3000/test/e30/<some-existing-page-slug>
   ("e30" is base64url for "{}" — no flags). The page renders exactly as it does at its
   normal URL. Repeat with /test/e30/_home for the homepage.
3. If a Sanity A/B test document exists with a control page: open
   /test/<flags>/<non-control-variant-slug> where <flags> assigns that experiment — the
   non-control page still renders AS ITSELF (control-page rule).
4. Report which checks passed and which TODO(host) substitutions you made.
````

### Prompt 4 — The proxy

This is the entry point: it reads the visitor's PostHog identity, evaluates their flags server-side, and rewrites control-page requests to the variant route — the URL never changes. Two behaviours here are load-bearing and easy to lose: the flag cache is **per-process and best-effort** (on serverless it resets per instance — it's a cost saver, never a correctness dependency), and the flags travel **base64url-encoded in the rewritten path** specifically so the variant route never makes a second flag call.

````text
You are working in a Next.js App Router project. Prerequisites: Prompt 2 has been
run — `lib/ab-testing.ts` (exporting PH_BOOTSTRAP_COOKIE and getPostHogCookieName) and
`lib/posthog-server.ts` (default-exporting PostHogClient) exist. Prompt 3 has been run —
the /test/[variant]/[...slug] route exists. If either is missing, STOP and report it.

Install dependencies:

  npm install posthog-node uuidv7

Required env (already set if Prompt 2 was verified): NEXT_PUBLIC_POSTHOG_KEY,
NEXT_PUBLIC_POSTHOG_HOST.

Create the file `proxy.ts` at the project root with exactly this content. If this project
is on Next.js <15.5, name the file `middleware.ts` and rename the exported function to
`middleware`. If a middleware/proxy already exists, merge this logic in AFTER any auth
or redirect logic and BEFORE any response is returned, keeping this file's matcher
exclusions.

--- proxy.ts ---
import { NextRequest, NextResponse } from 'next/server';
import { uuidv7 } from 'uuidv7';
import PostHogClient from '@/lib/posthog-server';
import { PH_BOOTSTRAP_COOKIE, getPostHogCookieName } from '@/lib/ab-testing';

export const config = {
  // Exclude static assets, images, files, the Studio, and API routes.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$|studio|api).*)',
  ],
};

// --- In-process flag cache ---
// Best-effort only: per-instance, resets on every deploy/restart, and on
// serverless each instance has its own copy. It exists to avoid one PostHog
// API call per navigation for the same visitor — correctness never depends
// on a hit. TTL 5 minutes, capped at 10k entries.
const FLAG_CACHE_TTL_MS = 5 * 60 * 1000;
const flagCache = new Map<
  string,
  { flags: Record<string, string | boolean>; expiresAt: number }
>();

function getCachedFlags(distinctId: string) {
  const entry = flagCache.get(distinctId);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    flagCache.delete(distinctId);
    return null;
  }
  return entry.flags;
}

function setCachedFlags(
  distinctId: string,
  flags: Record<string, string | boolean>,
) {
  if (flagCache.size > 10000) {
    const firstKey = flagCache.keys().next().value;
    if (firstKey) flagCache.delete(firstKey);
  }
  flagCache.set(distinctId, { flags, expiresAt: Date.now() + FLAG_CACHE_TTL_MS });
}

/** Read distinct_id from PostHog's own cookie (ph_<project_key>_posthog). */
function getDistinctId(request: NextRequest): string | null {
  const phCookie = request.cookies.get(getPostHogCookieName())?.value;
  if (!phCookie) return null;
  try {
    return JSON.parse(phCookie).distinct_id ?? null;
  } catch {
    return null;
  }
}

/** Any path segment containing a dot is a file (sitemap.xml, robots.txt, ...). */
function isFileLikePath(pathname: string): boolean {
  return pathname.split('/').some((segment) => segment.includes('.'));
}

/**
 * Denylist: which routes participate in A/B testing. File-like paths and
 * dedicated route trees are excluded; everything else is treated as an
 * eligible Sanity-driven page route. /studio and /api are already excluded
 * by config.matcher.
 */
function isAbTestEligible(pathname: string): boolean {
  if (isFileLikePath(pathname)) return false;

  // TODO(host): list every route tree that is NOT rendered from Sanity page
  // documents (e.g. '/blog', '/search', '/account'). '/test' must always be
  // listed — it is the variant route itself.
  const dedicatedRoutes = ['/test'];
  for (const route of dedicatedRoutes) {
    if (pathname === route || pathname.startsWith(`${route}/`)) return false;
  }
  return true;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const requestHeaders = new Headers(request.headers);

  if (!isAbTestEligible(pathname)) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  // --- Identity: reuse PostHog's cookie, or mint a uuidv7 for new visitors ---
  let distinctId = getDistinctId(request);
  const isNewUser = !distinctId;
  if (!distinctId) distinctId = uuidv7();
  requestHeaders.set('x-ph-distinct-id', distinctId);

  // --- Evaluate flags server-side (cache first) ---
  let flags: Record<string, string | boolean> = {};
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
        // Flag evaluation failed — serve the page without A/B testing.
      } finally {
        await posthog.shutdown();
      }
    }
  }

  // Multivariate experiment flags return variant strings; boolean flags are
  // ordinary feature flags and are ignored here.
  const experimentFlags: Record<string, string> = {};
  for (const key of Object.keys(flags).sort()) {
    const value = flags[key];
    if (typeof value === 'string') experimentFlags[key] = value;
  }

  const bootstrapPayload = JSON.stringify({
    distinctID: distinctId,
    featureFlags: flags,
  });
  const bootstrapCookie = {
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 60 * 5,
  };

  // --- Rewrite (never redirect) to the variant route ---
  // Flags ride base64url-encoded in the path so the variant route makes no
  // second PostHog call, and so the rewritten URL is a stable cache key.
  if (Object.keys(experimentFlags).length > 0) {
    const url = request.nextUrl.clone();
    const slug = pathname === '/' ? '_home' : pathname.slice(1);
    const flagsParam = Buffer.from(JSON.stringify(experimentFlags)).toString('base64url');
    url.pathname = `/test/${flagsParam}/${slug}`;

    const response = NextResponse.rewrite(url, { request: { headers: requestHeaders } });
    response.cookies.set(PH_BOOTSTRAP_COOKIE, bootstrapPayload, bootstrapCookie);
    return response;
  }

  // --- No experiment flags: pass through, still bootstrap the client ---
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  if (Object.keys(flags).length > 0 || isNewUser) {
    response.cookies.set(PH_BOOTSTRAP_COOKIE, bootstrapPayload, bootstrapCookie);
  }
  return response;
}
--- end proxy.ts ---

Do not add locale handling, redirects, or extra cookies to this file. Do not change the
rewrite to a redirect — the visitor's URL must never change.

Verify:
1. `npx tsc --noEmit` passes.
2. `npm run dev`, then `curl -sI http://localhost:3000/robots.txt` — response has no
   `set-cookie: ph_bootstrap` header (file-like paths are exempt).
3. `curl -sI http://localhost:3000/` — response HAS a `set-cookie: ph_bootstrap=...`
   header containing `distinctID` (new visitor bootstrap).
4. With a running PostHog experiment whose control page slug exists in Sanity: open the
   control URL in an incognito window. The address bar shows the control URL, the content
   is the assigned variant's page, and DevTools → Application shows the ph_bootstrap
   cookie with a string-valued entry for the experiment's flag key.
5. Report which checks passed and paste the ph_bootstrap cookie value from check 3.
````

### Prompt 5 — Client bootstrap

The anti-flicker half. The proxy wrote `ph_bootstrap`; this file reads it and hands it to `posthog.init` as the `bootstrap` option, so the client starts with the *same* flags the server rendered with — no flicker, no client re-evaluation drift. The `bootstrap` option is the load-bearing line; the rest is ordinary PostHog config.

````text
You are working in a Next.js App Router project (15.3+ — instrumentation-client.ts requires
it). Prerequisite: Prompt 2 has been run (`lib/ab-testing.ts` exists). If this project
already initialises posthog-js somewhere (instrumentation-client.ts, a provider component,
or a layout), MERGE the bootstrap logic below into that init instead of creating a second
init — posthog.init must run exactly once.

Install dependencies (if not present):

  npm install posthog-js

Create (or merge into) the file `instrumentation-client.ts` at the project root:

--- instrumentation-client.ts ---
import posthog from 'posthog-js';
import { PH_BOOTSTRAP_COOKIE } from '@/lib/ab-testing';

// instrumentation-client.ts only runs in the browser (Next.js 15.3+)
// — no `typeof window` guard needed.

// Read bootstrapped flags + distinctID from the proxy's cookie
let bootstrap:
  | {
      distinctID?: string;
      featureFlags?: Record<string, string | boolean>;
    }
  | undefined;

try {
  const cookies = document.cookie.split('; ');
  const bootstrapCookie = cookies.find((c) =>
    c.startsWith(`${PH_BOOTSTRAP_COOKIE}=`),
  );
  if (bootstrapCookie) {
    bootstrap = JSON.parse(
      decodeURIComponent(bootstrapCookie.split('=').slice(1).join('=')),
    );
  }
} catch {
  // Invalid cookie — proceed without bootstrap
}

if (process.env.NEXT_PUBLIC_POSTHOG_KEY) {
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
    api_host:
      process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
    defaults: '2026-01-30',
    capture_pageview: 'history_change',
    capture_pageleave: true,
    persistence: 'localStorage+cookie',
    debug: process.env.NODE_ENV === 'development',
    ...(bootstrap && { bootstrap }),
  });
}
--- end instrumentation-client.ts ---

If merging into an existing init: keep the existing options and add ONLY the cookie-read
block and the `...(bootstrap && { bootstrap })` spread. The `bootstrap` option is the
entire point of this file.

Verify:
1. `npx tsc --noEmit` passes.
2. `npm run dev`, load http://localhost:3000/ in a browser, and in the console run
   `document.cookie.includes('ph_bootstrap')` → true, and
   `posthog.get_distinct_id()` → equals the `distinctID` value inside the ph_bootstrap
   cookie (client and server agree on identity).
3. With a running experiment: `posthog.getFeatureFlag('<flag-key>')` in the console returns
   the same variant string that appears in the ph_bootstrap cookie — with NO extra
   /decide network request needed before it resolves.
4. Human check (cannot be automated): with a running experiment, reload the control page —
   the variant content is correct on first paint, with no flash of control content.
5. Report which checks passed.
````

## 9. Verify the full loop

The definition of "working". With a **running** PostHog experiment whose `control` variant maps to an existing page:

1. **Incognito visit to the control page** shows the assigned variant's content with the **URL unchanged** (rewrite, not redirect).
2. **`ph_bootstrap` cookie** is present, containing `distinctID` and a string-valued entry for the experiment's flag key.
3. **Exactly one `$feature_flag_called`** event appears in the network tab, with `$feature_flag` and a matching `$feature_flag_response`.
4. **Direct navigation to a non-control variant's own slug** renders that page normally (control-page rule).
5. **No content flicker on first paint** (bootstrap working).

If any point fails, the prompt that owns that behaviour (1–2: Prompt 4; 3: Prompt 3; 4: Prompt 3; 5: Prompt 5) is where to look.

## Appendix A — Optional: devtools overlay

Not for production. This panel is the only way to QA an assignment without burning your own bucket: override a flag, clear overrides, reset identity, and inspect the bootstrap cookie. Gate it however you gate internal tooling (env flag, cookie, non-production build) — the prompt defaults to development-only.

````text
You are working in a Next.js App Router project. Prerequisites: Prompts 2 and 5 have been
run (`lib/ab-testing.ts` exists; posthog-js is initialised). If not, STOP and report it.

Create the file `components/ab-test-devtools.tsx` with exactly this content:

--- components/ab-test-devtools.tsx ---
'use client';

import { useCallback, useEffect, useState } from 'react';
import posthog from 'posthog-js';
import {
  CONTROL_VARIANT_KEY,
  PH_BOOTSTRAP_COOKIE,
  getPostHogCookieName,
} from '@/lib/ab-testing';

interface ABTestInfo {
  distinctId: string | null;
  flags: Record<string, string>;
  posthogLoaded: boolean;
  activeTest: { flagKey: string; variant: string } | null;
}

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.split('; ').find((row) => row.startsWith(`${name}=`));
  return match ? match.split('=')[1] : null;
}

function deleteCookie(name: string) {
  document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}

const panel: React.CSSProperties = {
  background: '#1a1a2e',
  color: '#e0e0e0',
  border: '1px solid #333',
  borderRadius: 12,
  padding: 16,
  width: 360,
  maxHeight: '90vh',
  overflowY: 'auto',
  fontFamily: 'monospace',
  fontSize: 13,
  boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
};
const label: React.CSSProperties = { color: '#888', marginBottom: 4, fontSize: 11 };
const section: React.CSSProperties = { marginBottom: 12 };
const mono: React.CSSProperties = {
  fontSize: 11,
  wordBreak: 'break-all',
  background: '#111',
  padding: 6,
  borderRadius: 4,
};
const input: React.CSSProperties = {
  flex: 1,
  padding: '4px 8px',
  borderRadius: 4,
  border: '1px solid #444',
  fontSize: 12,
  fontFamily: 'monospace',
  background: '#111',
  color: '#e0e0e0',
};
const btn = (background: string): React.CSSProperties => ({
  border: 'none',
  borderRadius: 4,
  cursor: 'pointer',
  fontSize: 12,
  background,
  color: 'white',
  padding: '6px 12px',
  flex: 1,
});

export function ABTestDevtools() {
  const [isOpen, setIsOpen] = useState(false);
  const [info, setInfo] = useState<ABTestInfo>({
    distinctId: null,
    flags: {},
    posthogLoaded: false,
    activeTest: null,
  });
  const [overrideFlag, setOverrideFlag] = useState('');
  const [overrideVariant, setOverrideVariant] = useState('');

  useEffect(() => {
    // Read distinct_id from PostHog's own cookie
    let distinctId: string | null = null;
    const phCookie = getCookie(getPostHogCookieName());
    if (phCookie) {
      try {
        distinctId = JSON.parse(decodeURIComponent(phCookie)).distinct_id;
      } catch {}
    }

    // Read bootstrapped flags from the proxy cookie
    const bootstrapCookie = getCookie(PH_BOOTSTRAP_COOKIE);
    const flags: Record<string, string> = {};
    try {
      if (bootstrapCookie) {
        const parsed = JSON.parse(decodeURIComponent(bootstrapCookie));
        for (const [key, value] of Object.entries(parsed.featureFlags ?? {})) {
          if (typeof value === 'string') flags[key] = value;
        }
      }
    } catch {}

    // Check for an active test from super properties
    const superProps = posthog.__loaded ? (posthog.persistence?.properties?.() ?? {}) : {};
    const activeTest =
      superProps.ab_test_flag && superProps.ab_variant
        ? { flagKey: superProps.ab_test_flag, variant: superProps.ab_variant }
        : null;

    setInfo({ distinctId, flags, posthogLoaded: !!posthog.__loaded, activeTest });
  }, []);

  const handleOverride = useCallback(() => {
    if (!overrideFlag || !overrideVariant || !posthog.__loaded) return;
    posthog.featureFlags.override({ [overrideFlag]: overrideVariant });
    window.location.reload();
  }, [overrideFlag, overrideVariant]);

  const handleClearFlags = () => {
    if (posthog.__loaded) posthog.featureFlags.override(false);
    deleteCookie(PH_BOOTSTRAP_COOKIE);
    window.location.reload();
  };

  const handleResetIdentity = () => {
    deleteCookie(getPostHogCookieName());
    deleteCookie(PH_BOOTSTRAP_COOKIE);
    if (posthog.__loaded) posthog.reset();
    window.location.reload();
  };

  if (!isOpen) {
    return (
      <div style={{ position: 'fixed', bottom: 16, right: 16, zIndex: 99999 }}>
        <button onClick={() => setIsOpen(true)} style={{ ...panel, width: 'auto', padding: '8px 12px', cursor: 'pointer' }}>
          A/B [{info.activeTest?.variant ?? '—'}]
        </button>
      </div>
    );
  }

  return (
    <div style={{ position: 'fixed', bottom: 16, right: 16, zIndex: 99999 }}>
      <div style={panel}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
          <strong>A/B Test Devtools</strong>
          <button
            onClick={() => setIsOpen(false)}
            style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 16 }}
          >
            x
          </button>
        </div>

        <div style={{ ...label, marginBottom: 10 }}>
          PostHog: {info.posthogLoaded ? 'Connected' : 'Not loaded'}
        </div>

        <div style={section}>
          <div style={label}>Distinct ID</div>
          <div style={mono}>{info.distinctId || '—'}</div>
        </div>

        {info.activeTest ? (
          <div style={{ ...section, ...mono, padding: 12 }}>
            <div style={label}>Active Experiment</div>
            <div style={{ fontWeight: 'bold', marginBottom: 4 }}>{info.activeTest.flagKey}</div>
            <span
              style={{
                padding: '3px 10px',
                borderRadius: 4,
                fontWeight: 'bold',
                background:
                  info.activeTest.variant === CONTROL_VARIANT_KEY ? '#4a3a2d' : '#2d4a2d',
                color: info.activeTest.variant === CONTROL_VARIANT_KEY ? '#cfaa6f' : '#6fcf6f',
              }}
            >
              {info.activeTest.variant}
            </span>
          </div>
        ) : (
          <div style={{ ...section, color: '#666', fontStyle: 'italic', textAlign: 'center' }}>
            No active A/B test on this page
          </div>
        )}

        {Object.keys(info.flags).length > 0 && (
          <div style={section}>
            <div style={label}>PostHog Feature Flags</div>
            <div style={{ ...mono, padding: 8 }}>
              {Object.entries(info.flags).map(([key, value]) => (
                <div key={key} style={{ marginBottom: 2 }}>
                  <span style={{ color: '#6fcf6f' }}>{key}</span>: {value}
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ borderTop: '1px solid #333', marginBottom: 12, paddingTop: 12 }}>
          <strong style={{ fontSize: 11, color: '#aaa' }}>CONTROLS</strong>
        </div>

        <div style={section}>
          <div style={label}>Override Feature Flag</div>
          <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
            <input
              type="text"
              value={overrideFlag}
              onChange={(e) => setOverrideFlag(e.target.value)}
              placeholder="flag-key"
              style={input}
            />
            <input
              type="text"
              value={overrideVariant}
              onChange={(e) => setOverrideVariant(e.target.value)}
              placeholder="variant"
              style={input}
            />
          </div>
          <button onClick={handleOverride} style={{ ...btn('#2563eb'), width: '100%' }}>
            Override & Reload
          </button>
        </div>

        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={handleClearFlags} style={btn('#7c3aed')}>
            Clear Flag Overrides
          </button>
          <button onClick={handleResetIdentity} style={btn('#dc2626')}>
            Reset Identity
          </button>
        </div>
      </div>
    </div>
  );
}
--- end components/ab-test-devtools.tsx ---

Mount it development-only in the root layout (adjust the path to this project's root
layout):

  {process.env.NODE_ENV === 'development' && <ABTestDevtools />}

Verify:
1. `npx tsc --noEmit` passes.
2. `npm run dev`, open any page — the "A/B [—]" button appears bottom-right; opening it
   shows the distinct id and (if the proxy is live) the bootstrapped flags.
3. Enter a real experiment flag key and any variant key, press "Override & Reload" — the
   page reloads showing that variant's content. "Clear Flag Overrides" restores the real
   assignment. "Reset Identity" produces a new distinct id on reload.
4. Report which checks passed.
````

## Appendix B — Non-obvious behaviours & limitations

- **The proxy's flag cache is per-instance and best-effort.** It resets on every deploy/restart, and on serverless every instance has its own copy. It only saves PostHog API calls; correctness never depends on a hit.
- **Cache-key cardinality.** `getAllFlags(distinctId)` evaluates *all* flags per visitor, and the rewritten path embeds *all* string-valued flags — so unrelated multivariate flags inflate the set of distinct `/test/<flags>/…` URLs (CDN cache keys) and can route traffic through the variant path with no experiment running. This 1:1 reproduction keeps the proven behaviour; the upgrade path, verbatim, when it bites: *filter the experiments list on `metadata.has_experiment`, and scope evaluation with `evaluateFlags(distinctId, {flagKeys})` so only experiment flags are evaluated and encoded.* That version requires knowing your experiment flag keys inside the proxy (a Sanity fetch or config) and has not been battle-tested — which is why it is an appendix, not the prompt.
- **The `ph_bootstrap` cookie lives 5 minutes** (`maxAge: 300`). A visitor whose assignment changes in PostHog can see up to 5 minutes of staleness; the client also re-syncs on init.
- **`$feature_flag_called` dedup.** posthog-js deduplicates repeated identical exposure events per session; if your exposure counts look low, check the `advanced_feature_flags_dedup_per_session` project setting before suspecting the tracker.
- **Server-side flag evaluation costs ~225ms** on a cold call (PostHog's own figure for the flags endpoint). The per-instance cache exists to amortise this; it is the latency you pay on the first eligible navigation per visitor per instance.
- **Rate limit:** PostHog's private API allows 480 requests/min shared across your organization. The plugin fetches only on document-open and manual reload; keep it that way in your fetcher (no polling).

## Appendix C — Prior art we rejected and why

- **Storing the PostHog personal API key in the Studio** (e.g. via `@sanity/studio-secrets`): a personal API key in a browser context is an org-wide secret exposure. The server route (Part 1) exists precisely to keep `phx_…` server-side.
- **Local hashing to assign variants** (hash the distinct_id, skip the PostHog call): assignment then drifts from PostHog's own bucketing — analysis attributes visitors to variants they never saw. PostHog must stay the single assignment authority.
- **`targetRoute` string fields with match types**: a string route duplicates what the control page reference already encodes, silently drifts when slugs change, and pattern-matching grows hardcoded special cases. The derived model (control variant's slug *is* the target) cannot drift.

## License / Develop

[MIT](LICENSE) © [Roboto Studio](https://robotostudio.com)

This plugin was extracted from a production implementation and its decisions are documented in `docs/decisions/`.

Built with [@sanity/plugin-kit](https://github.com/sanity-io/plugins/tree/main/packages/@sanity/plugin-kit).

```sh
npm install        # install dependencies
npm run build      # verify-package + pkg-utils build
npm test           # vitest (exports snapshot + one test per config key)
npm run typecheck  # tsc --noEmit
npm run lint       # oxlint
```

To develop against a real studio, use [`npm run link-watch`](https://github.com/sanity-io/plugins/tree/main/packages/@sanity/plugin-kit#developing-the-plugin) and `npx yalc add sanity-plugin-posthog-ab-testing` in the studio.
