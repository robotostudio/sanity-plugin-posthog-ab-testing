import {BulbOutlineIcon} from '@sanity/icons/BulbOutline'
import {LockIcon} from '@sanity/icons/Lock'
import {SplitHorizontalIcon} from '@sanity/icons/SplitHorizontal'
import {defineField, defineType} from 'sanity'

import {PostHogExperimentSelect} from '../components/PostHogExperimentSelect'
import {PostHogVariantKeySelect} from '../components/PostHogVariantKeySelect'
import type {ResolvedConfig} from '../config'
import {CONTROL_VARIANT_KEY} from '../constants'
import {readVariantStubs} from '../lib/guards'

export const DUPLICATE_VARIANT_ERROR = 'Duplicate variant keys are not allowed'
export const NO_CONTROL_WARNING =
  "No 'control' variant is mapped. PostHog serves unassigned visitors the control; without a control page this test never applies."

/** Duplicate-key check, extracted for direct testing. */
export function validateNoDuplicateVariants(variants: unknown): string | true {
  if (!Array.isArray(variants)) return true
  const seen = new Set<string>()
  for (const stub of readVariantStubs(variants)) {
    const key = stub.variantKey
    if (key && seen.has(key)) return DUPLICATE_VARIANT_ERROR
    if (key) seen.add(key)
  }
  return true
}

/**
 * Warning-level (never error) control-presence check — offline-checkable, so
 * it is allowed in validation. Mirrors the runtime control-page gate, which
 * silently never applies the test without a control entry.
 */
export function warnOnMissingControl(variants: unknown): string | true {
  if (!Array.isArray(variants) || variants.length === 0) return true
  const hasControl = readVariantStubs(variants).some(
    (stub) => stub.variantKey === CONTROL_VARIANT_KEY,
  )
  return hasControl ? true : NO_CONTROL_WARNING
}

/** Build the A/B test document schema from resolved plugin config. */
export function defineAbTestSchema(config: ResolvedConfig): ReturnType<typeof defineType> {
  return defineType({
    name: config.schemaType,
    type: 'document',
    title: config.title,
    icon: SplitHorizontalIcon,
    fields: [
      ...(config.languageField
        ? [
            defineField({
              name: config.languageField,
              type: 'string',
              readOnly: true,
              hidden: true,
            }),
          ]
        : []),
      defineField({
        name: 'name',
        title: 'Test Name',
        type: 'string',
        description: 'Internal name to identify this A/B test',
        validation: (Rule) => Rule.required(),
      }),
      defineField({
        name: 'posthogFlagKey',
        title: 'PostHog Experiment',
        type: 'string',
        description:
          'Select the PostHog experiment feature flag. Traffic split, targeting, and scheduling are all managed in PostHog.',
        components: {
          input: PostHogExperimentSelect,
        },
        validation: (Rule) => Rule.required(),
      }),
      defineField({
        name: 'enabled',
        title: 'Enabled',
        type: 'boolean',
        initialValue: false,
        description:
          'Local kill switch. Disable to stop serving variants regardless of PostHog experiment status.',
      }),
      defineField({
        name: 'variants',
        title: 'Variant Pages',
        type: 'array',
        description:
          'Map each PostHog variant to a Sanity page. Synced from the selected experiment.',
        options: {sortable: false},
        validation: (Rule) => [
          Rule.required()
            .min(2)
            .custom((variants) => validateNoDuplicateVariants(variants)),
          Rule.warning().custom((variants) => warnOnMissingControl(variants)),
        ],
        of: [
          {
            type: 'object',
            fields: [
              defineField({
                name: 'variantKey',
                title: 'Variant',
                type: 'string',
                description: 'Synced from PostHog',
                components: {
                  input: PostHogVariantKeySelect,
                },
                validation: (Rule) => Rule.required(),
              }),
              defineField({
                name: 'page',
                title: 'Page',
                type: 'reference',
                to: config.pageTypes.map((type) => ({type})),
                options: {
                  disableNew: true,
                },
                validation: (Rule) => Rule.required(),
              }),
            ],
            preview: {
              select: {
                variantKey: 'variantKey',
                pageTitle: 'page.title',
                pageSlug: 'page.slug.current',
              },
              prepare({
                variantKey,
                pageTitle,
                pageSlug,
              }: {
                variantKey?: string
                pageTitle?: string
                pageSlug?: string
              }) {
                const isControl = variantKey === CONTROL_VARIANT_KEY
                const icon = isControl ? LockIcon : BulbOutlineIcon
                const label = variantKey
                  ? `${variantKey.charAt(0).toUpperCase()}${variantKey.slice(1)}`
                  : 'Unknown variant'
                const slugDisplay = pageSlug
                  ? ` (${pageSlug.startsWith('/') ? pageSlug : `/${pageSlug}`})`
                  : ''
                const page = pageTitle ? `${pageTitle}${slugDisplay}` : 'No page selected'

                return {
                  title: label,
                  subtitle: page,
                  media: icon,
                }
              },
            },
          },
        ],
      }),
    ],
    preview: {
      select: {
        name: 'name',
        enabled: 'enabled',
        posthogFlagKey: 'posthogFlagKey',
      },
      prepare({
        name,
        enabled,
        posthogFlagKey,
      }: {
        name?: string
        enabled?: boolean
        posthogFlagKey?: string
      }) {
        const status = enabled ? 'Active' : 'Inactive'
        return {
          title: name || 'Untitled Test',
          subtitle: `${status} · ${posthogFlagKey ?? 'No flag'}`,
          media: SplitHorizontalIcon,
        }
      },
    },
  })
}
