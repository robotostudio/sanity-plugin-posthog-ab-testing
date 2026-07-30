# ROB-2474 — README prompt format and prompt set: decided

Source refs are `BabelStreet/sanity-babel-street` @ `1b9a164`. Builds on the frozen ROB-2469 inventory (all eight runtime files → prompts, `lib/ab-testing.ts` is the one shared module) and the ROB-2472 config/type freeze.

## Decision in one line

Ship **six prompts grouped per-capability**, each a **single self-contained fenced block ending in an executable `Verify:` section**, ordered so the host app **compiles and has a checkable behaviour after every prompt**, with the personal-API-key route as Prompt 1 leading the README and the devtools as an optional appendix.

## 1. The prompt set: six, per-capability — not per-file, not a mega-prompt

| # | Prompt | Files it creates | Why it's one unit |
|---|---|---|---|
| 1 | **Experiments API route** (prerequisite — leads the README) | `app/api/posthog/experiments/route.ts` | The plugin is unusable without it (posthog-js#3593: no project-token or SDK path to experiment metadata — confirmed in rob2470 research). Runs *before* plugin install. |
| 2 | **Shared runtime foundations** | `lib/ab-testing.ts`, `lib/posthog-server.ts` | 21 + 25 lines of pure setup with no observable behaviour of their own; splitting them would create two prompts whose only Verify is "it typechecks". `lib/ab-testing.ts` stays the single source of `PH_BOOTSTRAP_COOKIE`/`getPostHogCookieName()` that every later prompt imports (ROB-2469 soft-edge ruling 1). |
| 3 | **Variant route + exposure tracker** | `app/(main)/test/[variant]/[...slug]/page.tsx`, `components/ab-test-tracker.tsx`, `sanity/queries/ab-test.ts` (GROQ) | The route imports the tracker (page.tsx line 12), and "render the assigned variant + report exposure" is one capability. The tracker's non-optionality (`$feature_flag_called` + `register`, tracker lines 26–35 — without it PostHog silently drops users from analysis) is stated in this prompt's prose, per ROB-2469. |
| 4 | **The proxy** (hardest — drafted in full below) | `proxy.ts` | Flag eval, cache, rewrite, bootstrap cookie. |
| 5 | **Client bootstrap** | `instrumentation-client.ts` | Reads the cookie prompt 4 writes; the anti-flicker/anti-drift half (rob2470 "Mitigation already in place"). Written as "merge into your existing `posthog.init` if you have one" — the `bootstrap` option is the load-bearing line, the rest of the config is Babel's defaults. |
| 6 | **Devtools overlay** (Appendix A, optional, non-production) | `components/ab-test-devtools.tsx` | Per ROB-2469: kept, optional, clearly gated. Required edit applied: the variant `<select>` hardcoding `control`/`test` (devtools 321–323) becomes a free-text input. Inline styling shrunk from ~250 lines to ~60 (one style object per surface); function list — override (85–89), clear overrides (91–97), reset identity (99–107), cookie/flag inspector — kept 1:1. |

**Rejected: one prompt per file (8 prompts).** Files 9+10 and 6+7 pair naturally; per-file granularity produces prompts with no independently checkable behaviour and doubles the reader's step count against Jono's "extremely concise" brief.

**Rejected: one mega-prompt.** Three reasons: (a) partial adoption is the common case — a host that already runs posthog-js needs to *skip* most of prompt 5, and a host with an existing middleware needs to *merge* prompt 4, which an agent can only do when the prompts are separable; (b) placeholders (`TODO(host)` page fetchers, denylist routes) need human input between steps; (c) it reproduces upstream's exact failure mode at larger scale — their non-self-contained Step 4 fragment is the documented anti-pattern (rob2470 lesson #7), and a mega-prompt is one giant fragment with internal implicit dependencies.

## 2. Ordering: compile-at-every-step, verify-at-every-step

```
Part 1  Prompt 1 (API route)        → curl check: JSON matches PostHogExperiment[]
Part 2  Plugin install + config     → experiment dropdown populates in Studio
Part 3  Prompt 2 (foundations)      → typecheck only (stated honestly)
        Prompt 3 (variant route)    → manually navigate to /test/e30/<slug>  (e30 = base64url of {})
                                      → page renders normally; control-page rule testable directly
        Prompt 4 (proxy)            → full loop: incognito visit → variant content, URL unchanged
        Prompt 5 (bootstrap)        → no flicker; client flags === server flags in one reload
Verify  End-to-end checklist (feeds ROB-2476)
Appendix A  Prompt 6 (devtools)
```

The deliberate inversion: **variant route before proxy**. The natural narrative order (proxy first — it's the entry point) leaves prompt 4 unverifiable: the rewrite targets a route that doesn't exist yet, so a running experiment would 404. Reversed, the variant route is *directly navigable* (`/test/e30/pricing` with `e30` = base64url `{}` renders `/pricing` normally — page.tsx `decodeFlags` fallback, lines 53–60), so prompt 3 gets a real check including the control-page-only gate, and prompt 4's check becomes the genuine end-to-end loop.

**Plugin install sits between prompts 1 and 2** because the Studio experience (dropdown populates, sync status, ended-experiment card) is the first moment the reader sees value, and it only needs prompt 1. Getting a working Studio before writing any runtime code is the motivation payment that funds the four remaining prompts.

## 3. Format: one fenced block per prompt = the entire agent input

Each prompt is:

1. **2–3 sentences of human prose above the fence** — what capability this adds and the one non-obvious behaviour that must survive. This is where the map's three at-risk behaviours live, attached to the prompt that implements each: per-instance best-effort flag cache (prompt 4), base64url flags-in-path to avoid a second flag call (prompt 4), control-page-only rule (prompt 3).
2. **A single ```text fenced block** the reader copies wholesale into a coding agent. Inside, in order: assumption guard ("This is a Next.js App Router 15.3+ project. If `lib/ab-testing.ts` does not exist, stop — run Prompt 2 first."), install line, env vars, "Create file `<path>` with this content:" + complete bare-metal code, `TODO(host)` placeholders each with a one-line fill-in instruction, and a trailing **`Verify:`** list of checks the agent can execute itself (typecheck, curl, dev-server request, cookie assertion).
3. Nothing else. No numbered human steps duplicating the fence; the prose and the fence never disagree because the fence is the only copy of the instructions.

**Assumptions stated once, up front** — a "Runtime contract" prose section before Part 3 (rob2470 lesson #12): the prompts are written for Next.js App Router 15.3+ (that's what `proxy.ts` and `instrumentation-client.ts` *are*), but the contract any framework must satisfy is stated framework-agnostically first: (a) server reads distinct_id from `ph_<project_key>_posthog`, minting uuidv7 if absent; (b) server evaluates flags and rewrites — never redirects — control-page requests to a variant-rendering route, carrying flags in the request rather than re-fetching; (c) server sets `ph_bootstrap` = `{distinctID, featureFlags}` (maxAge 300); (d) client inits posthog-js with that payload as `bootstrap`; (e) client fires `$feature_flag_called` exactly once per view with `$feature_flag`/`$feature_flag_response`.

**Rejected: prompts as repo files (`/prompts/*.md`) or a docs site.** The README *is* the runtime deliverable per the locked decision; a second location creates drift surface identical to the upstream `growthbook.md`/`launchdarkly.md` divergence documented in rob2470 lesson #10. README-inline only for v1.

## 4. Divergences from Babel baked into the prompts

- **Prompt 1** is rewritten against the frozen camelCase `PostHogExperiment` type ("return `PostHogExperiment[]` as exported by the plugin" — ROB-2469 file 12), not Babel's snake_case response. It fetches **without** a `status` filter — the plugin's ended-experiment critical card (ExperimentSelect 219–231) needs completed experiments in the list; `status=running` (suggested in the research) would silently kill that feature. It maps `stopped→complete` per ROB-2472. Babel's hardcoded CORS allowlist (route.ts 3–7) becomes `SANITY_STUDIO_ORIGINS` (comma-separated env var).
- **Prompt 4** drops the entire locale system (proxy 57–96, 156–177, locale cookie writes), the markdown content-negotiation block (179–200), and Babel's `dedicatedRoutes` contents (134–143 → `TODO(host)` placeholder). Per ROB-2469's drop list.
- **Prompt 4 keeps `getAllFlags`** and documents the cache-key-cardinality caveat as a limitation instead of shipping the research-suggested `evaluateFlags` + published-flag-keys scoping. Reasons: the scoped version requires a Sanity fetch inside edge middleware (new token, new coupling, new failure mode) and has never run anywhere, while the map's mandate is 1:1 reproduction of proven code; untested code in a copy-paste prompt is worse than a documented limitation. The upgrade path (filter on `metadata.has_experiment`, scope with `evaluateFlags(distinctId, {flagKeys})`) is written into Appendix B verbatim so it isn't lost. *(Flagged to Jono — see below.)*
- **Prompt 3's GROQ query** ships with the ROB-2472 fixed field names (`posthogFlagKey`, `variantMap` with `key`/`slug`) and a commented-out `languageField` filter line the reader uncomments when using i18n.
- **Prompt 6** genericizes the variant select and shrinks styling, per ROB-2469's delegation.

## 5. Verification story (feeds ROB-2476)

Three layers:

1. **Per-prompt `Verify:` blocks** — executable by the agent that ran the prompt, no human judgment needed except prompt 5's flicker check. Prompt 2's is honestly just `tsc --noEmit`.
2. **"Verify the full loop"** — a five-point human checklist closing Part 3, which is the README's definition of working: (a) incognito visit to the control page shows assigned-variant content with the **URL unchanged** (rewrite, not redirect); (b) `ph_bootstrap` cookie present with `distinctID` + string-valued flag; (c) exactly one `$feature_flag_called` in the network tab with matching `$feature_flag_response`; (d) direct navigation to a non-control variant's own slug renders that page normally (control-page-only rule); (e) no content flicker on first paint (bootstrap working).
3. **ROB-2476's job, defined here:** execute prompts 1–5 verbatim with a coding agent against a fresh `create-next-app` + minimal Sanity page schema, then run checklist (2). The prompts are the spec; if the executed output fails the checklist, the prompt is the bug. Re-run on any prompt edit — this is CI-of-the-docs, and it's why every `Verify:` block was written to be agent-executable.

## 6. Full README outline

```
sanity-plugin-posthog-ab-testing
├─ 1  What it is (1 para) + how it works (diagram: PostHog assigns → proxy rewrites → Sanity maps)
│     + ownership table: PostHog owns split/targeting/scheduling · Sanity owns variant-key→page + kill switch
├─ 2  What this plugin does NOT do (lesson #8: field-level, stats, dashboards, exposure tracking in-plugin)
├─ 3  Requirements (Studio v5/v6, ESM-only; prompts target Next.js App Router 15.3+ — contract is portable)
├─ 4  PART 1 — Prerequisite: the experiments API route          ← PROMPT 1 leads; cites posthog-js#3593;
│     env table: POSTHOG_PERSONAL_API_KEY (phx_), POSTHOG_PROJECT_ID, SANITY_STUDIO_ORIGINS
├─ 5  PART 2 — Install & configure the Studio plugin (config keys per ROB-2472, screenshots walkthrough)
├─ 6  Stored document shape + the GROQ contract (fixed field names)
├─ 7  The runtime contract (framework-agnostic prose: cookies, bootstrap payload, rewrite scheme,
│     control-page rule, exposure requirement)
├─ 8  PART 3 — Build the runtime                                 ← PROMPTS 2–5 in order
├─ 9  Verify the full loop (5-point checklist — the definition of working; ROB-2476 automates this)
├─ A  Appendix A — Optional: devtools overlay                    ← PROMPT 6
├─ B  Appendix B — Non-obvious behaviours & limitations (per-instance best-effort cache; cache-key
│     cardinality + the evaluateFlags upgrade path; 5-min cookie TTL; $feature_flag_called dedup +
│     advanced_feature_flags_dedup_per_session; ~225ms flag-call latency figure)
├─ C  Prior art we rejected and why (studio-secrets browser-key flow; local hashing; targetRoute strings)
└─ D  License / Develop
```

## 7. The exemplar: Prompt 4 (the proxy), drafted in full

*Prose framing (appears above the fence):*

> This is the entry point: it reads the visitor's PostHog identity, evaluates their flags server-side, and rewrites control-page requests to the variant route — the URL never changes. Two behaviours here are load-bearing and easy to lose: the flag cache is **per-process and best-effort** (on serverless it resets per instance — it's a cost saver, never a correctness dependency), and the flags travel **base64url-encoded in the rewritten path** specifically so the variant route never makes a second flag call.

````text
You are working in a Next.js App Router project (15.3+). Prerequisites: Prompt 2 has been
run — `lib/ab-testing.ts` (exporting PH_BOOTSTRAP_COOKIE and getPostHogCookieName) and
`lib/posthog-server.ts` (default-exporting PostHogClient) exist. Prompt 3 has been run —
the /test/[variant]/[...slug] route exists. If either is missing, STOP and report it.

Install dependencies:

  npm install posthog-node uuidv7

Required env (already set if Prompt 2 was verified): NEXT_PUBLIC_POSTHOG_KEY,
NEXT_PUBLIC_POSTHOG_HOST.

Create the file `proxy.ts` at the project root with exactly this content. If this project
is on Next.js <15.3, name it `middleware.ts` and rename the exported function to
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

## 8. Rejected alternatives (summary)

- **One prompt per file (8)** — no independent Verify for the four tiny files; step-count bloat against the brief.
- **Single mega-prompt** — kills partial adoption/merging, blocks human placeholder input mid-flow, un-verifiable incrementally.
- **Numbered human steps with inline snippets** — the brief says agent-executable prompts; two copies of the instructions (prose + code) is the upstream drift pattern.
- **Prompts in `/prompts/*.md` or a docs site** — second source of truth; README is the locked deliverable.
- **`status=running` filter in the route prompt** — would break the plugin's ended-experiment critical card.
- **Baking the `evaluateFlags`/`has_experiment` scoping into prompt 4 now** — unproven code in a copy-paste prompt; shipped as Appendix B upgrade path instead (flagged to Jono as the one judgment call worth a second look).
- **Proxy-first ordering** — leaves prompt 4 with a 404 during verification; variant-route-first exploits direct navigability of `/test/e30/<slug>`.


---

## Amendments after adversarial audit (2026-07-30)

**1. Next.js version floors corrected.** `proxy.ts` (the file-name convention prompt 4 relies on) requires **Next.js 15.5+**; `instrumentation-client.ts` (prompt 5) requires **15.3+**. Prompt 4's guard becomes: "If this project is on Next.js <15.5, name the file `middleware.ts` and export `middleware`." README §3 states both floors explicitly.

**2. `CONTROL_VARIANT_KEY` handoff from ROB-2472 adopted.** Prompt 2's `lib/ab-testing.ts` gains `export const CONTROL_VARIANT_KEY = 'control'`; prompts 3, 6 (and 4 where needed) import it instead of repeating the literal. ROB-2472 §5's "stated once in the shared lib prompt" ruling now holds.

**3. Undeclared divergence declared.** The exemplar proxy prompt iterates `Object.keys(flags).sort()` where Babel iterates insertion order (`proxy.ts:241–246`). Kept deliberately — a deterministic rewrite path is a stable CDN cache key — and now listed in §4's divergence list with that rationale.

**4. Type-contract clarification (shared with ROB-2469).** Prompt 1's host route returns `PostHogExperiment[]` by **inlining the type literally** (a local declaration with a comment naming the plugin export it mirrors). Host runtime code never imports from the plugin package; the exports-snapshot test plus the smoke test keep the two declarations aligned.
