/** Narrowing helpers so form values are read without unsafe assertions. */

export interface VariantStub {
  variantKey?: string
  _key?: string
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function readString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

export function readVariantStubs(value: unknown): VariantStub[] {
  if (!Array.isArray(value)) return []
  return value.filter(isRecord).map((item) => ({
    variantKey: readString(item.variantKey),
    _key: readString(item._key),
  }))
}
