import { describe, expect, it } from 'vitest'

import { evenGap, gapAfterTravel, setGap } from './distributeGaps'

const row = [
  { x: 0, y: 0, width: 100, height: 10, head: 0 },
  { x: 120, y: 0, width: 30, height: 10, head: 0 },
  { x: 170, y: 0, width: 50, height: 10, head: 0 },
  { x: 240, y: 0, width: 60, height: 10, head: 0 }
]

describe('evenGap', () => {
  it('returns the shared gap, or undefined once one gap differs', () => {
    expect(evenGap(row, 'x')).toBe(20)
    expect(evenGap([...row.slice(0, 3), { ...row[3], x: 250 }], 'x')).toBe(
      undefined
    )
  })
})

describe('setGap', () => {
  it.for([
    {
      name: 'a handle in the second half keeps the first box fixed',
      index: 2,
      xs: [0, 130, 190, 270]
    },
    {
      name: 'a handle in the first half keeps the last box fixed',
      index: 0,
      xs: [-30, 100, 160, 240]
    }
  ])('$name', ({ index, xs }) => {
    expect(setGap(row, 'x', index, 30).map((box) => box.x)).toEqual(xs)
  })

  it('never makes gaps negative', () => {
    expect(evenGap(setGap(row, 'x', 2, -40), 'x')).toBe(0)
  })
})

describe('gapAfterTravel', () => {
  it('keeps the dragged handle under the pointer', () => {
    const travel = 25
    const gap = gapAfterTravel(row, 'x', 2, travel)
    const spaced = setGap(row, 'x', 2, gap)
    const handleBefore = row[3].x - 20 / 2
    const handleAfter = spaced[3].x - gap / 2
    expect(handleAfter - handleBefore).toBeCloseTo(travel, 0)
  })
})
