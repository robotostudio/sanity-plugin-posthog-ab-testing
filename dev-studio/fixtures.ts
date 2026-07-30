import type {ExperimentsResolver, PostHogExperiment} from 'sanity-plugin-posthog-ab-testing'

/**
 * Static fixture set covering the ROB-2473 editor state matrix:
 * one experiment per lifecycle status (running, draft, paused,
 * exposure_frozen, complete), a multi-variant (3-way) flag, and
 * variants both with and without rolloutPercentage.
 *
 * The deleted-experiment state (ROB-2473 behaviour 9) is exercised by
 * pasting a flag key that is NOT in this list (e.g. `deleted-experiment`)
 * into the manual input, then observing the "not found in PostHog" card.
 * The out-of-sync warning is exercised by adding/removing variant entries
 * on the document relative to `homepage-hero` / `pricing-page-layout`.
 */
export const staticExperiments: PostHogExperiment[] = [
  {
    id: 1,
    name: 'Homepage hero',
    featureFlagKey: 'homepage-hero',
    status: 'running',
    variants: [
      {key: 'control', rolloutPercentage: 50},
      {key: 'test', label: 'New hero', rolloutPercentage: 50},
    ],
  },
  {
    id: 2,
    name: 'Pricing page layout (3-way)',
    featureFlagKey: 'pricing-page-layout',
    status: 'running',
    variants: [
      // Uneven split exercises the max-rollout chip highlight.
      {key: 'control', rolloutPercentage: 34},
      {key: 'cards', label: 'Card layout', rolloutPercentage: 33},
      {key: 'table', label: 'Comparison table', rolloutPercentage: 33},
    ],
  },
  {
    id: 3,
    name: 'Signup CTA copy',
    featureFlagKey: 'signup-cta-copy',
    status: 'draft',
    // No rolloutPercentage anywhere: rollout chips must be hidden.
    variants: [{key: 'control'}, {key: 'urgent'}],
  },
  {
    id: 4,
    name: 'Checkout flow',
    featureFlagKey: 'checkout-flow',
    status: 'paused',
    variants: [
      {key: 'control', rolloutPercentage: 50},
      {key: 'one-step', label: 'One-step checkout', rolloutPercentage: 50},
    ],
  },
  {
    id: 5,
    name: 'Nav restructure',
    featureFlagKey: 'nav-restructure',
    status: 'exposure_frozen',
    variants: [
      {key: 'control', rolloutPercentage: 50},
      // Mixed presence: one variant with a rollout chip, one without.
      {key: 'mega-menu', label: 'Mega menu'},
    ],
  },
  {
    id: 6,
    name: 'Old footer test',
    featureFlagKey: 'old-footer-test',
    status: 'complete',
    variants: [
      {key: 'control', rolloutPercentage: 50},
      {key: 'minimal', label: 'Minimal footer', rolloutPercentage: 50},
    ],
  },
]

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

export type FixtureMode = 'static' | 'empty' | 'throwing' | 'slow' | 'route'

/**
 * Pick the `experiments` config for `posthogAbTesting()` from
 * SANITY_STUDIO_AB_FIXTURE (default: 'static').
 *
 * - static:   the array above, passed as-is — the no-fetch, no-Suspense demo path.
 * - empty:    async fetcher resolving [] — the "no experiments exist" caution card.
 * - throwing: async fetcher that throws — the critical error card + Retry.
 * - slow:     5s delay then the static set — the Suspense loading card.
 * - route:    fetches SANITY_STUDIO_AB_EXPERIMENTS_URL — the real host-route path.
 */
export function resolveExperimentsConfig(): PostHogExperiment[] | ExperimentsResolver {
  const mode = (process.env.SANITY_STUDIO_AB_FIXTURE ?? 'static') as FixtureMode

  switch (mode) {
    case 'static':
      return staticExperiments

    case 'empty':
      // Resolver (not a static []) so the empty state is reached through the
      // fetch/Suspense path, per the fetcher contract: [] means "none exist".
      return async () => []

    case 'throwing':
      return async () => {
        throw new Error(
          'Fixture failure: PostHog is unreachable (SANITY_STUDIO_AB_FIXTURE=throwing)',
        )
      }

    case 'slow':
      return async () => {
        await sleep(5000)
        return staticExperiments
      }

    case 'route':
      return async () => {
        const url = process.env.SANITY_STUDIO_AB_EXPERIMENTS_URL
        if (!url) {
          throw new Error(
            'SANITY_STUDIO_AB_FIXTURE=route requires SANITY_STUDIO_AB_EXPERIMENTS_URL to be set',
          )
        }
        const res = await fetch(url)
        if (!res.ok) throw new Error(`Experiments route failed: HTTP ${res.status}`)
        return res.json()
      }

    default:
      throw new Error(
        `Unknown SANITY_STUDIO_AB_FIXTURE "${mode}". Valid: static | empty | throwing | slow | route`,
      )
  }
}
