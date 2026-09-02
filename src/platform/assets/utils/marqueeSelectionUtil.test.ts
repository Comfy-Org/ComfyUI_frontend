import { describe, expect, it } from 'vitest'

import type { RectEdges } from '@/utils/mathUtil'

import type { MarqueeCard } from './marqueeSelectionUtil'
import { normalizeMarqueeRect, selectMarqueeIds } from './marqueeSelectionUtil'

const box = (
  left: number,
  top: number,
  right: number,
  bottom: number
): RectEdges => ({
  left,
  top,
  right,
  bottom
})

describe('normalizeMarqueeRect', () => {
  it('orders corners when dragging down-right', () => {
    expect(normalizeMarqueeRect({ x: 10, y: 20 }, { x: 50, y: 80 })).toEqual(
      box(10, 20, 50, 80)
    )
  })

  it('orders corners when dragging up-left', () => {
    expect(normalizeMarqueeRect({ x: 50, y: 80 }, { x: 10, y: 20 })).toEqual(
      box(10, 20, 50, 80)
    )
  })

  it('orders corners when dragging across axes', () => {
    expect(normalizeMarqueeRect({ x: 50, y: 20 }, { x: 10, y: 80 })).toEqual(
      box(10, 20, 50, 80)
    )
  })
})

describe('selectMarqueeIds', () => {
  const cards: MarqueeCard[] = [
    { id: 'a', rect: box(0, 0, 10, 10) },
    { id: 'b', rect: box(20, 0, 30, 10) },
    { id: 'c', rect: box(40, 0, 50, 10) }
  ]

  it('selects only intersecting cards when base is empty (replace)', () => {
    const result = selectMarqueeIds(cards, box(15, 0, 35, 10))
    expect([...result]).toEqual(['b'])
  })

  it('unions intersecting cards with the base selection (additive)', () => {
    const result = selectMarqueeIds(cards, box(35, 0, 55, 10), ['a'])
    expect([...result].sort()).toEqual(['a', 'c'])
  })

  it('removes intersecting cards from the base selection (subtractive)', () => {
    const result = selectMarqueeIds(cards, box(15, 0, 35, 10), ['a', 'b'], true)
    expect([...result]).toEqual(['a'])
  })

  it('returns a copy of the base when nothing intersects', () => {
    const base = new Set(['a'])
    const result = selectMarqueeIds(cards, box(100, 100, 110, 110), base)
    expect([...result]).toEqual(['a'])
    expect(result).not.toBe(base)
  })

  it('does not mutate the provided base set', () => {
    const base = new Set(['a'])
    selectMarqueeIds(cards, box(15, 0, 35, 10), base)
    expect([...base]).toEqual(['a'])
  })

  it('includes a card whose edge merely touches the marquee', () => {
    const touching = [{ id: 'edge', rect: box(0, 0, 10, 10) }]
    expect([...selectMarqueeIds(touching, box(10, 0, 20, 10))]).toEqual([
      'edge'
    ])
  })

  it('includes a card that contains the marquee and vice versa', () => {
    const around = [{ id: 'around', rect: box(40, 40, 60, 60) }]
    expect([...selectMarqueeIds(around, box(0, 0, 100, 100))]).toEqual([
      'around'
    ])
  })

  it('excludes a card separated on a single axis', () => {
    const below = [{ id: 'below', rect: box(0, 20, 10, 30) }]
    expect([...selectMarqueeIds(below, box(0, 0, 10, 10))]).toEqual([])
  })
})
