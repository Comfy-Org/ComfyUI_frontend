import { describe, expect, it } from 'vitest'

import { toTurnId } from '../schemas/agentApiSchema'
import type {
  ChatSession,
  HistoryGroups
} from '../stores/agent/agentChatHistoryStore'
import type { ConversationEntry } from '../stores/agent/agentConversationStore'

import { deriveSessionTitle, withCurrentSessionTitle } from './sessionTitle'

function userEntry(text: string): ConversationEntry {
  return { id: toTurnId('turn-1'), role: 'user', text }
}

describe('deriveSessionTitle', () => {
  it.for([
    ['a ZWJ family emoji', '👨‍👩‍👧‍👦'],
    ['a flag', '🇺🇸'],
    ['a letter with a combining accent', 'é']
  ])('keeps %s whole at the truncation boundary', ([, cluster]) => {
    expect(
      deriveSessionTitle([userEntry(`${'a'.repeat(59)}${cluster}tail`)])
    ).toBe(`${'a'.repeat(59)}${cluster}`)
  })

  it('does not leave trailing whitespace at the truncation boundary', () => {
    expect(deriveSessionTitle([userEntry(`${'a'.repeat(59)} tail`)])).toBe(
      'a'.repeat(59)
    )
  })

  it('returns undefined without a user message', () => {
    expect(deriveSessionTitle([])).toBeUndefined()
  })
})

describe('withCurrentSessionTitle', () => {
  const session = (
    id: string,
    titleSource: ChatSession['titleSource']
  ): ChatSession => ({ id, title: `preview ${id}`, updatedAt: 1, titleSource })

  const groupsOf = (current: ChatSession[], today: ChatSession[] = []) =>
    ({ current, today, yesterday: [], earlier: [] }) satisfies HistoryGroups

  it('replaces the preview of the active fallback session', () => {
    const groups = groupsOf([session('a', 'fallback')])

    expect(
      withCurrentSessionTitle(groups, 'First message').current[0]?.title
    ).toBe('First message')
  })

  it('keeps a server-authored title', () => {
    const groups = groupsOf([session('a', 'server')])

    expect(
      withCurrentSessionTitle(groups, 'First message').current[0]?.title
    ).toBe('preview a')
  })

  it('leaves sessions outside the current group untouched', () => {
    const groups = groupsOf(
      [session('a', 'fallback')],
      [session('b', 'fallback')]
    )

    expect(withCurrentSessionTitle(groups, 'First message').today).toEqual([
      session('b', 'fallback')
    ])
  })

  it('leaves the groups untouched without a title', () => {
    const groups = groupsOf([session('a', 'fallback')])

    expect(withCurrentSessionTitle(groups, undefined)).toBe(groups)
  })
})
