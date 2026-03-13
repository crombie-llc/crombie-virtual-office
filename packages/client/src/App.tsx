import { Suspense, lazy } from 'react'
import { useWebSocket } from './hooks/useWebSocket'
import { PresenceBoard } from './fallback/PresenceBoard'

const WS_URL = (import.meta as { env?: { VITE_WS_URL?: string } }).env?.VITE_WS_URL ?? 'ws://localhost:4242'

const OfficeGame = lazy(() =>
  import('./game/OfficeGame').catch(() => ({ default: () => null }))
)

export default function App() {
  const { state, connected } = useWebSocket(WS_URL)

  return (
    <Suspense fallback={<PresenceBoard state={state} connected={connected} />}>
      <OfficeGame state={state} connected={connected} />
    </Suspense>
  )
}
