/**
 * Set-comparison between the variant keys stored in the Sanity document and
 * the variant keys of the selected PostHog experiment, plus the additive-only
 * "Add missing variants" patch builder (ROB-2473 behaviour 2).
 */

export interface VariantSyncState {
  /** Keys the PostHog experiment has that the document does not. */
  missing: string[]
  /** Keys the document has that the selected experiment does not (warning-only; never removed). */
  stale: string[]
  inSync: boolean
}

export function computeVariantSync(currentKeys: string[], posthogKeys: string[]): VariantSyncState {
  const missing = posthogKeys.filter((key) => !currentKeys.includes(key))
  const stale = currentKeys.filter((key) => !posthogKeys.includes(key))
  return {
    missing,
    stale,
    inSync: posthogKeys.length > 0 && missing.length === 0 && stale.length === 0,
  }
}

const KEY_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789'

export function randomKey(length = 12): string {
  let key = ''
  for (let i = 0; i < length; i++) {
    key += KEY_ALPHABET[Math.floor(Math.random() * KEY_ALPHABET.length)]
  }
  return key
}

/**
 * Additive only: appends one stub entry per missing PostHog key
 * (`{_type: 'variant', _key, variantKey}` with `page` empty). Never removes or overwrites —
 * stale keys stay warning-only. The `Rule.required()` on `page` then drives
 * the editor to finish each mapping.
 */
export function buildAddMissingVariantsPatches(missingKeys: string[]): Record<string, unknown>[] {
  return [
    {setIfMissing: {variants: []}},
    {
      insert: {
        after: 'variants[-1]',
        items: missingKeys.map((variantKey) => ({_type: 'variant', _key: randomKey(), variantKey})),
      },
    },
  ]
}
