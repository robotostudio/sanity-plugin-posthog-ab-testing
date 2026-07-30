// oxlint-disable no-restricted-imports -- React error boundaries require a class component
import {Component, Suspense, type ReactNode} from 'react'

interface ExperimentsBoundaryProps {
  fallback: ReactNode
  renderError: (error: Error, retry: () => void) => ReactNode
  /** Bumps the provider token so the next attempt uses a fresh suspend key. */
  onRetry: () => void
  children: ReactNode
}

interface ExperimentsBoundaryState {
  error: Error | null
}

/**
 * The plugin's own Suspense + error boundary (mandatory per ROB-2473: a
 * failing fetcher must never take out the document form, and a thrown suspend
 * promise must never land on an unverified Studio boundary). Rendered per
 * field input so every degraded state can still show `renderDefault` — the
 * manual flag-key input is always reachable.
 *
 * Callers pass `key={token}` so a refresh remounts the boundary, clearing any
 * caught error alongside the fresh suspend key.
 */
export class ExperimentsBoundary extends Component<
  ExperimentsBoundaryProps,
  ExperimentsBoundaryState
> {
  state: ExperimentsBoundaryState = {error: null}

  static getDerivedStateFromError(error: Error): ExperimentsBoundaryState {
    return {error}
  }

  private retry = (): void => {
    this.props.onRetry()
    this.setState({error: null})
  }

  render(): ReactNode {
    if (this.state.error) {
      return this.props.renderError(this.state.error, this.retry)
    }
    return <Suspense fallback={this.props.fallback}>{this.props.children}</Suspense>
  }
}
