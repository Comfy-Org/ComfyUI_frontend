import { describe, expect, it } from 'vitest'

import { toTurnId } from '../../schemas/agentApiSchema'
import type { ConversationEntry } from '../../stores/agent/agentConversationStore'
import { hideResolvedPaywalls } from './agentPaywallVisibility'

const userEntry = (id: string, text: string): ConversationEntry => ({
  id: toTurnId(id),
  role: 'user',
  text
})

const assistantEntry = (
  id: string,
  parts: Extract<ConversationEntry, { role: 'assistant' }>['parts']
): ConversationEntry => ({
  id: toTurnId(id),
  role: 'assistant',
  parts,
  streaming: false,
  thinking: false
})

const paywallTurn = (id: string, text: string): ConversationEntry[] => [
  userEntry(id, text),
  assistantEntry(id, [{ type: 'paywall' }])
]

const roles = (entries: ConversationEntry[]) =>
  entries.map((entry) => entry.role)

describe('hideResolvedPaywalls', () => {
  it.for([
    { name: 'funds unknown', fundsAvailable: false },
    { name: 'funds available', fundsAvailable: true }
  ])(
    'returns the same array when no paywall is present ($name)',
    ({ fundsAvailable }) => {
      const entries = [
        userEntry('t1', 'hello'),
        assistantEntry('t1', [{ type: 'text', text: 'hi', state: 'done' }])
      ]

      expect(hideResolvedPaywalls(entries, fundsAvailable)).toBe(entries)
    }
  )

  it('keeps the paywall while billing has not reported funds', () => {
    const entries = paywallTurn('t1', 'continue')

    expect(hideResolvedPaywalls(entries, false)).toBe(entries)
  })

  it('drops a paywall-only turn rather than leaving an empty message', () => {
    const entries = paywallTurn('t1', 'continue')

    const visible = hideResolvedPaywalls(entries, true)

    expect(roles(visible)).toEqual(['user'])
    expect(visible[0]).toMatchObject({ role: 'user', text: 'continue' })
  })

  it('keeps the rest of a message that also carries a paywall', () => {
    const entries = [
      assistantEntry('t1', [
        { type: 'text', text: 'almost there', state: 'done' },
        { type: 'paywall' }
      ])
    ]

    expect(hideResolvedPaywalls(entries, true)).toEqual([
      assistantEntry('t1', [
        { type: 'text', text: 'almost there', state: 'done' }
      ])
    ])
  })

  it('hides a paywall that arrives after funds were already confirmed', () => {
    const settled = hideResolvedPaywalls([], true)
    expect(settled).toEqual([])

    const late = hideResolvedPaywalls(paywallTurn('t1', 'continue'), true)

    expect(roles(late)).toEqual(['user'])
  })

  it('hides paywalls loaded by history hydration with no transition to observe', () => {
    const hydrated = [
      ...paywallTurn('t1', 'subscribe'),
      ...paywallTurn('t2', 'continue')
    ]

    expect(roles(hideResolvedPaywalls(hydrated, true))).toEqual([
      'user',
      'user'
    ])
  })

  it('shows the paywall again when funds oscillate back out', () => {
    const entries = paywallTurn('t1', 'continue')

    expect(roles(hideResolvedPaywalls(entries, true))).toEqual(['user'])
    expect(hideResolvedPaywalls(entries, false)).toBe(entries)
    expect(roles(hideResolvedPaywalls(entries, true))).toEqual(['user'])
  })

  it('leaves the source transcript untouched', () => {
    const entries = paywallTurn('t1', 'continue')
    const before = structuredClone(entries)

    hideResolvedPaywalls(entries, true)

    expect(entries).toEqual(before)
  })
})
