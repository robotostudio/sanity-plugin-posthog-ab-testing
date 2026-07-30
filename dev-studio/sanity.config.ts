import {defineConfig, defineField, defineType} from 'sanity'
import {structureTool} from 'sanity/structure'
import {posthogAbTesting} from 'sanity-plugin-posthog-ab-testing'

import {resolveExperimentsConfig} from './fixtures'

/** One vanilla page type — the default `pageTypes: ['page']` target. */
const pageType = defineType({
  name: 'page',
  title: 'Page',
  type: 'document',
  fields: [
    defineField({name: 'title', title: 'Title', type: 'string'}),
    defineField({
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      options: {source: 'title'},
    }),
    defineField({
      name: 'buttonColor',
      title: 'Button Color',
      type: 'string',
      options: {list: ['red', 'blue']},
    }),
    defineField({
      name: 'buttonLabel',
      title: 'Button Label',
      type: 'string',
    }),
  ],
})

export default defineConfig({
  name: 'default',
  title: 'PostHog A/B Testing — Dev Studio',

  projectId: process.env.SANITY_STUDIO_PROJECT_ID ?? 'placeholder',
  dataset: process.env.SANITY_STUDIO_DATASET ?? 'production',

  plugins: [
    structureTool(),
    posthogAbTesting({
      experiments: resolveExperimentsConfig(),
    }),
  ],

  schema: {
    types: [pageType],
  },
})
