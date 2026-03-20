import { z } from 'zod'
import type { OfficeEvent } from './state.js'

const EventSchema = z.object({
  dev:   z.string().trim().min(1).max(50).transform(v => v.toLowerCase()),
  type:  z.enum(['session_start', 'session_end', 'agent_start', 'agent_end', 'thinking', 'commit']),
  ts:    z.number().optional().transform(v => v ?? Date.now()),
  color: z.string().optional(),
  agent: z.string().trim().min(1).optional(),
})

export function parseEvent(body: unknown): OfficeEvent | null {
  const result = EventSchema.safeParse(body)
  if (!result.success) return null

  const { dev, type, ts, color, agent } = result.data
  const event: OfficeEvent = { dev, type, ts }

  if (color) event.color = color
  if (type === 'agent_start') event.agent = agent ?? 'unknown'

  return event
}
