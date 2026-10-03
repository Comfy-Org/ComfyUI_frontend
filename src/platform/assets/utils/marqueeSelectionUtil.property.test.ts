import * as fc from 'fast-check'
import { describe, expect, it } from 'vitest'

import type { MarqueeCard } from './marqueeSelectionUtil'
import { normalizeMarqueeRect, selectMarqueeIds } from './marqueeSelectionUtil'

const ID_POOL = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const

const arbPoint = fc.record({
  x: fc.integer({ min: -100, max: 100 }),
  y: fc.integer({ min: -100, max: 100 })
})

const arbRect = fc
  .tuple(arbPoint, arbPoint)
  .map(([start, end]) => normalizeMarqueeRect(start, end))

const arbCards: fc.Arbitrary<MarqueeCard[]> = fc.uniqueArray(
  fc.record({ id: fc.constantFrom(...ID_POOL), rect: arbRect }),
  { selector: (card) => card.id, maxLength: ID_POOL.length }
)

const arbBaseIds = fc.uniqueArray(fc.constantFrom(...ID_POOL), {
  maxLength: ID_POOL.length
})

describe('marqueeSelectionUtil properties', () => {
  it('additive result is the union of the base and the covered ids', () => {
    fc.assert(
      fc.property(arbCards, arbRect, arbBaseIds, (cards, marquee, base) => {
        const covered = selectMarqueeIds(cards, marquee)
        const result = selectMarqueeIds(cards, marquee, base)
        expect([...result].sort()).toEqual(
          [...new Set([...base, ...covered])].sort()
        )
      })
    )
  })

  it('subtractive result is the base minus the covered ids', () => {
    fc.assert(
      fc.property(arbCards, arbRect, arbBaseIds, (cards, marquee, base) => {
        const covered = selectMarqueeIds(cards, marquee)
        const result = selectMarqueeIds(cards, marquee, base, true)
        expect([...result].sort()).toEqual(
          base.filter((id) => !covered.has(id)).sort()
        )
      })
    )
  })

  it('subtractive mode preserves the base order of surviving ids', () => {
    fc.assert(
      fc.property(arbCards, arbRect, arbBaseIds, (cards, marquee, base) => {
        const covered = selectMarqueeIds(cards, marquee)
        const result = selectMarqueeIds(cards, marquee, base, true)
        expect([...result]).toEqual(base.filter((id) => !covered.has(id)))
      })
    )
  })

  it('never mutates baseIds in either mode', () => {
    fc.assert(
      fc.property(
        arbCards,
        arbRect,
        arbBaseIds,
        fc.boolean(),
        (cards, marquee, base, subtract) => {
          const original = [...base]
          selectMarqueeIds(cards, marquee, base, subtract)
          expect(base).toEqual(original)
        }
      )
    )
  })

  it('normalizeMarqueeRect always yields ordered edges containing both points', () => {
    fc.assert(
      fc.property(arbPoint, arbPoint, (start, end) => {
        const rect = normalizeMarqueeRect(start, end)
        expect(rect.left).toBeLessThanOrEqual(rect.right)
        expect(rect.top).toBeLessThanOrEqual(rect.bottom)
        for (const point of [start, end]) {
          expect(point.x).toBeGreaterThanOrEqual(rect.left)
          expect(point.x).toBeLessThanOrEqual(rect.right)
          expect(point.y).toBeGreaterThanOrEqual(rect.top)
          expect(point.y).toBeLessThanOrEqual(rect.bottom)
        }
      })
    )
  })
})
