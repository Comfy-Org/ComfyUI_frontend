import { describe, expect, it } from 'vitest'

import enMain from '@/locales/en/main.json'

import {
  STARTER_PROMPT_IDS,
  starterPromptAttribution,
  starterPromptIdAt,
  starterPromptTextHash
} from './starterPrompts'

describe('starter prompt identity', () => {
  it('has one id per prompt the empty state renders', () => {
    // If this fails, a prompt was added to or removed from
    // `agent.suggestedPrompts` and `STARTER_PROMPT_IDS` needs the same change in
    // the same position. Until it gets one the extra chip reports
    // `unregistered`, which is readable but not comparable.
    expect(STARTER_PROMPT_IDS).toHaveLength(
      enMain.agent.suggestedPrompts.length
    )
  })

  it('names a slot beyond the table rather than borrowing a neighbour', () => {
    expect(starterPromptIdAt(STARTER_PROMPT_IDS.length)).toBe('unregistered')
    expect(starterPromptIdAt(99)).toBe('unregistered')
  })

  it('keeps the id stable when the copy changes', () => {
    const before = starterPromptAttribution(
      'List my saved workflows',
      1,
      5,
      'en'
    )
    const after = starterPromptAttribution('Show me my workflows', 1, 5, 'en')

    expect(after.promptId).toBe(before.promptId)
    expect(after.promptTextHash).not.toBe(before.promptTextHash)
  })

  it('hashes to eight hex characters, deterministically', () => {
    const text = 'Explain the selected node'

    expect(starterPromptTextHash(text)).toMatch(/^[0-9a-f]{8}$/)
    expect(starterPromptTextHash(text)).toBe(starterPromptTextHash(text))
    expect(starterPromptTextHash(text)).not.toBe(starterPromptTextHash(''))
  })

  it('carries the slot, the set size and the locale that produced the hash', () => {
    expect(
      starterPromptAttribution('Explain the selected node', 3, 5, 'zh')
    ).toEqual({
      promptId: 'explain_selected_node',
      promptIndex: 3,
      promptCount: 5,
      promptTextHash: starterPromptTextHash('Explain the selected node'),
      locale: 'zh'
    })
  })
})
