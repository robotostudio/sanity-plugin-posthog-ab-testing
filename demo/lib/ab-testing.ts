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
