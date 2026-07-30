import {describe, expect, it} from 'vitest'

import {
  DUPLICATE_VARIANT_ERROR,
  NO_CONTROL_WARNING,
  validateNoDuplicateVariants,
  warnOnMissingControl,
} from './abTestSchema'

describe('duplicate-variant validation (from Babel ab-test.ts:54-65)', () => {
  it('rejects duplicate variant keys', () => {
    expect(validateNoDuplicateVariants([{variantKey: 'control'}, {variantKey: 'control'}])).toBe(
      DUPLICATE_VARIANT_ERROR,
    )
  })

  it('accepts unique keys, entries without keys, and non-arrays', () => {
    expect(validateNoDuplicateVariants([{variantKey: 'control'}, {variantKey: 'test'}])).toBe(true)
    expect(validateNoDuplicateVariants([{}, {variantKey: 'test'}])).toBe(true)
    expect(validateNoDuplicateVariants(undefined)).toBe(true)
  })
})

describe('control-presence warning (ROB-2473 behaviour 10, warning-level only)', () => {
  it("warns when no 'control' variant is mapped", () => {
    expect(warnOnMissingControl([{variantKey: 'test'}, {variantKey: 'test-b'}])).toBe(
      NO_CONTROL_WARNING,
    )
  })

  it('passes with a control entry, and stays silent on empty/undefined (required() owns those)', () => {
    expect(warnOnMissingControl([{variantKey: 'control'}, {variantKey: 'test'}])).toBe(true)
    expect(warnOnMissingControl([])).toBe(true)
    expect(warnOnMissingControl(undefined)).toBe(true)
  })
})
