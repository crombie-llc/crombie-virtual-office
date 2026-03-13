import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { StateManager } from '../src/state'

describe('StateManager', () => {
  let sm: StateManager

  beforeEach(() => {
    vi.useFakeTimers()
    sm = new StateManager()
  })

  afterEach(() => {
    sm.destroy()
    vi.useRealTimers()
  })

  it('auto-registers developer on first session_start', () => {
    sm.applyEvent({ dev: 'ana', color: '#ff0000', type: 'session_start', ts: 1000 })
    const state = sm.getAll()
    expect(state['ana']).toMatchObject({ name: 'ana', color: '#ff0000', online: true })
  })

  it('uses default color when color missing on session_start', () => {
    sm.applyEvent({ dev: 'bob', type: 'session_start', ts: 1000 })
    expect(sm.getAll()['bob'].color).toBe('#4a9eff')
  })

  it('uses default color when color is not a valid hex string', () => {
    sm.applyEvent({ dev: 'bob', color: 'notacolor', type: 'session_start', ts: 1000 })
    expect(sm.getAll()['bob'].color).toBe('#4a9eff')
  })

  it('sets online=false on session_end', () => {
    sm.applyEvent({ dev: 'ana', color: '#ff0000', type: 'session_start', ts: 1000 })
    sm.applyEvent({ dev: 'ana', type: 'session_end', ts: 2000 })
    expect(sm.getAll()['ana'].online).toBe(false)
  })

  it('sets activeAgent on agent_start', () => {
    sm.applyEvent({ dev: 'ana', color: '#ff0000', type: 'session_start', ts: 1000 })
    sm.applyEvent({ dev: 'ana', type: 'agent_start', agent: 'crombie:reviewer', ts: 2000 })
    expect(sm.getAll()['ana'].activeAgent).toBe('crombie:reviewer')
  })

  it('clears activeAgent on agent_end', () => {
    sm.applyEvent({ dev: 'ana', color: '#ff0000', type: 'session_start', ts: 1000 })
    sm.applyEvent({ dev: 'ana', type: 'agent_start', agent: 'crombie:reviewer', ts: 2000 })
    sm.applyEvent({ dev: 'ana', type: 'agent_end', ts: 3000 })
    expect(sm.getAll()['ana'].activeAgent).toBeNull()
  })

  it('sets thinking=true on thinking event', () => {
    sm.applyEvent({ dev: 'ana', color: '#ff0000', type: 'session_start', ts: 1000 })
    sm.applyEvent({ dev: 'ana', type: 'thinking', ts: 2000 })
    expect(sm.getAll()['ana'].thinking).toBe(true)
  })

  it('clears thinking on next event from same dev', () => {
    sm.applyEvent({ dev: 'ana', color: '#ff0000', type: 'session_start', ts: 1000 })
    sm.applyEvent({ dev: 'ana', type: 'thinking', ts: 2000 })
    sm.applyEvent({ dev: 'ana', type: 'agent_end', ts: 3000 })
    expect(sm.getAll()['ana'].thinking).toBe(false)
  })

  it('auto-clears thinking after 10s timeout', () => {
    sm.applyEvent({ dev: 'ana', color: '#ff0000', type: 'session_start', ts: 1000 })
    sm.applyEvent({ dev: 'ana', type: 'thinking', ts: 2000 })
    vi.advanceTimersByTime(10_001)
    expect(sm.getAll()['ana'].thinking).toBe(false)
  })

  it('sets celebrating=true on commit', () => {
    sm.applyEvent({ dev: 'ana', color: '#ff0000', type: 'session_start', ts: 1000 })
    sm.applyEvent({ dev: 'ana', type: 'commit', ts: 2000 })
    expect(sm.getAll()['ana'].celebrating).toBe(true)
  })

  it('auto-clears celebrating after 3s', () => {
    sm.applyEvent({ dev: 'ana', color: '#ff0000', type: 'session_start', ts: 1000 })
    sm.applyEvent({ dev: 'ana', type: 'commit', ts: 2000 })
    vi.advanceTimersByTime(3_001)
    expect(sm.getAll()['ana'].celebrating).toBe(false)
  })

  it('marks dev offline after 30min heartbeat', () => {
    sm.applyEvent({ dev: 'ana', color: '#ff0000', type: 'session_start', ts: 1000 })
    vi.advanceTimersByTime(30 * 60 * 1000 + 1)
    expect(sm.getAll()['ana'].online).toBe(false)
  })

  it('ignores events from unknown dev for non-session_start types', () => {
    sm.applyEvent({ dev: 'ghost', type: 'thinking', ts: 1000 })
    expect(sm.getAll()['ghost']).toBeUndefined()
  })

  it('getPatches returns what changed', () => {
    sm.applyEvent({ dev: 'ana', color: '#ff0000', type: 'session_start', ts: 1000 })
    sm.applyEvent({ dev: 'ana', type: 'thinking', ts: 1500 })
    const patches = sm.applyEvent({ dev: 'ana', type: 'agent_start', agent: 'crombie:reviewer', ts: 2000 })
    expect(patches).toEqual([{ dev: 'ana', patch: { activeAgent: 'crombie:reviewer', thinking: false, lastSeen: 2000 } }])
  })

  it('updates color on reconnect if color changed', () => {
    sm.applyEvent({ dev: 'ana', color: '#ff0000', type: 'session_start', ts: 1000 })
    sm.applyEvent({ dev: 'ana', color: '#00ff00', type: 'session_start', ts: 2000 })
    expect(sm.getAll()['ana'].color).toBe('#00ff00')
  })
})
