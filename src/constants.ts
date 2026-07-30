/**
 * Internal constants. Deliberately NOT exported from the package: the plugin
 * exports no runtime constants or helpers (ROB-2469 soft-edge ruling 1).
 * The runtime prompts in the README state these once in the shared
 * `lib/ab-testing.ts` module.
 */

/**
 * PostHog fixes the first experiment variant's key as `control`; it is a
 * convention of PostHog's experiment UI, never configurable here.
 */
export const CONTROL_VARIANT_KEY = 'control'

/** definePlugin name string, pinned by the exports-snapshot test. */
export const PLUGIN_NAME = 'posthog-ab-testing'
