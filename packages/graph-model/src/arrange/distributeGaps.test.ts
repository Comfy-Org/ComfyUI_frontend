import { describe, expect, it } from 'vitest'

import { evenGap } from './arrange'

import { gapAfterTravel, gapMidpoints, setGap } from './distributeGaps'

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

describe('gapMidpoints', () => {
  const column = [
    { x: 40, y: 0, width: 100, height: 50, titleHeight: 0 },
    { x: 0, y: 70, width: 60, height: 30, titleHeight: 0 },
    { x: 10, y: 120, width: 200, height: 40, titleHeight: 0 }
  ]

  it.for([
    {
      axis: 'x' as const,
      boxes: [row[0], { ...row[1], y: -30 }, row[2], row[3]],
      expected: [
        { x: 110, y: -10 },
        { x: 160, y: -10 },
        { x: 230, y: -10 }
      ]
    },
    {
      axis: 'y' as const,
      boxes: column,
      expected: [
        { x: 105, y: 60 },
        { x: 105, y: 110 }
      ]
    }
  ])(
    'centres each $axis handle in its gap and across the whole extent',
    ({ axis, boxes, expected }) => {
      expect(gapMidpoints(boxes, axis, 20)).toEqual(expected)
    }
  )
})
