import { useState, useEffect } from 'react'
import type { OfficeState, WsMessage } from '../types'

export function useWebSocket(url: string) {
  const [state, setState] = useState<OfficeState>({})
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    const ws = new WebSocket(url)

    ws.onopen = () => setConnected(true)
    ws.onclose = () => setConnected(false)
    ws.onerror = () => {}

    ws.onmessage = (e) => {
      try {
        const msg: WsMessage = JSON.parse(e.data)
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
      } catch {}
    }

    return () => ws.close()
  }, [url])

  return { state, connected }
}
