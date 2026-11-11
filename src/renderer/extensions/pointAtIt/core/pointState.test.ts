import { describe, expect, it } from 'vitest'

import { createNodeLocatorId } from '@comfyorg/graph-model/nodeIdentification'

import { settingAddress } from './fakePointHost'
import { idleState, reducePointState, TAP_MS } from './pointState'
import type { Chip, Draft, PointEvent, PointState } from './pointState'
import type { GuidanceStep } from './replyValidation'

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
  annotationId: 'comment-1',
  text: 'Change width to 1536.',
  target: width,
  waitFor: { for: 'valueChange', of: width, direction: 'increase' },
  offerEdit: { target: width, value: 1536 },
  problems: []
}
const runStep: GuidanceStep = {
  annotationId: null,
  text: 'Now run it.',
  target: { kind: 'control', control: 'run' },
  waitFor: { for: 'run' },
  offerEdit: null,
  problems: []
}
const plainStep: GuidanceStep = {
  annotationId: 'comment-1',
  text: 'Look here.',
  target: width,
  waitFor: null,
  offerEdit: null,
  problems: []
}

const anchor = { x: 100, y: 100, width: 40, height: 30 }
const origin = { x: 100, y: 130 }
const centre = { x: 640, y: 400 }

const newDraft: Draft = {
  annotationId: null,
  targets: [width],
  label: 'Empty Latent Image › width',
  comment: ''
}
const selectionDraft: Draft = {
  annotationId: null,
  targets: [{ kind: 'node', nodeId: latentId }],
  label: 'Empty Latent Image',
  comment: ''
}

const armed = { phase: 'armed', pressedAt: 1000 } satisfies PointState
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
const picking = { phase: 'annotating', draft: null } satisfies PointState
const commenting = {
  phase: 'annotating',
  draft: newDraft
} satisfies PointState
const waitingForBatch = {
  phase: 'waiting',
  requestId: 'request-1',
  startedAt: 5000,
  origin: centre,
  asked: null
} satisfies PointState
const waitingForQuestion = {
  ...waitingForBatch,
  origin,
  asked: {
    mark: asking.mark,
    chips: asking.chips,
    question: 'how do I make this wider?'
  }
} satisfies PointState
const failed = {
  phase: 'failed',
  failure: { kind: 'malformed', detail: '' },
  origin,
  asked: waitingForQuestion.asked
} satisfies PointState

function guiding(steps: GuidanceStep[], index = 0): PointState {
  return {
    phase: 'guiding',
    requestId: 'request-1',
    turnId: 'turn-1',
    replay: false,
    steps,
    index,
    origin: centre,
    editFailed: false
  }
}

const reply = {
  type: 'replyArrived',
  requestId: 'request-1',
  turnId: 'turn-1',
  steps: [editStep, runStep]
} satisfies PointEvent
const replay = {
  type: 'replayOpened',
  commentId: 'comment-1',
  steps: [plainStep],
  origin
} satisfies PointEvent
const failure: PointEvent = {
  type: 'requestFailed',
  requestId: 'request-1',
  failure: { kind: 'malformed', detail: '' }
}
const batchSent: PointEvent = {
  type: 'batchSent',
  requestId: 'request-2',
  at: 9000,
  origin: centre
}

const everyEvent: PointEvent[] = [
  { type: 'keyPressed', at: 1000 },
  { type: 'keyReleased', at: 1100, selection: null },
  { type: 'pointerPressed', point: { x: 1, y: 1 } },
  { type: 'pointerMoved', point: { x: 2, y: 2 } },
  { type: 'pointerReleased', chips: [] },
  { type: 'chipRemoved', chipId: widthChip.id },
  { type: 'questionSent', requestId: 'request-2', text: 'more', at: 9000 },
  { type: 'annotateToggled', selection: null },
  { type: 'draftOpened', draft: newDraft },
  { type: 'draftClosed' },
  batchSent,
  reply,
  replay,
  failure,
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

describe('reducePointState: annotation mode', () => {
  it.for([
    { name: 'idle', state: idleState },
    { name: 'a failed request', state: failed },
    { name: 'guidance', state: guiding([editStep, runStep]) }
  ])('AN-01, AN-19: Annotate turns the mode on from $name', ({ state }) => {
    expect(
      reducePointState(state, { type: 'annotateToggled', selection: null })
    ).toEqual(picking)
  })

  it('AN-10: entering with nodes selected opens a comment box on the selection', () => {
    expect(
      reducePointState(idleState, {
        type: 'annotateToggled',
        selection: selectionDraft
      })
    ).toEqual({ phase: 'annotating', draft: selectionDraft })
  })

  it.for([
    { name: 'no box open', state: picking },
    { name: 'a box open', state: commenting }
  ])('AN-08: Annotate turns the mode off with $name', ({ state }) => {
    expect(
      reducePointState(state, { type: 'annotateToggled', selection: null })
    ).toBe(idleState)
  })

  it.for([
    { name: 'the mode with no box open', state: picking },
    { name: 'idle', state: idleState },
    { name: 'a failed request', state: failed }
  ])(
    'AN-03, AN-09: a pick or a pin opens a comment box from $name',
    ({ state }) => {
      expect(
        reducePointState(state, { type: 'draftOpened', draft: newDraft })
      ).toEqual(commenting)
    }
  )

  it('keeps the open comment box when something else is picked', () => {
    expect(
      reducePointState(commenting, {
        type: 'draftOpened',
        draft: selectionDraft
      })
    ).toBe(commenting)
  })

  it('AN-05: closing the comment box after a save keeps the mode on', () => {
    expect(reducePointState(commenting, { type: 'draftClosed' })).toEqual(
      picking
    )
  })

  it('AN-07: Esc with a comment box open closes only the box', () => {
    expect(reducePointState(commenting, { type: 'dismissed' })).toEqual(picking)
  })

  it('AN-08: Esc with no comment box open leaves the mode', () => {
    expect(reducePointState(picking, { type: 'dismissed' })).toBe(idleState)
  })

  it.for([
    { name: 'idle', state: idleState },
    { name: 'the mode', state: commenting }
  ])('AN-12: Send from $name ends the mode and waits', ({ state }) => {
    expect(reducePointState(state, batchSent)).toEqual({
      phase: 'waiting',
      requestId: 'request-2',
      startedAt: 9000,
      origin: centre,
      asked: null
    })
  })

  it('retrying a failed request waits again and keeps what was asked', () => {
    expect(reducePointState(failed, batchSent)).toEqual({
      phase: 'waiting',
      requestId: 'request-2',
      startedAt: 9000,
      origin,
      asked: failed.asked
    })
  })

  it('AN-15: cancelling while waiting returns to idle', () => {
    expect(reducePointState(waitingForBatch, { type: 'dismissed' })).toBe(
      idleState
    )
  })

  it('AN-16: the reply to the waiting request starts guidance at its first step', () => {
    expect(reducePointState(waitingForBatch, reply)).toEqual(
      guiding([editStep, runStep])
    )
  })

  it('L-04: a reply that is not in the reply format shows the failure', () => {
    expect(reducePointState(waitingForQuestion, failure)).toEqual(failed)
  })

  it.for([
    { name: 'a cancelled request', state: idleState },
    {
      name: 'a request replaced by a newer one',
      state: { ...waitingForBatch, requestId: 'request-2' }
    },
    { name: 'guidance already showing', state: guiding([plainStep]) }
  ])('A-05, L-09: a reply or a failure for $name is dropped', ({ state }) => {
    expect(reducePointState(state, reply)).toBe(state)
    expect(reducePointState(state, failure)).toBe(state)
  })
})

describe('reducePointState: showing an earlier answer again', () => {
  it.for([
    { name: 'idle', state: idleState },
    { name: 'a failed request', state: failed },
    { name: 'the mode with no box open', state: picking },
    { name: 'other guidance', state: guiding([editStep, runStep]) }
  ])('TU-06: opens the earlier answer for reading from $name', ({ state }) => {
    expect(reducePointState(state, replay)).toEqual({
      phase: 'guiding',
      requestId: 'replay:comment-1',
      turnId: null,
      replay: true,
      steps: [plainStep],
      index: 0,
      origin,
      editFailed: false
    })
  })

  it('TU-06: does nothing when there is no step to show', () => {
    expect(reducePointState(idleState, { ...replay, steps: [] })).toBe(
      idleState
    )
  })
})

describe('reducePointState: the hidden stroke entry', () => {
  it('M-01: holding the key from idle turns marking on', () => {
    expect(
      reducePointState(idleState, { type: 'keyPressed', at: 1000 })
    ).toEqual(armed)
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
        requestId: 'request-1',
        text: 'what can I do here?',
        at: 5000
      })
    ).toMatchObject({ phase: 'waiting', asked: { chips: [] } })
  })

  it('M-07: releasing the key after a long hold returns to idle', () => {
    expect(
      reducePointState(armed, {
        type: 'keyReleased',
        at: armed.pressedAt + TAP_MS + 1,
        selection: selectionDraft
      })
    ).toBe(idleState)
  })

  it('H-02: a tap turns annotation mode on, with the selection if there is one', () => {
    expect(
      reducePointState(armed, {
        type: 'keyReleased',
        at: armed.pressedAt + TAP_MS,
        selection: selectionDraft
      })
    ).toEqual({ phase: 'annotating', draft: selectionDraft })
  })

  it('A-01: removing a chip leaves the others', () => {
    expect(
      reducePointState(asking, { type: 'chipRemoved', chipId: widthChip.id })
    ).toEqual({ ...asking, chips: [latentChip] })
  })

  it.for([asking, waitingForQuestion, failed, armed, marking])(
    'A-02: dismissing from $phase returns to idle',
    (state) => {
      expect(reducePointState(state, { type: 'dismissed' })).toBe(idleState)
    }
  )

  it('A-03: sending a blank question changes nothing', () => {
    expect(
      reducePointState(asking, {
        type: 'questionSent',
        requestId: 'request-1',
        text: '   ',
        at: 5000
      })
    ).toBe(asking)
  })

  it('A-04: a sent question keeps its box while it waits', () => {
    expect(
      reducePointState(asking, {
        type: 'questionSent',
        requestId: 'request-1',
        text: ' how do I make this wider? ',
        at: 5000
      })
    ).toEqual(waitingForQuestion)
  })
})

describe('reducePointState: guidance', () => {
  it('ends at once when the reply has no steps', () => {
    expect(reducePointState(waitingForBatch, { ...reply, steps: [] })).toBe(
      idleState
    )
  })

  it.for<PointEvent>([{ type: 'valueChanged' }, { type: 'editApplied' }])(
    'G-03, G-04: $type moves a waiting step to the next one',
    (event) => {
      expect(reducePointState(guiding([editStep, runStep]), event)).toEqual(
        guiding([editStep, runStep], 1)
      )
    }
  )

  it('L-03: keeps the step and says so when the setting rejects the offered edit', () => {
    expect(
      reducePointState(guiding([editStep, runStep]), { type: 'editFailed' })
    ).toMatchObject({ index: 0, editFailed: true })
  })

  it.for<PointEvent>([
    { type: 'finished' },
    { type: 'runQueued' },
    { type: 'dismissed' }
  ])('G-05, G-06: $type on the last step ends guidance', (event) => {
    expect(reducePointState(guiding([editStep, runStep], 1), event)).toBe(
      idleState
    )
  })

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
})

describe('reducePointState: events that mean nothing', () => {
  it.for([
    {
      state: idleState,
      ignored: eventsOtherThan(
        'keyPressed',
        'annotateToggled',
        'draftOpened',
        'batchSent',
        'replayOpened'
      )
    },
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
    {
      state: picking,
      ignored: eventsOtherThan(
        'annotateToggled',
        'draftOpened',
        'batchSent',
        'replayOpened',
        'dismissed'
      )
    },
    {
      state: commenting,
      ignored: eventsOtherThan(
        'annotateToggled',
        'draftClosed',
        'batchSent',
        'dismissed'
      )
    },
    {
      state: waitingForBatch,
      ignored: eventsOtherThan('replyArrived', 'requestFailed', 'dismissed')
    },
    {
      state: failed,
      ignored: eventsOtherThan(
        'annotateToggled',
        'draftOpened',
        'batchSent',
        'replayOpened',
        'dismissed'
      )
    },
    {
      state: guiding([editStep, runStep]),
      ignored: eventsOtherThan(
        'annotateToggled',
        'replayOpened',
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
      ignored: eventsOtherThan(
        'annotateToggled',
        'replayOpened',
        'nextRequested',
        'targetRemoved',
        'dismissed'
      )
    }
  ])(
    'AN-19: $state.phase ignores every event that means nothing to it',
    ({ state, ignored }) => {
      expect(
        ignored.filter((event) => reducePointState(state, event) !== state)
      ).toEqual([])
    }
  )
})
