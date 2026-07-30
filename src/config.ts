import type {ExperimentsResolver, PostHogAbTestingConfig, PostHogExperiment} from './types'

export const DEFAULT_SCHEMA_TYPE = 'posthogAbTest'
export const DEFAULT_TITLE = 'A/B Test'
export const DEFAULT_PAGE_TYPES: string[] = ['page']
export const DEFAULT_API_VERSION = '2026-07-01'

/** Config with every default applied. Internal. */
export interface ResolvedConfig {
  /** Undefined when the host passed no config / no `experiments` key (JS callers). */
  experiments: PostHogExperiment[] | ExperimentsResolver | undefined
  schemaType: string
  title: string
  pageTypes: string[]
  languageField: string | undefined
  apiVersion: string
}

export function resolveConfig(config?: Partial<PostHogAbTestingConfig> | void): ResolvedConfig {
  const c: Partial<PostHogAbTestingConfig> = config ?? {}
  return {
    experiments: c.experiments,
    schemaType: c.schemaType ?? DEFAULT_SCHEMA_TYPE,
    title: c.title ?? DEFAULT_TITLE,
    pageTypes: c.pageTypes && c.pageTypes.length > 0 ? c.pageTypes : DEFAULT_PAGE_TYPES,
    languageField: c.languageField,
    apiVersion: c.apiVersion ?? DEFAULT_API_VERSION,
  }
}
