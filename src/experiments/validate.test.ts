import {describe, expect, it} from 'vitest'

import type {PostHogExperiment} from '../types'
import {validateExperiments} from './validate'

const valid: PostHogExperiment[] = [
  {
    id: 7,
    name: 'Pricing test',
    featureFlagKey: 'pricing-test',
    status: 'running',
    variants: [{key: 'control'}, {key: 'test'}],
  },
]

describe('internal experiments validation (ROB-2469 ruling 2: no exported validator)', () => {
  it('passes a well-formed list through unchanged', () => {
    expect(validateExperiments(valid)).toBe(valid)
    expect(validateExperiments([])).toEqual([])
  })

  it('rejects non-array results, naming what it got', () => {
    expect(() => validateExperiments({experiments: valid})).toThrow(/non-array|object/)
    expect(() => validateExperiments(undefined)).toThrow(/expected an array/)
  })

  it('names the offending field for entries missing featureFlagKey', () => {
    expect(() => validateExperiments([{id: 1, name: 'Broken', variants: []}])).toThrow(
      /"featureFlagKey"/,
    )
  })

  it('names the offending field for entries missing variants', () => {
    expect(() =>
      validateExperiments([{id: 1, name: 'Broken', featureFlagKey: 'broken', status: 'running'}]),
    ).toThrow(/"variants"/)
  })
})
