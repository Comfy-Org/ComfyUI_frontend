import { describe, expect, it } from 'vitest'

import type { CoachStep } from './onboardingTours'
import { reduceTour } from './tourState'
import type { RunId, TourEvent, TourState } from './tourState'

const RUN = 1 as RunId
const OTHER_RUN = 2 as RunId

const STEPS: CoachStep[] = [
  { kind: 'spotlight', name: 'one', placement: 'center' },
  { kind: 'spotlight', name: 'two', placement: 'center' }
]
const LATE_STEPS: CoachStep[] = [
  { kind: 'spotlight', name: 'late', placement: 'center' }
]

const STATES = {
  idle: { phase: 'idle' },
  resolving: { phase: 'resolving', tour: 'appMode', run: RUN },
  waiting: {
    phase: 'waiting',
    tour: 'appMode',
    run: RUN,
    steps: STEPS,
    fromIdx: 0
  },
  entering: {
    phase: 'entering',
    tour: 'appMode',
    run: RUN,
    steps: STEPS,
    fromIdx: 0,
    toIdx: 1
  },
  showing: { phase: 'showing', tour: 'appMode', run: RUN, steps: STEPS, idx: 1 }
} as const satisfies Record<string, TourState>

const EVENTS = {
  requested: { type: 'requested', tour: 'appMode', run: OTHER_RUN },
  resolved: { type: 'resolved', run: RUN, steps: LATE_STEPS },
  resolvedEmpty: { type: 'resolvedEmpty', run: RUN },
  targetAwaited: { type: 'targetAwaited', run: RUN, fromIdx: 1 },
  stepEntering: { type: 'stepEntering', run: RUN, toIdx: 1 },
  stepShown: { type: 'stepShown', run: RUN, idx: 1 },
  ended: { type: 'ended', run: RUN }
} as const satisfies Record<string, TourEvent>

type PhaseName = keyof typeof STATES
type EventName = keyof typeof EVENTS

/** The phase each pair produces; `null` means the event is refused. */
const TRANSITIONS: Record<PhaseName, Record<EventName, PhaseName | null>> = {
  idle: {
    requested: 'resolving',
    resolved: null,
    resolvedEmpty: null,
    targetAwaited: null,
    stepEntering: null,
    stepShown: null,
    ended: null
  },
  resolving: {
    requested: null,
    resolved: 'entering',
    resolvedEmpty: 'idle',
    targetAwaited: null,
    stepEntering: null,
    stepShown: null,
    ended: 'idle'
  },
  waiting: {
    requested: null,
    resolved: null,
    resolvedEmpty: null,
    targetAwaited: 'waiting',
    stepEntering: 'entering',
    stepShown: null,
    ended: 'idle'
  },
  entering: {
    requested: null,
    resolved: null,
    resolvedEmpty: null,
    targetAwaited: 'waiting',
    stepEntering: 'entering',
    stepShown: 'showing',
    ended: 'idle'
  },
  showing: {
    requested: null,
    resolved: null,
    resolvedEmpty: null,
    targetAwaited: 'waiting',
    stepEntering: 'entering',
    stepShown: null,
    ended: 'idle'
  }
}

const phases = Object.keys(STATES) as PhaseName[]
const events = Object.keys(EVENTS) as EventName[]

describe('reduceTour', () => {
  describe.for(phases)('while %s', (phase) => {
    it.for(events)('%s', (event) => {
      const expected = TRANSITIONS[phase][event]
      const before = STATES[phase]
      const after = reduceTour(before, EVENTS[event])

      if (expected === null) {
        expect(after).toBe(before)
        return
      }
      expect(after.phase).toBe(expected)
    })
  })

  it('refuses a reply from a run that already ended', () => {
    const stale: TourEvent = { type: 'resolved', run: OTHER_RUN, steps: STEPS }
    expect(reduceTour(STATES.resolving, stale)).toBe(STATES.resolving)
  })

  it('refuses a stale end, so a dead run cannot close a live one', () => {
    const stale: TourEvent = { type: 'ended', run: OTHER_RUN }
    expect(reduceTour(STATES.showing, stale)).toBe(STATES.showing)
  })

  it('carries the steps the winning run resolved', () => {
    const after = reduceTour(STATES.resolving, EVENTS.resolved)
    expect(after.phase === 'entering' && after.steps).toBe(LATE_STEPS)
  })

  it('opens with nothing on screen to travel from', () => {
    const after = reduceTour(STATES.resolving, EVENTS.resolved)
    expect(after.phase === 'entering' && after.fromIdx).toBeNull()
  })

  it('travels from the step already shown', () => {
    const after = reduceTour(STATES.showing, EVENTS.stepEntering)
    expect(after.phase === 'entering' && after.fromIdx).toBe(1)
  })
})
