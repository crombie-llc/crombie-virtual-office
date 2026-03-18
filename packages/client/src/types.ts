export interface DeveloperState {
  name: string
  color: string
  online: boolean
  activeAgent: string | null
  thinking: boolean
  celebrating: boolean
  lastSeen: number
}

export type OfficeState = Record<string, DeveloperState>

export type WsMessage =
  | { type: 'full_state'; state: OfficeState }
  | Array<{ dev: string; patch: Partial<DeveloperState> }>

export interface MascotConfig {
  color: number
  accentColor: number
  label: string
  bounceHeight: number
}
