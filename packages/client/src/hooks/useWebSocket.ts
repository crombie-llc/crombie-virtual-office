import { useState, useEffect } from 'react'
import type { OfficeState } from '../types'
import { WsMessageSchema } from '../types'

export function useWebSocket(url: string) {
  const [state, setState] = useState<OfficeState>({})
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    const ws = new WebSocket(url)

    ws.onopen = () => setConnected(true)
    ws.onclose = () => setConnected(false)
    ws.onerror = (e) => console.error('[useWebSocket] error:', e)

    ws.onmessage = (e) => {
      const result = WsMessageSchema.safeParse(JSON.parse(e.data))
      if (!result.success) {
        console.warn('[useWebSocket] invalid message', result.error.issues)
        return
      }
      const msg = result.data
      if ('type' in msg && msg.type === 'full_state') {
        setState(msg.state)
      } else if (Array.isArray(msg)) {
        setState(prev => {
          const next = { ...prev }
          for (const { dev, patch } of msg) {
            if (next[dev]) next[dev] = { ...next[dev], ...patch }
          }
          return next
        })
      }
    }

    return () => ws.close()
  }, [url])

  return { state, connected }
}
