import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock(import('./agentAuth'))

import { peekLastAgentCredential } from './agentAuth'
import {
  captureOutgoingCredentialForHandoff,
  rememberPreviousCredentialForHandoff,
  takePendingPreviousCredential
} from './agentOwnerHandoff'

beforeEach(() => {
  rememberPreviousCredentialForHandoff(null)
})

describe('the owner-handoff credential mailbox (BE-25360)', () => {
  it('returns a remembered credential once, then null', () => {
    rememberPreviousCredentialForHandoff('old-cred')

    expect(takePendingPreviousCredential()).toBe('old-cred')
    expect(takePendingPreviousCredential()).toBeNull()
  })

  it('is empty until something is remembered', () => {
    expect(takePendingPreviousCredential()).toBeNull()
  })

  it('snapshots whatever the outgoing account last used', () => {
    vi.mocked(peekLastAgentCredential).mockReturnValue('outgoing-cred')

    captureOutgoingCredentialForHandoff()

    expect(takePendingPreviousCredential()).toBe('outgoing-cred')
  })

  it('snapshots null when no agent request had attached a credential yet', () => {
    vi.mocked(peekLastAgentCredential).mockReturnValue(null)
    rememberPreviousCredentialForHandoff('stale')

    captureOutgoingCredentialForHandoff()

    expect(takePendingPreviousCredential()).toBeNull()
  })
})
