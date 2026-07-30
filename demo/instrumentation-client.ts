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
    capture_exceptions: true,
    capture_pageview: 'history_change',
    capture_pageleave: true,
    persistence: 'localStorage+cookie',
    debug: process.env.NODE_ENV === 'development',
    ...(bootstrap && { bootstrap }),
  });
}
