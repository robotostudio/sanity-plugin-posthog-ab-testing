import type {SanityClient} from 'sanity'

/** One variant of a PostHog experiment, as shown in the Studio. */
export type PostHogVariant = {
  /** The feature-flag variant key. Stored verbatim in `variants[].variantKey`. */
  key: string
  /** Optional display label. Falls back to `key` in the UI. */
  label?: string
  /** Display-only. PostHog is authoritative; never stored in Sanity. Chips hidden when absent. */
  rolloutPercentage?: number
}

/**
 * Experiment lifecycle state. Mirrors PostHog's /experiments status filter enum
 * (draft | running | paused | exposure_frozen | stopped | complete), with
 * `stopped` normalised to `complete` — PostHog documents both as "ended".
 * The README route prompt performs that normalisation.
 */
export type PostHogExperimentStatus =
  | 'draft'
  | 'running'
  | 'paused'
  | 'exposure_frozen'
  | 'complete'

/** A PostHog experiment, as returned by the host's fetcher. */
export type PostHogExperiment = {
  /** PostHog experiment id. Used only as a stable list key in the UI. */
  id: number
  name: string
  /**
   * The multivariate feature-flag key backing the experiment. Distinct from `id`;
   * this is what gets stored in `posthogFlagKey` and what the runtime proxy evaluates.
   */
  featureFlagKey: string
  status: PostHogExperimentStatus
  variants: PostHogVariant[]
}

/**
 * Host-supplied experiments source. `client` is the Studio's authenticated
 * client from `useClient({apiVersion})`. Must be re-callable and idempotent:
 * the plugin invokes it lazily (first time an A/B test document form opens)
 * and again on every press of the "Reload experiments" button. On failure,
 * THROW — do not return []. An empty array means "no experiments exist",
 * not "fetch failed".
 */
export type ExperimentsResolver = (client: SanityClient) => Promise<PostHogExperiment[]>

export interface PostHogAbTestingConfig {
  /**
   * REQUIRED. Static array (demo/test path — no fetch, no Suspense) or async
   * resolver (production path — typically hits the host's server route that
   * holds the PostHog personal API key). Discriminated via Array.isArray().
   */
  experiments: PostHogExperiment[] | ExperimentsResolver

  /**
   * Document type name for the A/B test document. Default: 'posthogAbTest'.
   * Set once, before content exists — renaming later orphans documents and
   * breaks the GROQ in your runtime code. Appears in every runtime prompt's
   * query filter (`_type == "<schemaType>"`).
   */
  schemaType?: string

  /** Display title for the document type. Default: 'A/B Test'. */
  title?: string

  /**
   * Document type name(s) a variant page reference may point to.
   * Default: ['page']. Becomes `to: types.map(t => ({type: t}))` on the
   * `variants[].page` reference field.
   */
  pageTypes?: string[]

  /**
   * i18n opt-in. When set (e.g. 'language'), the schema gains a hidden,
   * read-only string field of that name — compatible with
   * @sanity/document-internationalization — and the README prompts add the
   * `&& <languageField> == $language` GROQ filter line. Default: undefined
   * (no field, no filter; v1 is otherwise locale-unaware).
   */
  languageField?: string

  /** apiVersion for the `useClient` instance passed to the resolver. Default: '2026-07-01'. */
  apiVersion?: string
}
