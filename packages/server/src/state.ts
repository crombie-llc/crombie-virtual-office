export interface DeveloperState {
  name: string
  color: string
  online: boolean
  activeAgent: string | null
  thinking: boolean
  celebrating: boolean
  lastSeen: number
}

export type OfficePatch = { dev: string; patch: Partial<DeveloperState> }

export type OfficeEvent = {
  dev: string
  type: 'session_start' | 'session_end' | 'agent_start' | 'agent_end' | 'thinking' | 'commit'
  color?: string
  agent?: string
  ts: number
}

const HEX_RE = /^#[0-9a-fA-F]{6}$/
const DEFAULT_COLOR = '#4a9eff'
const THINKING_TIMEOUT_MS = 10_000
const CELEBRATING_TIMEOUT_MS = 3_000
const HEARTBEAT_TIMEOUT_MS = 30 * 60 * 1000

export class StateManager {
  private state = new Map<string, DeveloperState>()
  private thinkingTimers = new Map<string, ReturnType<typeof setTimeout>>()
  private celebratingTimers = new Map<string, ReturnType<typeof setTimeout>>()
  private heartbeatTimers = new Map<string, ReturnType<typeof setTimeout>>()
  private onPatch?: (patches: OfficePatch[]) => void

  setOnPatch(cb: (patches: OfficePatch[]) => void) {
    this.onPatch = cb
  }

  applyEvent(event: OfficeEvent): OfficePatch[] {
    const { dev, type, ts } = event

    if (type === 'session_start') {
      const color = event.color && HEX_RE.test(event.color) ? event.color : DEFAULT_COLOR
      if (!this.state.has(dev)) {
        this.state.set(dev, {
          name: dev, color, online: true,
          activeAgent: null, thinking: false, celebrating: false, lastSeen: ts
        })
      } else {
        this.state.get(dev)!.online = true
        this.state.get(dev)!.lastSeen = ts
      }
      this.resetHeartbeat(dev)
      const patch: OfficePatch = { dev, patch: { online: true, lastSeen: ts } }
      this.onPatch?.([patch])
      return [patch]
    }

    const s = this.state.get(dev)
    if (!s) return []

    s.lastSeen = ts
    this.resetHeartbeat(dev)

    // Clear thinking on any event
    const wasThinking = s.thinking
    if (wasThinking && type !== 'thinking') {
      s.thinking = false
      this.clearThinkingTimer(dev)
    }

    const changed: Partial<DeveloperState> = { lastSeen: ts }

    // Always report thinking state when it's not a thinking event (either cleared now, or confirming it's false)
    if (type !== 'thinking') changed.thinking = false

    switch (type) {
      case 'session_end':
        s.online = false
        changed.online = false
        break
      case 'agent_start':
        s.activeAgent = event.agent ?? 'unknown'
        changed.activeAgent = s.activeAgent
        break
      case 'agent_end':
        s.activeAgent = null
        changed.activeAgent = null
        break
      case 'thinking':
        s.thinking = true
        changed.thinking = true
        this.setThinkingTimer(dev)
        break
      case 'commit':
        s.celebrating = true
        changed.celebrating = true
        this.setCelebratingTimer(dev)
        break
    }

    const patch: OfficePatch = { dev, patch: changed }
    this.onPatch?.([patch])
    return [patch]
  }

  getAll(): Record<string, DeveloperState> {
    return Object.fromEntries(this.state)
  }

  private setThinkingTimer(dev: string) {
    this.clearThinkingTimer(dev)
    this.thinkingTimers.set(dev, setTimeout(() => {
      const s = this.state.get(dev)
      if (s?.thinking) {
        s.thinking = false
        const patch: OfficePatch = { dev, patch: { thinking: false } }
        this.onPatch?.([patch])
      }
    }, THINKING_TIMEOUT_MS))
  }

  private clearThinkingTimer(dev: string) {
    const t = this.thinkingTimers.get(dev)
    if (t) { clearTimeout(t); this.thinkingTimers.delete(dev) }
  }

  private setCelebratingTimer(dev: string) {
    const existing = this.celebratingTimers.get(dev)
    if (existing) clearTimeout(existing)
    this.celebratingTimers.set(dev, setTimeout(() => {
      const s = this.state.get(dev)
      if (s?.celebrating) {
        s.celebrating = false
        const patch: OfficePatch = { dev, patch: { celebrating: false } }
        this.onPatch?.([patch])
      }
    }, CELEBRATING_TIMEOUT_MS))
  }

  private resetHeartbeat(dev: string) {
    const t = this.heartbeatTimers.get(dev)
    if (t) clearTimeout(t)
    this.heartbeatTimers.set(dev, setTimeout(() => {
      const s = this.state.get(dev)
      if (s?.online) {
        s.online = false
        const patch: OfficePatch = { dev, patch: { online: false } }
        this.onPatch?.([patch])
      }
    }, HEARTBEAT_TIMEOUT_MS))
  }

  destroy() {
    this.thinkingTimers.forEach(clearTimeout)
    this.celebratingTimers.forEach(clearTimeout)
    this.heartbeatTimers.forEach(clearTimeout)
  }
}
