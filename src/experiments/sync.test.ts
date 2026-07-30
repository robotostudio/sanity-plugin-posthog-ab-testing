import {describe, expect, it} from 'vitest'

import {isRecord} from '../lib/guards'
import {buildAddMissingVariantsPatches, computeVariantSync, randomKey} from './sync'

describe('variant sync computation (ROB-2473 behaviour 2)', () => {
  it('splits divergence into missing (in PostHog only) and stale (in Sanity only)', () => {
    const state = computeVariantSync(['control', 'old-variant'], ['control', 'test'])
    expect(state.missing).toEqual(['test'])
    expect(state.stale).toEqual(['old-variant'])
    expect(state.inSync).toBe(false)
  })

  it('reports in sync only when the sets match and PostHog has variants', () => {
    expect(computeVariantSync(['control', 'test'], ['control', 'test']).inSync).toBe(true)
    expect(computeVariantSync([], []).inSync).toBe(false)
  })
})

describe('the additive-only "Add missing variants" patch', () => {
  it('adds one stub per missing key with a generated _key and no page', () => {
    const patches = buildAddMissingVariantsPatches(['test', 'test-b'])
    expect(patches[0]).toEqual({setIfMissing: {variants: []}})
    const insert = patches[1]?.insert
    if (!isRecord(insert)) throw new Error('second patch is not an insert')
    expect(insert.after).toBe('variants[-1]')
    const items = Array.isArray(insert.items) ? insert.items.filter(isRecord) : []
    expect(items).toHaveLength(2)
    for (const item of items) {
      expect(typeof item._key).toBe('string')
      expect(item._key).toBeTruthy()
      expect(item).not.toHaveProperty('page')
    }
    expect(items.map((item) => item.variantKey)).toEqual(['test', 'test-b'])
    // _keys are unique
    expect(new Set(items.map((item) => item._key)).size).toBe(2)
  })

  it('never removes or overwrites — patches contain no unset/set operations', () => {
    const patches = buildAddMissingVariantsPatches(['test'])
    for (const patch of patches) {
      expect(patch).not.toHaveProperty('unset')
      expect(patch).not.toHaveProperty('set')
    }
  })

  it('randomKey produces distinct keys of the requested length', () => {
    const keys = new Set(Array.from({length: 50}, () => randomKey()))
    expect(keys.size).toBe(50)
    expect(randomKey(8)).toHaveLength(8)
  })
})
