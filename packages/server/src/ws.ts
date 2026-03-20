import { WebSocket, WebSocketServer } from 'ws'
import type { IncomingMessage } from 'http'
import type { OfficePatch } from './state.js'

export class BroadcastServer {
  private wss: WebSocketServer
  private allowedOrigin: string

  constructor(server: import('http').Server, allowedOrigin: string) {
    this.allowedOrigin = allowedOrigin

    this.wss = new WebSocketServer({
      server,
      maxPayload: 64 * 1024, // 64 KB — more than enough for office events
    })

    // Reject WebSocket upgrades from disallowed origins when CORS_ORIGIN is set
    this.wss.on('headers', (_headers: string[], req: IncomingMessage) => {
      const origin = req.headers.origin ?? ''
      if (this.allowedOrigin !== '*' && origin !== this.allowedOrigin) {
        // ws does not support rejecting in the 'headers' event; handled via 'connection'
      }
    })
  }

  onConnect(cb: (ws: WebSocket) => void) {
    this.wss.on('connection', (ws, req: IncomingMessage) => {
      // Reject connections from disallowed origins
      if (this.allowedOrigin !== '*') {
        const origin = req.headers.origin ?? ''
        if (origin !== this.allowedOrigin) {
          ws.close(1008, 'Origin not allowed')
          return
        }
      }

      ws.on('error', (err) => console.error('[ws] client error:', err.message))

      // Clients should not send messages; ignore any inbound data
      ws.on('message', () => { /* read-only feed */ })

      cb(ws)
    })
  }

  broadcast(patches: OfficePatch[]) {
    const msg = JSON.stringify(patches)
    this.wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) client.send(msg)
    })
  }

  broadcastRaw(msg: string) {
    this.wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) client.send(msg)
    })
  }

  close() { this.wss.close() }
}
