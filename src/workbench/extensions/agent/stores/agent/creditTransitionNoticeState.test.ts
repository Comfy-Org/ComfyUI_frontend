import { describe, expect, it } from 'vitest'

import type {
  CreditTransitionNoticeEvent,
  CreditTransitionNoticePhase,
  CreditTransitionNoticeState
} from './creditTransitionNoticeState'
import {
  isCreditTransitionNoticeShown,
  reduceCreditTransitionNotice
} from './creditTransitionNoticeState'

const IDENTITY = 'user-1:workspace-1'
const OTHER = 'user-2:workspace-1'

function episode(
  phase: 'idle' | 'dismissed',
  scopedHasFunds: boolean,
  identity?: string
): CreditTransitionNoticeState
function episode(
  phase: CreditTransitionNoticePhase,
  scopedHasFunds: false,
  identity?: string
): CreditTransitionNoticeState
function episode(
  phase: CreditTransitionNoticePhase,
  scopedHasFunds: boolean,
  identity = IDENTITY
): CreditTransitionNoticeState {
  if (phase === 'armed' || phase === 'shown')
    return { identity, scopedHasFunds: false, phase }
  return { identity, scopedHasFunds, phase }
}

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

    it.for([
      episode('idle', true, OTHER),
      episode('armed', false, OTHER),
      episode('shown', false, OTHER),
      episode('dismissed', true, OTHER)
    ])('discards a $phase episode belonging to another identity', (state) => {
      expect(
        reduceCreditTransitionNotice(state, {
          type: 'scopedRead',
          identity: IDENTITY,
          scopedHasFunds: false
        })
      ).toEqual(episode('idle', false))
    })
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

    it.for(['idle', 'armed', 'shown'] as const)(
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
    it.for(['idle', 'armed', 'shown'] as const)(
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

    it('clears a dismissal on refill, starting a fresh episode', () => {
      expect(
        reduceCreditTransitionNotice(episode('dismissed', false), {
          type: 'scopedRead',
          identity: IDENTITY,
          scopedHasFunds: true
        })
      ).toEqual(episode('idle', true))
    })
  })

  describe('shown', () => {
    it('claims the impression from an armed episode', () => {
      const armed = episode('armed', false)
      const shown = reduceCreditTransitionNotice(armed, {
        type: 'shown',
        identity: IDENTITY
      })

      expect(shown).toEqual(episode('shown', false))
    })

    it.for(['idle', 'shown', 'dismissed'] as const)(
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
    it.for(['idle', 'armed', 'shown'] as const)(
      'closes a %s episode',
      (phase) => {
        expect(
          reduceCreditTransitionNotice(episode(phase, false), {
            type: 'dismissed',
            identity: IDENTITY
          })
        ).toEqual(episode('dismissed', false))
      }
    )
  })

  describe('events for an identity the state does not hold', () => {
    const foreign = [
      { type: 'shown', identity: IDENTITY },
      { type: 'dismissed', identity: IDENTITY }
    ] as const satisfies readonly CreditTransitionNoticeEvent[]

    it.for(foreign)('leaves another identity untouched on $type', (event) => {
      const other = episode('armed', false, OTHER)

      expect(reduceCreditTransitionNotice(other, event)).toBe(other)
    })
  })
})

describe('isCreditTransitionNoticeShown', () => {
  it.for([
    { phase: 'idle', open: false },
    { phase: 'armed', open: true },
    { phase: 'shown', open: true },
    { phase: 'dismissed', open: false }
  ] as const)('is $open while $phase', ({ phase, open }) => {
    expect(isCreditTransitionNoticeShown(episode(phase, false), IDENTITY)).toBe(
      open
    )
  })

  it('is closed before any scoped balance is observed', () => {
    expect(isCreditTransitionNoticeShown(null, IDENTITY)).toBe(false)
  })

  it('is closed for an episode belonging to another identity', () => {
    expect(
      isCreditTransitionNoticeShown(episode('armed', false, OTHER), IDENTITY)
    ).toBe(false)
  })
})
