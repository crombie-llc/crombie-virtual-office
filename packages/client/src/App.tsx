import { Suspense, lazy, useMemo, Component, type ReactNode, type ErrorInfo } from 'react'
import { useWebSocket } from './hooks/useWebSocket'
import { PresenceBoard } from './fallback/PresenceBoard'
import type { OfficeState } from './types'

const WS_URL = (import.meta as { env?: { VITE_WS_URL?: string } }).env?.VITE_WS_URL ?? 'ws://localhost:4242'

const OfficeGame = lazy(() =>
  import('./game/OfficeGame').catch(() => ({ default: () => null }))
)

interface ErrorBoundaryProps {
  fallback: ReactNode
  children: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(_: Error): ErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[OfficeGame] render error:', error, info)
  }

  render() {
    if (this.state.hasError) return this.props.fallback
    return this.props.children
  }
}

export default function App() {
  const { state, connected } = useWebSocket(WS_URL)
  const fallback = useMemo(
    () => <PresenceBoard state={state} connected={connected} />,
    [state, connected]
  )

  return (
    <ErrorBoundary fallback={fallback}>
      <Suspense fallback={fallback}>
        <OfficeGame state={state} connected={connected} />
      </Suspense>
    </ErrorBoundary>
  )
}
