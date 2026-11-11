import { describe, expect, it } from 'vitest'

import { createNodeLocatorId } from '@comfyorg/graph-model/nodeIdentification'

import { settingAddress } from './fakePointHost'
import { idleState, reducePointState, TAP_MS } from './pointState'
import type {
  Chip,
  Draft,
  GuidingState,
  PointEvent,
  PointState
} from './pointState'
import type { ShownStep } from './turns'

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

const editStep: ShownStep = {
  annotationId: 'comment-1',
  text: 'Change width to 1536.',
  target: width,
  waitFor: { for: 'valueChange', of: width, direction: 'increase' },
  offerEdit: { target: width, value: 1536 },
  problems: [],
  ref: { turnId: 'turn-1', followUpId: null, index: 0 }
}
const runStep: ShownStep = {
  annotationId: null,
  text: 'Now run it.',
  target: { kind: 'control', control: 'run' },
  waitFor: { for: 'run' },
  offerEdit: null,
  problems: [],
  ref: { turnId: 'turn-1', followUpId: null, index: 1 }
}
const plainStep: ShownStep = {
  annotationId: 'comment-1',
  text: 'Look here.',
  target: width,
  waitFor: null,
  offerEdit: null,
  problems: [],
  ref: { turnId: 'turn-1', followUpId: null, index: 0 }
}
const followUpStep: ShownStep = {
  annotationId: 'comment-1',
  text: 'Then go a little further, to 1664.',
  target: width,
  waitFor: { for: 'valueChange', of: width, direction: 'increase' },
  offerEdit: { target: width, value: 1664 },
  problems: [],
  ref: { turnId: 'turn-1', followUpId: 'followUp-1', index: 0 }
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

function followUpSentState() {
  return {
    status: 'waiting' as const,
    requestId: 'request-3',
    text: 'a bit more than that',
    startedAt: 7000
  }
}

function guiding(steps: ShownStep[], index = 0): GuidingState {
  return {
    phase: 'guiding',
    requestId: 'request-1',
    replay: false,
    steps,
    index,
    origin: centre,
    editFailed: false,
    followUp: null
  }
}

const held: GuidingState = {
  ...guiding([editStep, runStep]),
  followUp: followUpSentState()
}
const followUpFailed: GuidingState = {
  ...held,
  followUp: {
    status: 'failed',
    text: 'a bit more than that',
    failure: { kind: 'timeout', detail: '60' }
  }
}

const reply = {
  type: 'replyArrived',
  requestId: 'request-1',
  steps: [editStep, runStep]
} satisfies PointEvent
const opened = {
  type: 'threadOpened',
  commentId: 'comment-1',
  step: plainStep,
  origin
} satisfies PointEvent
const followUpSent = {
  type: 'followUpSent',
  requestId: 'request-3',
  text: ' a bit more than that ',
  at: 7000
} satisfies PointEvent
const followUpAnswered = {
  type: 'followUpAnswered',
  requestId: 'request-3',
  steps: [followUpStep]
} satisfies PointEvent
const followUpFailure = {
  type: 'followUpFailed',
  requestId: 'request-3',
  failure: { kind: 'timeout', detail: '60' }
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
  opened,
  followUpSent,
  followUpAnswered,
  followUpFailure,
  { type: 'followUpCancelled' },
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

describe('reducePointState: opening a thread', () => {
  it.for([
    { name: 'idle', state: idleState },
    { name: 'a failed request', state: failed },
    { name: 'the mode with no box open', state: picking },
    { name: 'other guidance', state: guiding([editStep, runStep]) }
  ])(
    'TH-11: opens the thread at its latest answer, for reading, from $name',
    ({ state }) => {
      expect(reducePointState(state, opened)).toEqual({
        phase: 'guiding',
        requestId: 'thread:comment-1',
        replay: true,
        steps: [plainStep],
        index: 0,
        origin,
        editFailed: false,
        followUp: null
      })
    }
  )
})

describe('reducePointState: a follow-up inside an answer', () => {
  it('TH-03: sending a follow-up keeps the answer where it is and waits, with the text trimmed', () => {
    expect(
      reducePointState(guiding([editStep, runStep]), followUpSent)
    ).toEqual(held)
  })

  it.for([
    { name: 'empty text', state: guiding([editStep]), text: '  ' },
    {
      name: 'a step that answers no question',
      state: guiding([editStep, runStep], 1),
      text: 'why?'
    }
  ])('TH-02, TH-03: $name sends nothing', ({ state, text }) => {
    expect(reducePointState(state, { ...followUpSent, text })).toBe(state)
  })

  it('TH-06, TH-07: the reply takes the place of the step it followed up on, live, and the rest of the sequence stays', () => {
    const replied = reducePointState(
      { ...held, replay: true, editFailed: true },
      followUpAnswered
    )

    expect(replied).toEqual(guiding([followUpStep, runStep]))
    expect(reducePointState(replied, { type: 'valueChanged' })).toEqual(
      guiding([followUpStep, runStep], 1)
    )
  })

  it('TH-06: a reply with several steps is shown one after another before the sequence goes on', () => {
    const second: ShownStep = {
      ...plainStep,
      ref: { turnId: 'turn-1', followUpId: 'followUp-1', index: 1 }
    }

    expect(
      reducePointState(held, {
        ...followUpAnswered,
        steps: [followUpStep, second]
      })
    ).toEqual(guiding([followUpStep, second, runStep]))
  })

  it.for<{ name: string; event: PointEvent }>([
    { name: 'Cancel', event: { type: 'followUpCancelled' } },
    { name: 'Esc', event: { type: 'dismissed' } }
  ])(
    'TH-08: $name ends the wait and keeps the answer on screen',
    ({ event }) => {
      expect(reducePointState(held, event)).toEqual(
        guiding([editStep, runStep])
      )
    }
  )

  it('TH-09: a failure keeps the answer and the typed follow-up, and Retry sends it again', () => {
    const failedFollowUp = reducePointState(held, followUpFailure)

    expect(failedFollowUp).toEqual(followUpFailed)
    expect(
      reducePointState(failedFollowUp, {
        ...followUpSent,
        requestId: 'request-4'
      })
    ).toMatchObject({
      followUp: {
        status: 'waiting',
        requestId: 'request-4',
        text: 'a bit more than that'
      }
    })
  })

  it.for<{ name: string; state: PointState }>([
    { name: 'a cancelled follow-up', state: guiding([editStep, runStep]) },
    {
      name: 'a follow-up replaced by a newer one',
      state: {
        ...held,
        followUp: { ...followUpSentState(), requestId: 'request-9' }
      }
    },
    { name: 'guidance that was closed', state: idleState }
  ])('TH-10: a reply or a failure for $name is dropped', ({ state }) => {
    expect(reducePointState(state, followUpAnswered)).toBe(state)
    expect(reducePointState(state, followUpFailure)).toBe(state)
  })

  it('TH-04, TH-05: while a follow-up waits the answer is held', () => {
    const blocked: PointEvent[] = [
      followUpSent,
      { type: 'valueChanged' },
      { type: 'editApplied' },
      { type: 'nextRequested' },
      { type: 'runQueued' },
      { type: 'finished' },
      { type: 'annotateToggled', selection: null },
      opened,
      batchSent
    ]

    expect(
      blocked.filter((event) => reducePointState(held, event) !== held)
    ).toEqual([])
  })

  it('TH-04: losing the target while a follow-up waits ends the guidance', () => {
    expect(reducePointState(held, { type: 'targetRemoved' })).toBe(idleState)
  })

  it('TH-09: moving on from a step with a failed follow-up drops the failure', () => {
    expect(reducePointState(followUpFailed, { type: 'valueChanged' })).toEqual(
      guiding([editStep, runStep], 1)
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
        'threadOpened'
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
        'threadOpened',
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
        'threadOpened',
        'dismissed'
      )
    },
    {
      state: held,
      ignored: eventsOtherThan(
        'followUpAnswered',
        'followUpFailed',
        'followUpCancelled',
        'targetRemoved',
        'dismissed'
      )
    },
    {
      state: guiding([editStep, runStep]),
      ignored: eventsOtherThan(
        'annotateToggled',
        'threadOpened',
        'followUpSent',
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
        'threadOpened',
        'followUpSent',
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
