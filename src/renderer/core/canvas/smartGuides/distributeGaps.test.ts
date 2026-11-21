import { describe, expect, it } from 'vitest'

import { evenGap, gapAfterTravel, setGap } from './distributeGaps'

const row = [
  { x: 0, y: 0, width: 100, height: 10, titleHeight: 0 },
  { x: 120, y: 0, width: 30, height: 10, titleHeight: 0 },
  { x: 170, y: 0, width: 50, height: 10, titleHeight: 0 },
  { x: 240, y: 0, width: 60, height: 10, titleHeight: 0 }
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
  it.for([0, 1, 2])('keeps handle %i under the pointer', (index) => {
    const travel = 30
    const gap = gapAfterTravel(row, 'x', index, travel)
    const spaced = setGap(row, 'x', index, gap)
    const handleBefore = row[index + 1].x - 20 / 2
    const handleAfter = spaced[index + 1].x - gap / 2
    expect(handleAfter - handleBefore).toBeCloseTo(travel, 0)
  })
})
