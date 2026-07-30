import {describe, expect, it} from 'vitest'

import * as publicApi from './index'
import type {
  ExperimentsResolver,
  PostHogAbTestingConfig,
  PostHogExperiment,
  PostHogExperimentStatus,
  PostHogVariant,
} from './index'

/**
 * Exports-snapshot test — the public surface is frozen by ROB-2472:
 * `posthogAbTesting` plus five types, nothing else. No runtime constants, no
 * runtime helpers, no validator (ROB-2469).
 */
describe('public export surface', () => {
  it('exports exactly one runtime value: posthogAbTesting', () => {
    expect(Object.keys(publicApi).sort()).toEqual(['posthogAbTesting'])
  })

  it('posthogAbTesting is a plugin factory', () => {
    expect(typeof publicApi.posthogAbTesting).toBe('function')
  })

  it("definePlugin name string is 'posthog-ab-testing'", () => {
    const plugin = publicApi.posthogAbTesting({experiments: []})
    expect(plugin.name).toBe('posthog-ab-testing')
  })

  it('the five frozen types are exported and shaped per ROB-2472', () => {
    // Compile-time assertions: if any of the five type exports disappears or
    // changes shape incompatibly, this test file stops compiling.
    const status: PostHogExperimentStatus = 'exposure_frozen'
    const variant: PostHogVariant = {key: 'control', label: 'Control', rolloutPercentage: 50}
    const experiment: PostHogExperiment = {
      id: 1,
      name: 'Homepage test',
      featureFlagKey: 'homepage-test',
      status,
      variants: [variant, {key: 'test'}],
    }
    const resolver: ExperimentsResolver = () => Promise.resolve([experiment])
    const staticConfig: PostHogAbTestingConfig = {experiments: [experiment]}
    const resolverConfig: PostHogAbTestingConfig = {
      experiments: resolver,
      schemaType: 'ab-test',
      title: 'Experiment',
      pageTypes: ['page', 'homePage'],
      languageField: 'language',
      apiVersion: '2026-07-01',
    }
    expect(staticConfig.experiments).toHaveLength(1)
    expect(typeof resolverConfig.experiments).toBe('function')
  })
})
