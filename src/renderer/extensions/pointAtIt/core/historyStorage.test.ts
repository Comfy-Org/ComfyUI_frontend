import { describe, expect, it } from 'vitest'

import { manyTurns, oneTurn, withUnsent } from './historyFixtures'
import {
  conversationFrom,
  fitWithin,
  highestIdNumber,
  historyKey,
  parseStored,
  storedFrom
} from './historyStorage'

function written(stored: unknown): string {
  return JSON.stringify(stored)
}

describe('the stored history', () => {
  it('HS-01: comes back as it was: turns with questions, answers, what was done, threads, thinking and send time, and the unsent questions', () => {
    const conversation = withUnsent()

    const restored = parseStored(written(storedFrom(conversation, null, 1000)))

    expect(restored && conversationFrom(restored)).toEqual(conversation)
    expect(conversation.turns[0]).toMatchObject({
      sentAt: 1_700_000_000_000,
      thinking: 'Checking the width.',
      steps: [{ result: 'accepted', valueBefore: 1024 }, {}, {}],
      followUps: [{ text: 'a bit more than that' }]
    })
  })

  it('HS-18: holds the conversation and nothing else', () => {
    expect(Object.keys(storedFrom(withUnsent(), null, 1000))).toEqual([
      'version',
      'savedAt',
      'turns',
      'unsent',
      'pendingFollowUp'
    ])
  })

  it('names the entry after the workflow', () => {
    expect(historyKey('0b1c-workflow')).toBe(
      'Comfy.PointAtItPoc.history.0b1c-workflow'
    )
  })

  it.for([
    { name: 'nothing stored', raw: null },
    { name: 'text that is not JSON', raw: '{"version":1,' },
    {
      name: 'another version',
      raw: written({ ...storedFrom(oneTurn(), null, 1000), version: 2 })
    },
    {
      name: 'a history with one broken step deep inside',
      raw: written(storedFrom(oneTurn(), null, 1000)).replace(
        '"text":"Now run it."',
        '"text":7'
      )
    },
    {
      name: 'a history whose pin names no valid node',
      raw: written(storedFrom(oneTurn(), null, 1000)).replace(
        '"nodeId":"5"',
        '"nodeId":5'
      )
    },
    { name: 'a list', raw: '[]' }
  ])('HS-10: $name is ignored as a whole', ({ raw }) => {
    expect(parseStored(raw)).toBeNull()
  })

  it('HS-10: the broken examples really differ from a history that loads', () => {
    expect(
      parseStored(written(storedFrom(oneTurn(), null, 1000)))
    ).not.toBeNull()
  })
})

describe('fitWithin', () => {
  const turnChars = written(manyTurns(1, 0).turns[0]).length

  it('HS-11: a history under the cap is stored as it is', () => {
    const stored = storedFrom(manyTurns(3, 500), null, 1000)

    expect(fitWithin(stored, 100_000)).toBe(stored)
  })

  it('HS-11: thinking goes first, from the oldest turn, and every turn stays', () => {
    const stored = storedFrom(manyTurns(3, 500), null, 1000)

    const fitted = fitWithin(stored, written(stored).length - 600)

    expect(fitted.turns.map((kept) => kept.thinking.length)).toEqual([
      0, 0, 500
    ])
    expect(fitted.turns.map((kept) => kept.id)).toEqual(
      stored.turns.map((kept) => kept.id)
    )
  })

  it('HS-11: with no thinking left, whole turns go, oldest first, and unsent questions stay', () => {
    const conversation = {
      turns: manyTurns(4, 500).turns,
      unsent: withUnsent().unsent
    }
    const stored = storedFrom(conversation, null, 1000)

    const fitted = fitWithin(stored, turnChars * 2 + 400)

    expect(fitted.turns.map((kept) => kept.id)).toEqual(['turn-6', 'turn-8'])
    expect(fitted.turns.every((kept) => kept.thinking === '')).toBe(true)
    expect(fitted.unsent).toEqual(conversation.unsent)
  })

  it('HS-11: a follow-up’s thinking goes with its turn’s', () => {
    const stored = storedFrom(oneTurn('t'.repeat(400)), null, 1000)

    const fitted = fitWithin(stored, written(stored).length - 410)

    expect(fitted.turns[0]).toMatchObject({
      thinking: '',
      followUps: [{ thinking: '', text: 'a bit more than that' }]
    })
  })
})

describe('what comes back for a follow-up that had no reply', () => {
  const pending = { commentId: 'comment-1', text: 'and taller?' }

  it('HS-07: its text is an unsent question pinned where its thread’s question is pinned, with an id of its own', () => {
    const conversation = withUnsent()

    const restored = conversationFrom(storedFrom(conversation, pending, 1000))

    expect(restored.turns).toEqual(conversation.turns)
    expect(restored.unsent).toEqual([
      ...conversation.unsent,
      {
        id: 'comment-7',
        targets: conversation.turns[0].comments[0].targets,
        label: conversation.turns[0].comments[0].label,
        comment: 'and taller?'
      }
    ])
  })

  it('HS-07: when its thread is no longer stored, the text still comes back, pinned on nothing', () => {
    const stored = storedFrom(withUnsent(), pending, 1000)

    const restored = conversationFrom({ ...stored, turns: [] })

    expect(restored.unsent.at(-1)).toEqual({
      id: 'comment-7',
      targets: [],
      label: '',
      comment: 'and taller?'
    })
  })
})

describe('highestIdNumber', () => {
  it('HS-16: is the highest number used by any question, turn, follow-up or marked interface element', () => {
    expect(highestIdNumber(withUnsent())).toBe(6)
    expect(highestIdNumber(oneTurn())).toBe(5)
    expect(
      highestIdNumber({
        turns: [],
        unsent: [oneTurn().turns[0].comments[1]]
      })
    ).toBe(4)
    expect(highestIdNumber({ turns: [], unsent: [] })).toBe(0)
  })
})
