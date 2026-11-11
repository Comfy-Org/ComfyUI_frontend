import { describe, expect, it } from 'vitest'

import { createNodeLocatorId } from '@comfyorg/graph-model/nodeIdentification'

import { settingAddress } from './fakePointHost'
import { messages } from './messages'
import type { GuidanceStep } from './replyValidation'
import { turnCards, turnOfAnswer, turnStripItems } from './turnGrouping'
import type { BarItem, DotItem, StripItem } from './turnGrouping'
import { emptyConversation, reduceConversation } from './turns'
import type { Conversation } from './turns'

const width = settingAddress(createNodeLocatorId(null, 5), 'width')
const FIRST_SENT_AT = Date.UTC(2026, 10, 11, 14, 0)
const MINUTE = 60_000
const OPTIONS = { visibleDots: 8, barSize: 5 }

function answerTo(commentId: string, text: string): GuidanceStep {
  return {
    annotationId: commentId,
    text,
    target: width,
    waitFor: null,
    offerEdit: null,
    problems: []
  }
}

function withTurn(
  state: Conversation,
  number: number,
  questions: string[] = [`question ${number}`],
  answer: string | null = `answer ${number}`
): Conversation {
  const saved = questions.reduce(
    (current, text, index) =>
      reduceConversation(current, {
        type: 'saved',
        id: `comment-${number}-${index + 1}`,
        targets: [width],
        label: 'Empty Latent Image › width',
        comment: text
      }),
    state
  )
  return reduceConversation(saved, {
    type: 'answered',
    turnId: `turn-${number}`,
    sentAt: FIRST_SENT_AT + (number - 1) * MINUTE,
    steps: answer === null ? [] : [answerTo(`comment-${number}-1`, answer)],
    thinking: `thinking ${number}`
  })
}

function conversationOf(turnCount: number): Conversation {
  return Array.from({ length: turnCount }).reduce<Conversation>(
    (state, _, index) => withTurn(state, index + 1),
    emptyConversation
  )
}

function kinds(items: StripItem[]): string[] {
  return items.map((item) => item.kind)
}

function dots(items: StripItem[]): DotItem[] {
  return items.filter((item) => item.kind === 'dot')
}

function bars(items: StripItem[]): BarItem[] {
  return items.filter((item) => item.kind === 'bar')
}

describe('turnStripItems', () => {
  it('TS-02: has nothing to show before the first answered turn, even with questions waiting to be sent', () => {
    const unsent = reduceConversation(emptyConversation, {
      type: 'saved',
      id: 'comment-1',
      targets: [width],
      label: 'Empty Latent Image › width',
      comment: 'make this wider'
    })

    expect(turnStripItems(emptyConversation, OPTIONS)).toEqual([])
    expect(turnStripItems(unsent, OPTIONS)).toEqual([])
  })

  it('TS-03: gives each turn below the dot limit a dot, oldest first, and ends with the current dot', () => {
    const items = turnStripItems(conversationOf(3), OPTIONS)

    expect(kinds(items)).toEqual(['dot', 'dot', 'dot', 'current'])
    expect(dots(items).map((item) => item.card.turnId)).toEqual([
      'turn-1',
      'turn-2',
      'turn-3'
    ])
  })

  it('TS-04: gives every turn a dot when there are exactly as many as the limit', () => {
    const items = turnStripItems(conversationOf(8), OPTIONS)

    expect(bars(items)).toHaveLength(0)
    expect(dots(items)).toHaveLength(8)
  })

  it('TS-05: folds the turns past the limit into one bar, keeping dots for the latest', () => {
    const items = turnStripItems(conversationOf(11), OPTIONS)

    expect(kinds(items)).toEqual([
      'bar',
      ...Array.from({ length: 8 }, () => 'dot'),
      'current'
    ])
    expect(bars(items)[0].turnIds).toEqual(['turn-1', 'turn-2', 'turn-3'])
    expect(dots(items)[0].card.turnId).toBe('turn-4')
  })

  it('TS-06: fills bars to the configured size from the oldest, the newest bar taking what is left', () => {
    const items = turnStripItems(conversationOf(20), OPTIONS)

    expect(bars(items).map((bar) => bar.turnIds.length)).toEqual([5, 5, 2])
    expect(bars(items).at(-1)?.turnIds).toEqual(['turn-11', 'turn-12'])
    expect(dots(items).map((item) => item.card.number)).toEqual([
      13, 14, 15, 16, 17, 18, 19, 20
    ])
  })

  it('TS-06: a new turn leaves the turns already grouped into full bars where they were', () => {
    const before = bars(turnStripItems(conversationOf(20), OPTIONS))
    const after = bars(
      turnStripItems(withTurn(conversationOf(20), 21), OPTIONS)
    )

    expect(after.slice(0, 2).map((bar) => bar.turnIds)).toEqual(
      before.slice(0, 2).map((bar) => bar.turnIds)
    )
    expect(after.at(-1)?.turnIds).toEqual(['turn-11', 'turn-12', 'turn-13'])
  })

  it('TS-06: follows the configured numbers', () => {
    const items = turnStripItems(conversationOf(7), {
      visibleDots: 2,
      barSize: 2
    })

    expect(bars(items).map((bar) => bar.turnIds.length)).toEqual([2, 2, 1])
    expect(dots(items)).toHaveLength(2)
  })

  it('TS-06: never makes an empty bar or a negative number of dots from a bad configuration', () => {
    const items = turnStripItems(conversationOf(3), {
      visibleDots: -1,
      barSize: 0
    })

    expect(bars(items).map((bar) => bar.turnIds.length)).toEqual([1, 1, 1])
    expect(dots(items)).toHaveLength(0)
  })

  it('TS-07: the current dot is last, whether or not questions wait, and names how many', () => {
    const waiting = reduceConversation(conversationOf(2), {
      type: 'saved',
      id: 'comment-9',
      targets: [width],
      label: 'Empty Latent Image › width',
      comment: 'and taller?'
    })

    expect(turnStripItems(conversationOf(2), OPTIONS).at(-1)).toEqual({
      kind: 'current',
      label: messages.nextTurnLabel(0)
    })
    expect(turnStripItems(waiting, OPTIONS).at(-1)).toEqual({
      kind: 'current',
      label: messages.nextTurnLabel(1)
    })
  })
})

describe('turnCards', () => {
  it('TS-08: a turn with one question gives that question, the start of the answer, its place and the time sent', () => {
    const [card] = turnCards(
      withTurn(
        emptyConversation,
        1,
        ['make this wider'],
        'Change width to 1280.'
      )
    )

    expect(card).toMatchObject({
      turnId: 'turn-1',
      questions: [{ commentId: 'comment-1-1', text: 'make this wider' }],
      more: '',
      answer: 'Change width to 1280.',
      position: 'turn 1 of 1',
      sentAt: FIRST_SENT_AT,
      thinking: 'thinking 1',
      label: 'Turn 1 of 1: make this wider'
    })
    expect(card.time).toMatch(/\d{1,2}[:.]\d{2}/)
  })

  it('TS-09: a turn with several questions lists them all, leads with the first and counts the rest', () => {
    const cards = turnCards(
      withTurn(withTurn(emptyConversation, 1), 2, [
        'make this wider',
        'what is this?',
        'and taller?'
      ])
    )

    expect(cards[1]).toMatchObject({
      questions: [
        { commentId: 'comment-2-1', text: 'make this wider' },
        { commentId: 'comment-2-2', text: 'what is this?' },
        { commentId: 'comment-2-3', text: 'and taller?' }
      ],
      more: '+2 more questions',
      position: 'turn 2 of 2'
    })
    expect(turnCards(withTurn(emptyConversation, 1, ['a', 'b']))[0].more).toBe(
      '+1 more question'
    )
  })

  it('TS-10: a turn without an answer has an empty answer, and a long question is shortened only in the accessible name', () => {
    const long = `${'very wide '.repeat(20)}end`
    const [card] = turnCards(withTurn(emptyConversation, 1, [long], null))

    expect(card.answer).toBe('')
    expect(card.questions[0].text).toBe(long)
    expect(card.label.length).toBeLessThan(long.length)
    expect(card.label).toMatch(/^Turn 1 of 1: very wide .*…$/)
  })

  it('TS-11: a bar is titled with its first turn’s first question and gives the time range and the count', () => {
    const [bar] = bars(turnStripItems(conversationOf(11), OPTIONS))

    expect(bar).toMatchObject({
      title: 'question 1',
      count: '3 turns',
      label: 'Turns 1 to 3: question 1'
    })
    expect(bar.range).toMatch(/\d{1,2}[:.]\d{2}.+\d{1,2}[:.]\d{2}/)
    expect(bar.turns.map((turn) => turn.questions[0].text)).toEqual([
      'question 1',
      'question 2',
      'question 3'
    ])
  })

  it('TS-11: a bar of one turn says “1 turn” and one time', () => {
    const [bar] = bars(turnStripItems(conversationOf(9), OPTIONS))

    expect(bar.count).toBe('1 turn')
    expect(bar.range).toMatch(/^\d{1,2}[:.]\d{2}\D*$/)
  })
})

describe('turnOfAnswer', () => {
  it('TS-12: finds the turn a shown answer belongs to, by the question it answers', () => {
    const conversation = withTurn(conversationOf(2), 3, ['a', 'b'])

    expect(turnOfAnswer(conversation, 'comment-3-2')).toBe('turn-3')
    expect(turnOfAnswer(conversation, 'comment-1-1')).toBe('turn-1')
  })

  it('TS-12: finds none for no question, an unknown one or one not sent yet', () => {
    const unsent = reduceConversation(conversationOf(1), {
      type: 'saved',
      id: 'comment-9',
      targets: [width],
      label: 'Empty Latent Image › width',
      comment: 'and taller?'
    })

    expect(turnOfAnswer(unsent, null)).toBeNull()
    expect(turnOfAnswer(unsent, 'unknown')).toBeNull()
    expect(turnOfAnswer(unsent, 'comment-9')).toBeNull()
  })
})
