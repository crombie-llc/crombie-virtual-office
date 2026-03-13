import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useWebSocket } from './useWebSocket'

// Mock WebSocket
class MockWS {
  static instances: MockWS[] = []
  onopen: (() => void) | null = null
  onmessage: ((e: { data: string }) => void) | null = null
  onclose: (() => void) | null = null
  onerror: (() => void) | null = null
  readyState = 0
  constructor () { MockWS.instances.push(this) }
  close () {}
  simulateOpen () { this.readyState = 1; this.onopen?.() }
  simulateMessage (data: object) { this.onmessage?.({ data: JSON.stringify(data) }) }
  simulateClose () { this.onclose?.() }
}

beforeEach(() => {
  MockWS.instances = []
  vi.stubGlobal('WebSocket', MockWS)
})

describe('useWebSocket', () => {
  it('starts with empty state', () => {
    const { result } = renderHook(() => useWebSocket('ws://localhost:4242'))
    expect(result.current.state).toEqual({})
    expect(result.current.connected).toBe(false)
  })

  it('sets connected=true on open', () => {
    const { result } = renderHook(() => useWebSocket('ws://localhost:4242'))
    act(() => MockWS.instances[0].simulateOpen())
    expect(result.current.connected).toBe(true)
  })

  it('populates state from full_state message', () => {
    const { result } = renderHook(() => useWebSocket('ws://localhost:4242'))
    act(() => {
      MockWS.instances[0].simulateOpen()
      MockWS.instances[0].simulateMessage({
        type: 'full_state',
        state: { ana: { name: 'ana', color: '#ff0000', online: true, activeAgent: null, thinking: false, celebrating: false, lastSeen: 1 } }
      })
    })
    expect(result.current.state['ana']?.online).toBe(true)
  })

  it('applies patch message to existing state', () => {
    const { result } = renderHook(() => useWebSocket('ws://localhost:4242'))
    act(() => {
      MockWS.instances[0].simulateOpen()
      MockWS.instances[0].simulateMessage({
        type: 'full_state',
        state: { ana: { name: 'ana', color: '#ff0000', online: true, activeAgent: null, thinking: false, celebrating: false, lastSeen: 1 } }
      })
      MockWS.instances[0].simulateMessage([{ dev: 'ana', patch: { thinking: true } }])
    })
    expect(result.current.state['ana']?.thinking).toBe(true)
  })

  it('sets connected=false on close', () => {
    const { result } = renderHook(() => useWebSocket('ws://localhost:4242'))
    act(() => {
      MockWS.instances[0].simulateOpen()
      MockWS.instances[0].simulateClose()
    })
    expect(result.current.connected).toBe(false)
  })
})
