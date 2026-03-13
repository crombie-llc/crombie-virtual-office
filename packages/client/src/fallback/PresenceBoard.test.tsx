import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { PresenceBoard } from './PresenceBoard'
import type { OfficeState } from '../types'

const state: OfficeState = {
  ana: { name: 'ana', color: '#ff0000', online: true, activeAgent: 'crombie:reviewer', thinking: false, celebrating: false, lastSeen: 1 },
  bob: { name: 'bob', color: '#00ff00', online: false, activeAgent: null, thinking: false, celebrating: false, lastSeen: 1 }
}

describe('PresenceBoard', () => {
  it('renders all developer names', () => {
    render(<PresenceBoard state={state} connected={true} />)
    expect(screen.getByText('ana')).toBeInTheDocument()
    expect(screen.getByText('bob')).toBeInTheDocument()
  })

  it('shows 🤖 when agent is active', () => {
    render(<PresenceBoard state={state} connected={true} />)
    expect(screen.getByText(/🤖/)).toBeInTheDocument()
  })

  it('shows offline label for offline dev', () => {
    render(<PresenceBoard state={state} connected={true} />)
    expect(screen.getByText(/offline/i)).toBeInTheDocument()
  })

  it('shows disconnected banner when not connected', () => {
    render(<PresenceBoard state={state} connected={false} />)
    expect(screen.getByText(/connecting/i)).toBeInTheDocument()
  })
})
