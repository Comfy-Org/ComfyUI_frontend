import { describe, expect, it } from 'vitest'

import { createNodeLocatorId } from '@comfyorg/graph-model/nodeIdentification'

import { settingAddress } from './fakePointHost'
import { messages } from './messages'
import type { GuidanceStep } from './replyValidation'
import {
  emptyConversation,
  historyOf,
  numberedComments,
  reduceConversation,
  replaySteps
} from './turns'
import type { Annotation, Conversation } from './turns'

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

const unsentOnly: Conversation = { turns: [], unsent: [first, second] }
const oneTurn = reduceConversation(unsentOnly, {
  type: 'answered',
  turnId: 'turn-1',
  steps: [widen, run],
  thinking: 'Checking the width.'
})
const secondTurnOpen = reduceConversation(oneTurn, { type: 'saved', ...third })

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
          comments: [first, second],
          steps: [
            { ...widen, result: null, valueBefore: null },
            { ...run, result: null, valueBefore: null }
          ],
          thinking: 'Checking the width.'
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
      turnId: 'turn-1',
      stepIndex: 0,
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
        turnId: 'turn-9',
        stepIndex: 0,
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

describe('replaySteps', () => {
  it('TU-06: shows the step for a locked comment again with nothing to wait for and nothing offered', () => {
    expect(replaySteps(oneTurn.turns[0], 'comment-1')).toEqual([
      { ...widen, waitFor: null, offerEdit: null }
    ])
  })

  it('TU-06: says so when the agent gave no step for the comment', () => {
    expect(replaySteps(oneTurn.turns[0], 'comment-2')).toEqual([
      {
        annotationId: 'comment-2',
        text: messages.noAnswerForComment,
        target: null,
        waitFor: null,
        offerEdit: null,
        problems: []
      }
    ])
  })
})

describe('historyOf', () => {
  it('TU-04, TU-05: gives each answered turn’s comments and answer steps, with what was offered and what the person did', () => {
    const accepted = reduceConversation(secondTurnOpen, {
      type: 'actedOn',
      turnId: 'turn-1',
      stepIndex: 0,
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
        ]
      }
    ])
  })
})
