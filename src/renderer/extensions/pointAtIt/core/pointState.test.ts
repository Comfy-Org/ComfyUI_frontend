import { describe, expect, it } from 'vitest'

import { createNodeLocatorId } from '@comfyorg/graph-model/nodeIdentification'

import type { AgentReply, GuidanceStep } from './agentReply'
import { settingAddress } from './fakePointHost'
import { idleState, reducePointState, TAP_MS } from './pointState'
import type { Chip, PointEvent, PointState } from './pointState'

const latentId = createNodeLocatorId(null, 5)
const width = settingAddress(latentId, 'width')

const widthChip: Chip = {
  id: 'setting:5:width',
  target: width,
  label: 'Empty Latent Image › width'
}
const latentChip: Chip = {
  id: 'node:5',
  target: { kind: 'node', nodeId: latentId },
  label: 'Empty Latent Image'
}

const editStep: GuidanceStep = {
  text: 'Change width to 1536.',
  target: width,
  waitFor: { for: 'valueChange', of: width, direction: 'increase' },
  offerEdit: { target: width, value: 1536 }
}
const runStep: GuidanceStep = {
  text: 'Now run it.',
  target: { kind: 'control', control: 'run' },
  waitFor: { for: 'run' }
}
const plainStep: GuidanceStep = { text: 'Look here.', target: width }

const anchor = { x: 100, y: 100, width: 40, height: 30 }

const armed = {
  phase: 'armed',
  pressedAt: 1000,
  canMark: true
} satisfies PointState
const marking = {
  phase: 'marking',
  stroke: [
    { x: 100, y: 100 },
    { x: 140, y: 130 }
  ]
} satisfies PointState
const asking = {
  phase: 'asking',
  mark: { stroke: marking.stroke, anchor },
  chips: [widthChip, latentChip]
} satisfies PointState
const thinking = {
  phase: 'thinking',
  questionId: 'question-1',
  question: 'how do I make this wider?',
  mark: asking.mark,
  chips: asking.chips
} satisfies PointState

function guiding(steps: GuidanceStep[], index = 0): PointState {
  return {
    phase: 'guiding',
    questionId: 'question-1',
    steps,
    index,
    origin: { x: 100, y: 130 },
    editFailed: false
  }
}

function replyTo(questionId: string, steps = [editStep, runStep]): AgentReply {
  return { questionId, steps }
}

const everyEvent: PointEvent[] = [
  { type: 'keyPressed', at: 1000, canMark: true, canTap: true },
  { type: 'keyReleased', at: 1100, selection: null },
  { type: 'pointerPressed', point: { x: 1, y: 1 } },
  { type: 'pointerMoved', point: { x: 2, y: 2 } },
  { type: 'pointerReleased', chips: [] },
  { type: 'chipRemoved', chipId: widthChip.id },
  { type: 'questionSent', questionId: 'question-2', text: 'more steps' },
  { type: 'replyArrived', reply: replyTo('question-1') },
  { type: 'valueChanged' },
  { type: 'editApplied' },
  { type: 'editFailed' },
  { type: 'nextRequested' },
  { type: 'runQueued' },
  { type: 'targetRemoved' },
  { type: 'finished' },
  { type: 'dismissed' }
]

function eventsOtherThan(...types: PointEvent['type'][]): PointEvent[] {
  return everyEvent.filter((event) => !types.includes(event.type))
}

describe('reducePointState', () => {
  it('M-01: holding the key from idle turns marking on', () => {
    expect(
      reducePointState(idleState, {
        type: 'keyPressed',
        at: 1000,
        canMark: true,
        canTap: false
      })
    ).toEqual({ phase: 'armed', pressedAt: 1000, canMark: true })
  })

  it('stays idle when both ways of starting are switched off', () => {
    expect(
      reducePointState(idleState, {
        type: 'keyPressed',
        at: 1000,
        canMark: false,
        canTap: false
      })
    ).toBe(idleState)
  })

  it('does not start a stroke when only the selection entry is on', () => {
    const tapOnly: PointState = { ...armed, canMark: false }

    expect(
      reducePointState(tapOnly, {
        type: 'pointerPressed',
        point: { x: 1, y: 1 }
      })
    ).toBe(tapOnly)
  })

  it('M-02: releasing the pointer keeps the stroke and opens the box with the covered things', () => {
    const drawing = reducePointState(
      reducePointState(armed, {
        type: 'pointerPressed',
        point: { x: 100, y: 100 }
      }),
      { type: 'pointerMoved', point: { x: 140, y: 130 } }
    )

    expect(
      reducePointState(drawing, {
        type: 'pointerReleased',
        chips: [widthChip, latentChip]
      })
    ).toEqual(asking)
  })

  it('M-06: a stroke that covers nothing still opens a box that can send a question', () => {
    const box = reducePointState(marking, {
      type: 'pointerReleased',
      chips: []
    })

    expect(box).toMatchObject({ phase: 'asking', chips: [] })
    expect(
      reducePointState(box, {
        type: 'questionSent',
        questionId: 'question-1',
        text: 'what can I do here?'
      })
    ).toMatchObject({ phase: 'thinking', chips: [] })
  })

  it('M-07: releasing the key after a long hold returns to idle', () => {
    expect(
      reducePointState(armed, {
        type: 'keyReleased',
        at: armed.pressedAt + TAP_MS + 1,
        selection: { chips: [latentChip], anchor }
      })
    ).toBe(idleState)
  })

  it('S-01: a tap with nodes selected opens the box with a chip per node and no stroke', () => {
    expect(
      reducePointState(armed, {
        type: 'keyReleased',
        at: armed.pressedAt + TAP_MS,
        selection: { chips: [latentChip], anchor }
      })
    ).toEqual({
      phase: 'asking',
      mark: { stroke: [], anchor },
      chips: [latentChip]
    })
  })

  it.for([
    { name: 'no selection', selection: null },
    { name: 'an empty selection', selection: { chips: [], anchor } }
  ])('S-02: a tap with $name opens nothing', ({ selection }) => {
    expect(
      reducePointState(armed, {
        type: 'keyReleased',
        at: armed.pressedAt + 50,
        selection
      })
    ).toBe(idleState)
  })

  it('A-01: removing a chip leaves the others', () => {
    expect(
      reducePointState(asking, { type: 'chipRemoved', chipId: widthChip.id })
    ).toEqual({ ...asking, chips: [latentChip] })
  })

  it.for([asking, thinking, guiding([editStep, runStep]), armed, marking])(
    'A-02, G-05: dismissing from $phase returns to idle',
    (state) => {
      expect(reducePointState(state, { type: 'dismissed' })).toBe(idleState)
    }
  )

  it('A-03: sending a blank question changes nothing', () => {
    expect(
      reducePointState(asking, {
        type: 'questionSent',
        questionId: 'question-1',
        text: '   '
      })
    ).toBe(asking)
  })

  it('A-04: a sent question waits, then its reply starts guidance at the first step', () => {
    const waiting = reducePointState(asking, {
      type: 'questionSent',
      questionId: 'question-1',
      text: ' how do I make this wider? '
    })

    expect(waiting).toEqual(thinking)
    expect(
      reducePointState(waiting, {
        type: 'replyArrived',
        reply: replyTo('question-1')
      })
    ).toEqual(guiding([editStep, runStep]))
  })

  it.for([
    { name: 'a dismissed question', state: idleState },
    {
      name: 'a question replaced by a newer one',
      state: { ...thinking, questionId: 'question-2' }
    },
    { name: 'guidance already showing', state: guiding([plainStep]) }
  ])('A-05: a reply to $name is dropped', ({ state }) => {
    expect(
      reducePointState(state, {
        type: 'replyArrived',
        reply: replyTo('question-1')
      })
    ).toBe(state)
  })

  it('ends at once when the reply has no steps', () => {
    expect(
      reducePointState(thinking, {
        type: 'replyArrived',
        reply: replyTo('question-1', [])
      })
    ).toBe(idleState)
  })

  it.for<PointEvent>([{ type: 'valueChanged' }, { type: 'editApplied' }])(
    'G-03, G-04: $type moves a waiting step to the next one',
    (event) => {
      expect(reducePointState(guiding([editStep, runStep]), event)).toEqual(
        guiding([editStep, runStep], 1)
      )
    }
  )

  it('keeps the step and says so when the offered edit is rejected', () => {
    expect(
      reducePointState(guiding([editStep, runStep]), { type: 'editFailed' })
    ).toMatchObject({ index: 0, editFailed: true })
  })

  it.for<PointEvent>([{ type: 'finished' }, { type: 'runQueued' }])(
    'G-06: $type on the last step ends guidance',
    (event) => {
      expect(reducePointState(guiding([editStep, runStep], 1), event)).toBe(
        idleState
      )
    }
  )

  it('G-07: guidance ends when its target is removed', () => {
    expect(
      reducePointState(guiding([editStep, runStep]), { type: 'targetRemoved' })
    ).toBe(idleState)
  })

  it('moves on when asked on a step that waits for nothing', () => {
    expect(
      reducePointState(guiding([plainStep, runStep]), { type: 'nextRequested' })
    ).toEqual(guiding([plainStep, runStep], 1))
  })

  it.for([
    { state: idleState, ignored: eventsOtherThan('keyPressed') },
    {
      state: armed,
      ignored: eventsOtherThan('keyReleased', 'pointerPressed', 'dismissed')
    },
    {
      state: marking,
      ignored: eventsOtherThan('pointerMoved', 'pointerReleased', 'dismissed')
    },
    {
      state: asking,
      ignored: eventsOtherThan('chipRemoved', 'questionSent', 'dismissed')
    },
    { state: thinking, ignored: eventsOtherThan('replyArrived', 'dismissed') },
    {
      state: guiding([editStep, runStep]),
      ignored: eventsOtherThan(
        'valueChanged',
        'editApplied',
        'editFailed',
        'nextRequested',
        'targetRemoved',
        'dismissed'
      )
    },
    {
      state: guiding([plainStep, runStep]),
      ignored: eventsOtherThan('nextRequested', 'targetRemoved', 'dismissed')
    }
  ])(
    'ignores every event that means nothing while $state.phase',
    ({ state, ignored }) => {
      expect(
        ignored.filter((event) => reducePointState(state, event) !== state)
      ).toEqual([])
    }
  )
})
