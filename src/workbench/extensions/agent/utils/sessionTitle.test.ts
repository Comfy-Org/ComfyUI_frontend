import { describe, expect, it } from 'vitest'

import { toTurnId } from '../schemas/agentApiSchema'
import type { ConversationEntry } from '../stores/agent/agentConversationStore'

import { deriveSessionTitle } from './sessionTitle'

function userEntry(text: string): ConversationEntry {
  return { id: toTurnId('turn-1'), role: 'user', text }
}

describe('deriveSessionTitle', () => {
  it('truncates by code point without splitting non-BMP characters', () => {
    expect(deriveSessionTitle([userEntry(`${'a'.repeat(59)}😀tail`)])).toBe(
      `${'a'.repeat(59)}😀`
    )
  })

  it('does not leave trailing whitespace at the truncation boundary', () => {
    expect(deriveSessionTitle([userEntry(`${'a'.repeat(59)} tail`)])).toBe(
      'a'.repeat(59)
    )
  })
})
