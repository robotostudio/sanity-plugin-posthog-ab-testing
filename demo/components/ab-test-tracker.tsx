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
    // No __loaded guard: posthog-js queues capture/register calls made before
    // init completes. Guarding on __loaded silently dropped the exposure event
    // on first page load (the effect never re-runs when loading finishes).
    if (tracked.current) return;
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
