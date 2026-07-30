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

  // TODO(host) filled: '/' is this demo's static (non-Sanity) landing page;
  // '/test' must always be listed — it is the variant route itself.
  const dedicatedRoutes = ['/test', '/'];
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
