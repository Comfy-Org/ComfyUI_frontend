import { describe, expect, it } from 'vitest'

import { createNodeLocatorId } from '@comfyorg/graph-model/nodeIdentification'

import { settingAddress } from './fakePointHost'
import { messages } from './messages'
import type { GuidanceStep } from './replyValidation'
import {
  emptyConversation,
  historyOf,
  latestAnswer,
  messagesBefore,
  numberedComments,
  reduceConversation,
  threadNotes,
  threadOf
} from './turns'
import type { Annotation, Conversation, ConversationEvent } from './turns'

const width = settingAddress(createNodeLocatorId(null, 5), 'width')

function annotation(id: string, comment: string): Annotation {
  return { id, targets: [width], label: 'Empty Latent Image › width', comment }
}

const first = annotation('comment-1', 'make this wider')
const second = annotation('comment-2', 'what is this?')
const third = annotation('comment-3', 'a bit more than that')

const widen: GuidanceStep = {
  annotationId: 'comment-1',
  text: 'Change width to 1280.',
  target: width,
  waitFor: { for: 'valueChange', of: width, direction: 'increase' },
  offerEdit: { target: width, value: 1280 },
  problems: []
}
const run: GuidanceStep = {
  annotationId: null,
  text: 'Now run it.',
  target: { kind: 'control', control: 'run' },
  waitFor: { for: 'run' },
  offerEdit: null,
  problems: []
}

const SENT_AT = Date.UTC(2026, 10, 11, 14, 30)
const unsentOnly: Conversation = { turns: [], unsent: [first, second] }
const oneTurn = reduceConversation(unsentOnly, {
  type: 'answered',
  turnId: 'turn-1',
  sentAt: SENT_AT,
  steps: [widen, run],
  thinking: 'Checking the width.'
})
const secondTurnOpen = reduceConversation(oneTurn, { type: 'saved', ...third })
const widenMore: GuidanceStep = {
  ...widen,
  text: 'Go to 1408.',
  offerEdit: { target: width, value: 1408 }
}
const moreWidth = {
  type: 'followedUp',
  commentId: 'comment-1',
  followUpId: 'followUp-1',
  text: ' a bit more than that ',
  steps: [widenMore],
  thinking: 'Going a little further.'
} satisfies ConversationEvent
const followedUp = reduceConversation(oneTurn, moreWidth)

describe('reduceConversation', () => {
  it('AN-05: a saved comment joins the unsent comments, trimmed', () => {
    expect(
      reduceConversation(emptyConversation, {
        type: 'saved',
        ...first,
        comment: '  make this wider  '
      })
    ).toEqual({ turns: [], unsent: [first] })
  })

  it('AN-06: a comment with no text stores nothing', () => {
    expect(
      reduceConversation(unsentOnly, { type: 'saved', ...third, comment: ' ' })
    ).toBe(unsentOnly)
  })

  it('AN-09: an unsent comment can be changed in place and deleted', () => {
    const changed = reduceConversation(unsentOnly, {
      type: 'saved',
      ...first,
      comment: 'make this taller'
    })

    expect(changed.unsent).toEqual([
      annotation('comment-1', 'make this taller'),
      second
    ])
    expect(
      reduceConversation(changed, { type: 'removed', id: second.id }).unsent
    ).toEqual([annotation('comment-1', 'make this taller')])
  })

  it('TU-01: an answer locks the sent comments into a turn with its steps and thinking', () => {
    expect(oneTurn).toEqual({
      turns: [
        {
          id: 'turn-1',
          sentAt: SENT_AT,
          comments: [first, second],
          steps: [
            { ...widen, result: null, valueBefore: null },
            { ...run, result: null, valueBefore: null }
          ],
          thinking: 'Checking the width.',
          followUps: []
        }
      ],
      unsent: []
    })
  })

  it.for([
    {
      name: 'edited',
      event: { type: 'saved' as const, ...first, comment: 'x' }
    },
    { name: 'deleted', event: { type: 'removed' as const, id: first.id } }
  ])('TU-01: a locked comment cannot be $name', ({ event }) => {
    expect(reduceConversation(oneTurn, event)).toBe(oneTurn)
  })

  it('TU-02: the next comment starts the next turn and leaves earlier turns alone', () => {
    expect(secondTurnOpen).toEqual({ turns: oneTurn.turns, unsent: [third] })
  })

  it('TU-05: records whether the person took the offered value or changed it themselves', () => {
    const accepted = reduceConversation(oneTurn, {
      type: 'actedOn',
      ref: { turnId: 'turn-1', followUpId: null, index: 0 },
      result: 'accepted',
      valueBefore: 1024
    })

    expect(accepted.turns[0].steps).toMatchObject([
      { result: 'accepted', valueBefore: 1024 },
      { result: null, valueBefore: null }
    ])
    expect(
      reduceConversation(oneTurn, {
        type: 'actedOn',
        ref: { turnId: 'turn-9', followUpId: null, index: 0 },
        result: 'changed',
        valueBefore: 1024
      })
    ).toBe(oneTurn)
  })

  it('TU-07: Clear removes only the unsent comments', () => {
    expect(
      reduceConversation(secondTurnOpen, { type: 'unsentCleared' })
    ).toEqual(oneTurn)
  })

  it('TU-08: Start over removes every turn and every unsent comment', () => {
    expect(reduceConversation(secondTurnOpen, { type: 'startedOver' })).toEqual(
      emptyConversation
    )
  })

  it('returns the same conversation when an event changes nothing', () => {
    expect(
      [
        reduceConversation(oneTurn, { type: 'unsentCleared' }),
        reduceConversation(oneTurn, {
          type: 'answered',
          turnId: 'turn-2',
          sentAt: SENT_AT,
          steps: [run],
          thinking: ''
        }),
        reduceConversation(oneTurn, { type: 'removed', id: 'unknown' })
      ].every((result) => result === oneTurn)
    ).toBe(true)
    expect(reduceConversation(emptyConversation, { type: 'startedOver' })).toBe(
      emptyConversation
    )
  })
})

describe('numberedComments', () => {
  it('TU-03: numbers continue across turns, so a number names one comment', () => {
    expect(
      numberedComments(secondTurnOpen).map(({ annotation, number, turn }) => [
        number,
        annotation.id,
        turn?.id ?? 'unsent'
      ])
    ).toEqual([
      [1, 'comment-1', 'turn-1'],
      [2, 'comment-2', 'turn-1'],
      [3, 'comment-3', 'unsent']
    ])
  })
})

describe('threads', () => {
  it('TH-01: a thread is the comment, the agent’s answer to it, then follow-ups and their replies, in order', () => {
    expect(threadOf(followedUp, 'comment-1')).toEqual({
      turnId: 'turn-1',
      comment: first,
      messages: [
        { kind: 'comment', text: 'make this wider' },
        {
          kind: 'answer',
          ref: { turnId: 'turn-1', followUpId: null, index: 0 },
          step: { ...widen, result: null, valueBefore: null }
        },
        {
          kind: 'followUp',
          id: 'followUp-1',
          text: 'a bit more than that',
          thinking: 'Going a little further.'
        },
        {
          kind: 'answer',
          ref: { turnId: 'turn-1', followUpId: 'followUp-1', index: 0 },
          step: { ...widenMore, result: null, valueBefore: null }
        }
      ]
    })
  })

  it('TH-03: a follow-up starts no turn and leaves the unsent comments and other threads alone', () => {
    const withUnsent = reduceConversation(secondTurnOpen, moreWidth)

    expect(withUnsent.turns).toHaveLength(1)
    expect(withUnsent.unsent).toEqual([third])
    expect(threadOf(withUnsent, 'comment-2')?.messages).toEqual([
      { kind: 'comment', text: 'what is this?' }
    ])
  })

  it.for<{ name: string; event: ConversationEvent }>([
    {
      name: 'a comment that is not sent yet',
      event: { ...moreWidth, commentId: 'comment-3' }
    },
    {
      name: 'a comment that does not exist',
      event: { ...moreWidth, commentId: 'comment-9' }
    },
    { name: 'no text', event: { ...moreWidth, text: '  ' } },
    { name: 'a reply with no step', event: { ...moreWidth, steps: [] } }
  ])('TH-03: a follow-up on $name stores nothing', ({ event }) => {
    expect(reduceConversation(secondTurnOpen, event)).toBe(secondTurnOpen)
  })

  it('TH-02: an unsent or unknown comment has no thread', () => {
    expect(threadOf(secondTurnOpen, 'comment-3')).toBeNull()
    expect(threadOf(secondTurnOpen, 'comment-9')).toBeNull()
  })

  it('TH-15: what the person did is recorded on the follow-up reply’s own step', () => {
    const ref = { turnId: 'turn-1', followUpId: 'followUp-1', index: 0 }
    const acted = reduceConversation(followedUp, {
      type: 'actedOn',
      ref,
      result: 'changed',
      valueBefore: 1280
    })

    expect(threadOf(acted, 'comment-1')?.messages.at(-1)).toMatchObject({
      ref,
      step: { result: 'changed', valueBefore: 1280 }
    })
    expect(acted.turns[0].steps[0].result).toBeNull()
    expect(
      [
        { ...ref, followUpId: 'followUp-9' },
        { ...ref, index: 4 }
      ].every(
        (unknown) =>
          reduceConversation(followedUp, {
            type: 'actedOn',
            ref: unknown,
            result: 'changed',
            valueBefore: 1280
          }) === followedUp
      )
    ).toBe(true)
  })

  it('TH-01, TH-06: the bubble’s thread is what was said before the answer it shows', () => {
    const thread = threadOf(followedUp, 'comment-1')
    if (!thread) throw new Error('The thread was not found')

    expect(
      messagesBefore(thread, {
        turnId: 'turn-1',
        followUpId: 'followUp-1',
        index: 0
      }).map((message) => message.kind)
    ).toEqual(['comment', 'answer', 'followUp'])
    expect(
      messagesBefore(thread, { turnId: 'turn-1', followUpId: null, index: 0 })
    ).toEqual([{ kind: 'comment', text: 'make this wider' }])
    expect(messagesBefore(thread, null)).toEqual(thread.messages)
  })

  it('TH-11: an opened thread shows its latest answer, with nothing to wait for and nothing offered', () => {
    const thread = threadOf(followedUp, 'comment-1')
    if (!thread) throw new Error('The thread was not found')

    expect(latestAnswer(thread)).toEqual({
      ...widenMore,
      waitFor: null,
      offerEdit: null,
      ref: { turnId: 'turn-1', followUpId: 'followUp-1', index: 0 }
    })
  })

  it('TH-11: says so when the agent gave the comment no step', () => {
    const thread = threadOf(followedUp, 'comment-2')
    if (!thread) throw new Error('The thread was not found')

    expect(latestAnswer(thread)).toEqual({
      annotationId: 'comment-2',
      text: messages.noAnswerForComment,
      target: null,
      waitFor: null,
      offerEdit: null,
      problems: [],
      ref: null
    })
  })

  it('TH-16: a comment knows how many follow-ups its thread has', () => {
    expect(
      numberedComments(followedUp).map((comment) => comment.followUps)
    ).toEqual([1, 0])
  })

  it('TH-13: the thread as the agent is reminded of it: its answers with what was offered and done, and the earlier follow-ups', () => {
    const thread = threadOf(followedUp, 'comment-1')
    if (!thread) throw new Error('The thread was not found')

    expect(threadNotes(thread)).toEqual([
      {
        from: 'agent',
        steps: [
          {
            annotationId: 'comment-1',
            text: 'Change width to 1280.',
            target: width,
            offered: { target: width, value: 1280 },
            result: null,
            valueBefore: null
          }
        ]
      },
      { from: 'person', text: 'a bit more than that' },
      {
        from: 'agent',
        steps: [
          {
            annotationId: 'comment-1',
            text: 'Go to 1408.',
            target: width,
            offered: { target: width, value: 1408 },
            result: null,
            valueBefore: null
          }
        ]
      }
    ])
  })
})

describe('historyOf', () => {
  it('TU-04, TU-05: gives each answered turn’s comments and answer steps, with what was offered and what the person did', () => {
    const accepted = reduceConversation(secondTurnOpen, {
      type: 'actedOn',
      ref: { turnId: 'turn-1', followUpId: null, index: 0 },
      result: 'accepted',
      valueBefore: 1024
    })

    expect(historyOf(accepted)).toEqual([
      {
        comments: [
          {
            id: 'comment-1',
            label: first.label,
            comment: 'make this wider',
            targets: [width]
          },
          {
            id: 'comment-2',
            label: second.label,
            comment: 'what is this?',
            targets: [width]
          }
        ],
        answer: [
          {
            annotationId: 'comment-1',
            text: 'Change width to 1280.',
            target: width,
            offered: { target: width, value: 1280 },
            result: 'accepted',
            valueBefore: 1024
          },
          {
            annotationId: null,
            text: 'Now run it.',
            target: { kind: 'control', control: 'run' },
            offered: null,
            result: null,
            valueBefore: null
          }
        ],
        followUps: []
      }
    ])
  })

  it('TH-14: later requests are reminded of each turn’s threads', () => {
    expect(historyOf(followedUp)[0].followUps).toEqual([
      {
        commentId: 'comment-1',
        text: 'a bit more than that',
        answer: [
          {
            annotationId: 'comment-1',
            text: 'Go to 1408.',
            target: width,
            offered: { target: width, value: 1408 },
            result: null,
            valueBefore: null
          }
        ]
      }
    ])
  })

  it('TH-13: a follow-up’s history leaves its own thread out, since it is sent in full', () => {
    expect(historyOf(followedUp, 'comment-1')).toMatchObject([
      {
        comments: [{ id: 'comment-2' }],
        answer: [{ annotationId: null, text: 'Now run it.' }],
        followUps: []
      }
    ])
  })
})
