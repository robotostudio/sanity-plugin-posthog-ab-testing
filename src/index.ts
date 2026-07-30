import {definePlugin} from 'sanity'

interface MyPluginConfig {
  /* nothing here yet */
}

/**
 * Usage in `sanity.config.ts` (or .js)
 *
 * ```ts
 * import {defineConfig} from 'sanity'
 * import {myPlugin} from 'sanity-plugin-posthog-ab-testing'
 *
 * export default defineConfig({
 *   // ...
 *   plugins: [myPlugin()],
 * })
 * ```
 *
 * @public
 */
export const myPlugin = definePlugin<MyPluginConfig | void>((_config = {}) => {
  // oxlint-disable-next-line no-console
  console.log('hello from sanity-plugin-posthog-ab-testing')
  return {
    name: 'sanity-plugin-posthog-ab-testing',
  }
})
