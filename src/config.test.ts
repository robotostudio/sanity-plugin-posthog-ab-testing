import {describe, expect, it} from 'vitest'

import {
  DEFAULT_API_VERSION,
  DEFAULT_PAGE_TYPES,
  DEFAULT_SCHEMA_TYPE,
  DEFAULT_TITLE,
  resolveConfig,
} from './config'
import {posthogAbTesting} from './index'
import {isRecord} from './lib/guards'
import type {PostHogAbTestingConfig, PostHogExperiment} from './types'

const sampleExperiments: PostHogExperiment[] = [
  {
    id: 1,
    name: 'Homepage hero',
    featureFlagKey: 'homepage-hero',
    status: 'running',
    variants: [{key: 'control'}, {key: 'test'}],
  },
]

function getSchemaType(config: PostHogAbTestingConfig): Record<string, unknown> {
  const plugin = posthogAbTesting(config)
  const types: unknown = plugin.schema?.types
  if (!Array.isArray(types)) throw new Error('plugin registered no schema types')
  expect(types).toHaveLength(1)
  const first: unknown = types[0]
  if (!isRecord(first)) throw new Error('schema type is not an object')
  return first
}

function fieldsOf(value: unknown): Record<string, unknown>[] {
  if (!isRecord(value) || !Array.isArray(value.fields)) return []
  return value.fields.filter(isRecord)
}

function getField(
  config: PostHogAbTestingConfig,
  name: string,
): Record<string, unknown> | undefined {
  return fieldsOf(getSchemaType(config)).find((field) => field.name === name)
}

function getPageReference(config: PostHogAbTestingConfig): Record<string, unknown> | undefined {
  const variants = getField(config, 'variants')
  const members = Array.isArray(variants?.of) ? variants.of : []
  return fieldsOf(members[0]).find((field) => field.name === 'page')
}

/**
 * One unit test per config key (ROB-2472: "every key is honoured"), each
 * asserting an observable schema/behaviour change — the direct answer to
 * upstream's 37%-no-op config surface.
 */
describe('config key: experiments', () => {
  it('accepts a static array or an async resolver (upstream union), and its absence is observable', () => {
    expect(resolveConfig({experiments: sampleExperiments}).experiments).toBe(sampleExperiments)
    const resolver = () => Promise.resolve(sampleExperiments)
    expect(resolveConfig({experiments: resolver}).experiments).toBe(resolver)
    // JS callers may omit config entirely — resolved as undefined, which the
    // provider maps to the explicit config-error Card (never a silent field).
    expect(resolveConfig().experiments).toBeUndefined()
  })
})

describe('config key: schemaType', () => {
  it("defaults the document type name to 'posthogAbTest'", () => {
    expect(getSchemaType({experiments: sampleExperiments}).name).toBe(DEFAULT_SCHEMA_TYPE)
    expect(DEFAULT_SCHEMA_TYPE).toBe('posthogAbTest')
  })

  it("renames the document type (Babel's own migration path: 'ab-test')", () => {
    expect(getSchemaType({experiments: sampleExperiments, schemaType: 'ab-test'}).name).toBe(
      'ab-test',
    )
  })
})

describe('config key: title', () => {
  it("defaults the display title to 'A/B Test' and honours an override", () => {
    expect(getSchemaType({experiments: sampleExperiments}).title).toBe(DEFAULT_TITLE)
    expect(DEFAULT_TITLE).toBe('A/B Test')
    expect(getSchemaType({experiments: sampleExperiments, title: 'Experiment'}).title).toBe(
      'Experiment',
    )
  })
})

describe('config key: pageTypes', () => {
  it("defaults the variant page reference to [{type: 'page'}]", () => {
    expect(getPageReference({experiments: sampleExperiments})?.to).toEqual(
      DEFAULT_PAGE_TYPES.map((type) => ({type})),
    )
    expect(DEFAULT_PAGE_TYPES).toEqual(['page'])
  })

  it('maps every configured page type onto the reference `to`', () => {
    expect(
      getPageReference({experiments: sampleExperiments, pageTypes: ['page', 'homePage']})?.to,
    ).toEqual([{type: 'page'}, {type: 'homePage'}])
  })
})

describe('config key: languageField', () => {
  it('emits no language field by default (v1 is locale-unaware)', () => {
    expect(getField({experiments: sampleExperiments}, 'language')).toBeUndefined()
  })

  it('emits a hidden, read-only string field of the configured name when set', () => {
    const field = getField({experiments: sampleExperiments, languageField: 'language'}, 'language')
    expect(field).toMatchObject({
      name: 'language',
      type: 'string',
      readOnly: true,
      hidden: true,
    })
    // The name itself is honoured, mirroring doc-internationalization's option
    const custom = getField({experiments: sampleExperiments, languageField: 'locale'}, 'locale')
    expect(custom).toMatchObject({name: 'locale', type: 'string'})
  })
})

describe('config key: apiVersion', () => {
  it("defaults the useClient apiVersion to '2026-07-01' and honours an override", () => {
    expect(resolveConfig({experiments: sampleExperiments}).apiVersion).toBe(DEFAULT_API_VERSION)
    expect(DEFAULT_API_VERSION).toBe('2026-07-01')
    expect(
      resolveConfig({experiments: sampleExperiments, apiVersion: '2024-01-01'}).apiVersion,
    ).toBe('2024-01-01')
  })
})
