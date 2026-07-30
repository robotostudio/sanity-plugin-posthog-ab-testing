import {definePlugin, type InputProps} from 'sanity'

import {resolveConfig} from './config'
import {PLUGIN_NAME} from './constants'
import {ExperimentsProvider} from './experiments/context'
import {defineAbTestSchema} from './schema/abTestSchema'
import type {PostHogAbTestingConfig} from './types'

/**
 * Page-level A/B testing for Sanity Studio, driven by PostHog experiments.
 *
 * Usage in `sanity.config.ts` (or .js):
 *
 * ```ts
 * import {defineConfig} from 'sanity'
 * import {posthogAbTesting} from 'sanity-plugin-posthog-ab-testing'
 *
 * export default defineConfig({
 *   // ...
 *   plugins: [
 *     posthogAbTesting({
 *       experiments: async () => {
 *         const res = await fetch('https://example.com/api/posthog/experiments')
 *         if (!res.ok) throw new Error(`Experiments route failed: HTTP ${res.status}`)
 *         return res.json()
 *       },
 *     }),
 *   ],
 * })
 * ```
 *
 * @public
 */
export const posthogAbTesting = definePlugin<PostHogAbTestingConfig>((config) => {
  const resolved = resolveConfig(config)

  return {
    name: PLUGIN_NAME,
    schema: {
      types: [defineAbTestSchema(resolved)],
    },
    form: {
      components: {
        input: function PosthogAbTestingRootInput(props: InputProps) {
          // Root-input gate: one provider per open A/B test document. Lazy by
          // construction — no fetch at Studio load, none on unrelated documents.
          if (props.id === 'root' && props.schemaType.name === resolved.schemaType) {
            return (
              <ExperimentsProvider config={resolved}>
                {props.renderDefault(props)}
              </ExperimentsProvider>
            )
          }
          return props.renderDefault(props)
        },
      },
    },
  }
})
