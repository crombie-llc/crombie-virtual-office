import { WebSocket, WebSocketServer } from 'ws'
import type { OfficePatch } from './state.js'

export class BroadcastServer {
  private wss: WebSocketServer

  // Attaches WS to the existing HTTP server (same port, upgrade request)
  constructor(server: import('http').Server) {
    this.wss = new WebSocketServer({ server })
  }

  onConnect(cb: (ws: WebSocket) => void) {
    this.wss.on('connection', (ws) => {
      ws.on('error', () => {})
      cb(ws)
    })
  }

  broadcast(patches: OfficePatch[]) {
    const msg = JSON.stringify(patches)
    this.wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) client.send(msg)
    })
  }

  close() { this.wss.close() }
}
