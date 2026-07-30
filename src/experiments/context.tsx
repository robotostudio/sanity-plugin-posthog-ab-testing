import {createContext, useCallback, useContext, useMemo, useState, type ReactNode} from 'react'
import {useClient, useWorkspace} from 'sanity'
import {suspend} from 'suspend-react'

import {DEFAULT_API_VERSION, type ResolvedConfig} from '../config'
import type {ExperimentsResolver, PostHogExperiment} from '../types'
import {validateExperiments} from './validate'

const CACHE_NAMESPACE = 'sanity-plugin-posthog-ab-testing'

export type ExperimentsContextValue =
  | {kind: 'unconfigured'}
  | {
      kind: 'static'
      /** Validated lazily (in render) so malformed static arrays surface in the owned error Card. */
      experiments: PostHogExperiment[]
      token: number
      refresh: () => void
    }
  | {
      kind: 'resolver'
      resolver: ExperimentsResolver
      apiVersion: string
      token: number
      refresh: () => void
    }

const ExperimentsContext = createContext<ExperimentsContextValue | null>(null)

/**
 * Mounted once at the root-input gate (`_type === schemaType`). Holds the
 * bumpable refresh token: refresh bumps the token → fresh suspend key → the
 * host fetcher runs again. This also fixes upstream's permanently-cached-
 * failure bug — a failed fetch is only cached under the old key, and Retry
 * uses a new one. No polling, ever (PostHog's private-API rate limit is
 * 480/min shared across the whole org).
 */
export function ExperimentsProvider(props: {
  config: ResolvedConfig
  children: ReactNode
}): React.JSX.Element {
  const {config, children} = props
  const [token, setToken] = useState(0)
  const refresh = useCallback(() => setToken((current) => current + 1), [])

  const value = useMemo<ExperimentsContextValue>(() => {
    const source = config.experiments
    if (source === undefined) {
      return {kind: 'unconfigured'}
    }
    if (Array.isArray(source)) {
      return {kind: 'static', experiments: source, token, refresh}
    }
    return {kind: 'resolver', resolver: source, apiVersion: config.apiVersion, token, refresh}
  }, [config, token, refresh])

  return <ExperimentsContext.Provider value={value}>{children}</ExperimentsContext.Provider>
}

export function useExperimentsContext(): ExperimentsContextValue {
  return useContext(ExperimentsContext) ?? {kind: 'unconfigured'}
}

/**
 * Returns the validated experiment list. The static-array path bypasses
 * Suspense entirely (the demo path). The resolver path suspends via
 * suspend-react, keyed per workspace plus the refresh token — one fetch per
 * tab per workspace until refreshed. Throws (to the plugin's own boundary) on
 * fetcher failure or a malformed result.
 */
export function useExperimentList(): PostHogExperiment[] {
  const ctx = useExperimentsContext()
  const client = useClient({
    apiVersion: ctx.kind === 'resolver' ? ctx.apiVersion : DEFAULT_API_VERSION,
  })
  const workspace = useWorkspace()

  if (ctx.kind === 'unconfigured') {
    return []
  }
  if (ctx.kind === 'static') {
    return validateExperiments(ctx.experiments)
  }
  // suspend() is a plain promise cache, not a React hook — safe after the
  // early returns above.
  return suspend(
    async () => validateExperiments(await ctx.resolver(client)),
    [CACHE_NAMESPACE, workspace.name, ctx.token],
  )
}
