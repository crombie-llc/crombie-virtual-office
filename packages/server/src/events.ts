import type { OfficeEvent } from './state.js'

const VALID_TYPES = new Set([
  'session_start', 'session_end', 'agent_start', 'agent_end', 'thinking', 'commit'
])

export function parseEvent(body: unknown): OfficeEvent | null {
  if (typeof body !== 'object' || body === null) return null
  const b = body as Record<string, unknown>

  if (typeof b.dev !== 'string' || !b.dev.trim()) return null
  const dev = b.dev.trim().toLowerCase()
  if (dev.length > 50) return null

  if (typeof b.type !== 'string' || !VALID_TYPES.has(b.type)) return null
  const type = b.type as OfficeEvent['type']

  const ts = typeof b.ts === 'number' ? b.ts : Date.now()

  const event: OfficeEvent = { dev, type, ts }

  if (typeof b.color === 'string') event.color = b.color
  if (type === 'agent_start') {
    event.agent = typeof b.agent === 'string' && b.agent.trim() ? b.agent.trim() : 'unknown'
  }

  return event
}
