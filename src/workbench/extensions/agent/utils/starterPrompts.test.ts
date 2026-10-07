import { describe, expect, it } from 'vitest'

import enMain from '@/locales/en/main.json'

import {
  STARTER_PROMPT_IDS,
  starterPromptAttribution,
  starterPromptIdAt
} from './starterPrompts'

describe('starter prompt identity', () => {
  it('has one id per prompt the empty state renders', () => {
    expect(STARTER_PROMPT_IDS).toHaveLength(
      enMain.agent.suggestedPrompts.cloud.length
    )
    expect(STARTER_PROMPT_IDS).toHaveLength(
      enMain.agent.suggestedPrompts.local.length
    )
    expect(STARTER_PROMPT_IDS).toHaveLength(
      enMain.agent.suggestedPrompts.treatment.cloud.length
    )
    expect(STARTER_PROMPT_IDS).toHaveLength(
      enMain.agent.suggestedPrompts.treatment.local.length
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
    const first = starterPromptAttribution(text, 3, 5, 'en').promptTextHash
    const second = starterPromptAttribution(text, 3, 5, 'en').promptTextHash
    const empty = starterPromptAttribution('', 3, 5, 'en').promptTextHash

    expect(first).toMatch(/^[0-9a-f]{8}$/)
    expect(first).toBe(second)
    expect(first).not.toBe(empty)
  })

  it('pins known hash vectors, including a leading-zero result', () => {
    expect(
      starterPromptAttribution('List my saved workflows', 1, 5, 'en')
        .promptTextHash
    ).toBe('3d98efb0')
    expect(
      starterPromptAttribution('prompt-130', 1, 5, 'en').promptTextHash
    ).toBe('00657dba')
  })

  it('carries the slot, the set size and the locale that produced the hash', () => {
    expect(
      starterPromptAttribution('Explain the selected node', 3, 5, 'zh')
    ).toEqual({
      promptId: 'slot_4',
      promptIndex: 3,
      promptCount: 5,
      promptTextHash: '3849a858',
      locale: 'zh'
    })
  })
})
