import { describe, it, expect } from 'vitest'
import { parseEvent } from '../src/events'

describe('parseEvent', () => {
  it('accepts a valid session_start payload', () => {
    const result = parseEvent({ dev: 'ana', color: '#ff0000', type: 'session_start', ts: 1000 })
    expect(result).toMatchObject({ dev: 'ana', type: 'session_start' })
  })

  it('rejects payload missing dev', () => {
    expect(parseEvent({ type: 'session_start', ts: 1000 })).toBeNull()
  })

  it('rejects payload missing type', () => {
    expect(parseEvent({ dev: 'ana', ts: 1000 })).toBeNull()
  })

  it('rejects unknown event type', () => {
    expect(parseEvent({ dev: 'ana', type: 'explode', ts: 1000 })).toBeNull()
  })

  it('fills ts with Date.now() if missing', () => {
    const result = parseEvent({ dev: 'ana', type: 'session_end' })
    expect(result?.ts).toBeGreaterThan(0)
  })

  it('extracts agent field for agent_start', () => {
    const result = parseEvent({ dev: 'ana', type: 'agent_start', agent: 'crombie:reviewer', ts: 1 })
    expect(result?.agent).toBe('crombie:reviewer')
  })

  it('defaults agent to "unknown" when missing on agent_start', () => {
    const result = parseEvent({ dev: 'ana', type: 'agent_start', ts: 1 })
    expect(result?.agent).toBe('unknown')
  })

  it('sanitizes dev name: trims and lowercases', () => {
    const result = parseEvent({ dev: '  ANA  ', type: 'session_end', ts: 1 })
    expect(result?.dev).toBe('ana')
  })

  it('rejects dev name longer than 50 chars', () => {
    expect(parseEvent({ dev: 'a'.repeat(51), type: 'session_end', ts: 1 })).toBeNull()
  })
})
