import { describe, expect, it } from 'vitest'

import { INTERRUPTION_TIERS, decide, outranks } from './interruptionPolicy'
import type { Interrupter } from './interruptionPolicy'

const interrupter = (
  id: string,
  tier: Interrupter['tier'],
  order = 0
): Interrupter => ({ id, tier, order })

describe('outranks', () => {
  it.for([
    ['blocking', 'announcement', true],
    ['feedback', 'announcement', true],
    ['announcement', 'announcement', false],
    ['announcement', 'blocking', false],
    ['research', 'lifecycle', false],
    ['lifecycle', 'research', true]
  ] as const)('%s over %s is %s', ([candidate, subject, expected]) => {
    expect(
      outranks(interrupter('a', candidate), interrupter('b', subject))
    ).toBe(expected)
  })

  it('breaks a same-tier tie by lowest order, and never both ways', () => {
    const first = interrupter('first', 'announcement', 0)
    const second = interrupter('second', 'announcement', 1)

    expect(outranks(first, second)).toBe(true)
    expect(outranks(second, first)).toBe(false)
  })

  it('ranks every tier strictly above the one after it', () => {
    INTERRUPTION_TIERS.slice(0, -1).forEach((tier, i) => {
      const next = INTERRUPTION_TIERS[i + 1]
      expect(outranks(interrupter('a', tier), interrupter('b', next))).toBe(
        true
      )
      expect(outranks(interrupter('b', next), interrupter('a', tier))).toBe(
        false
      )
    })
  })
})

describe('decide', () => {
  const subject = interrupter('whatsNewPopup', 'announcement', 1)

  it('shows when nothing is active', () => {
    expect(decide(subject, [])).toEqual({ kind: 'show' })
  })

  it('shows when only lower-ranked interrupters are active', () => {
    expect(
      decide(subject, [
        interrupter('survey', 'research'),
        interrupter('modal', 'lifecycle')
      ])
    ).toEqual({ kind: 'show' })
  })

  it('defers to a higher tier and names it', () => {
    expect(decide(subject, [interrupter('dialog', 'blocking')])).toEqual({
      kind: 'defer',
      reason: 'outranked',
      by: 'dialog'
    })
  })

  it('defers to a same-tier surface with a lower order', () => {
    expect(
      decide(subject, [interrupter('releaseToast', 'announcement', 0)])
    ).toEqual({ kind: 'defer', reason: 'outranked', by: 'releaseToast' })
  })

  it('does not defer to a same-tier surface with a higher order', () => {
    expect(decide(subject, [interrupter('other', 'announcement', 2)])).toEqual({
      kind: 'show'
    })
  })

  it('ignores its own entry in the active list', () => {
    expect(decide(subject, [subject])).toEqual({ kind: 'show' })
  })

  it('names the first outranking interrupter when several are active', () => {
    expect(
      decide(subject, [
        interrupter('dialog', 'blocking'),
        interrupter('nodeSelection', 'blocking', 3)
      ])
    ).toEqual({ kind: 'defer', reason: 'outranked', by: 'dialog' })
  })
})
