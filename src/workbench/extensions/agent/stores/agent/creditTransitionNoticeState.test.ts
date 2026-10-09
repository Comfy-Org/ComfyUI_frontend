import { describe, expect, it } from 'vitest'

import type {
  CreditTransitionNoticeEvent,
  CreditTransitionNoticePhase,
  CreditTransitionNoticeState
} from './creditTransitionNoticeState'
import {
  isCreditTransitionNoticeOpen,
  reduceCreditTransitionNotice
} from './creditTransitionNoticeState'

const IDENTITY = 'user-1:workspace-1'
const OTHER = 'user-2:workspace-1'

const PHASES = [
  'idle',
  'armed',
  'reported',
  'dismissed'
] as const satisfies readonly CreditTransitionNoticePhase[]

function episode(
  phase: CreditTransitionNoticePhase,
  scopedHasFunds: boolean,
  identity = IDENTITY
): CreditTransitionNoticeState {
  return { identity, scopedHasFunds, phase }
}

/**
 * Every phase crossed with every event, including the pairs that must do
 * nothing. The table is the point: the four refs this replaced allowed
 * combinations the watchers had to exclude by hand, and three of the review's
 * bugs were in how they interleaved.
 */
describe('reduceCreditTransitionNotice', () => {
  describe('scopedRead starts an episode it has no state for', () => {
    it.for([true, false])(
      'records a first read of %s without arming',
      (scopedHasFunds) => {
        expect(
          reduceCreditTransitionNotice(null, {
            type: 'scopedRead',
            identity: IDENTITY,
            scopedHasFunds
          })
        ).toEqual(episode('idle', scopedHasFunds))
      }
    )

    it.for(PHASES)(
      'discards a %s episode belonging to another identity',
      (phase) => {
        expect(
          reduceCreditTransitionNotice(episode(phase, true, OTHER), {
            type: 'scopedRead',
            identity: IDENTITY,
            scopedHasFunds: false
          })
        ).toEqual(episode('idle', false))
      }
    )
  })

  describe('scopedRead false', () => {
    it('arms on the observed handoff out of idle', () => {
      expect(
        reduceCreditTransitionNotice(episode('idle', true), {
          type: 'scopedRead',
          identity: IDENTITY,
          scopedHasFunds: false
        })
      ).toEqual(episode('armed', false))
    })

    it('does not re-arm a dismissed episode on the handoff', () => {
      expect(
        reduceCreditTransitionNotice(episode('dismissed', true), {
          type: 'scopedRead',
          identity: IDENTITY,
          scopedHasFunds: false
        })
      ).toEqual(episode('dismissed', false))
    })

    it.for(PHASES)(
      'leaves a %s episode alone when scoped funds were already false',
      (phase) => {
        expect(
          reduceCreditTransitionNotice(episode(phase, false), {
            type: 'scopedRead',
            identity: IDENTITY,
            scopedHasFunds: false
          })
        ).toEqual(episode(phase, false))
      }
    )
  })

  describe('scopedRead true', () => {
    it.for(['idle', 'armed', 'reported'] as const)(
      're-arms a %s episode for the next handoff',
      (phase) => {
        expect(
          reduceCreditTransitionNotice(episode(phase, false), {
            type: 'scopedRead',
            identity: IDENTITY,
            scopedHasFunds: true
          })
        ).toEqual(episode('idle', true))
      }
    )

    it('keeps a dismissal across a refill', () => {
      expect(
        reduceCreditTransitionNotice(episode('dismissed', false), {
          type: 'scopedRead',
          identity: IDENTITY,
          scopedHasFunds: true
        })
      ).toEqual(episode('dismissed', true))
    })
  })

  describe('shown', () => {
    it('claims the impression once, from armed only', () => {
      const armed = episode('armed', false)
      const reported = reduceCreditTransitionNotice(armed, {
        type: 'shown',
        identity: IDENTITY
      })

      expect(reported).toEqual(episode('reported', false))
      expect(
        reduceCreditTransitionNotice(reported, {
          type: 'shown',
          identity: IDENTITY
        })
      ).toBe(reported)
    })

    it.for(['idle', 'reported', 'dismissed'] as const)(
      'returns a %s episode untouched',
      (phase) => {
        const state = episode(phase, false)

        expect(
          reduceCreditTransitionNotice(state, {
            type: 'shown',
            identity: IDENTITY
          })
        ).toBe(state)
      }
    )
  })

  describe('dismissed', () => {
    it.for(PHASES)('closes a %s episode', (phase) => {
      expect(
        reduceCreditTransitionNotice(episode(phase, false), {
          type: 'dismissed',
          identity: IDENTITY
        })
      ).toEqual(episode('dismissed', false))
    })
  })

  describe('events for an identity the state does not hold', () => {
    const foreign = [
      { type: 'shown', identity: IDENTITY },
      { type: 'dismissed', identity: IDENTITY }
    ] as const satisfies readonly CreditTransitionNoticeEvent[]

    it.for(foreign)('leaves null untouched on $type', (event) => {
      expect(reduceCreditTransitionNotice(null, event)).toBeNull()
    })

    it.for(foreign)('leaves another identity untouched on $type', (event) => {
      const other = episode('armed', false, OTHER)

      expect(reduceCreditTransitionNotice(other, event)).toBe(other)
    })
  })
})

describe('isCreditTransitionNoticeOpen', () => {
  it.for([
    { phase: 'idle', open: false },
    { phase: 'armed', open: true },
    { phase: 'reported', open: true },
    { phase: 'dismissed', open: false }
  ] as const)('is $open while $phase', ({ phase, open }) => {
    expect(isCreditTransitionNoticeOpen(episode(phase, false), IDENTITY)).toBe(
      open
    )
  })

  it('is closed before any scoped balance is observed', () => {
    expect(isCreditTransitionNoticeOpen(null, IDENTITY)).toBe(false)
  })

  it('is closed for an episode belonging to another identity', () => {
    expect(
      isCreditTransitionNoticeOpen(episode('armed', false, OTHER), IDENTITY)
    ).toBe(false)
  })
})
