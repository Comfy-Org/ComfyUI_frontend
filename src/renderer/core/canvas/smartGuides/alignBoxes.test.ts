import { describe, expect, it } from 'vitest'

import { alignBoxes } from './alignBoxes'
import type { AlignAction } from './alignBoxes'

const a = { x: 10, y: 0, width: 100, height: 60, head: 30 }
const b = { x: 200, y: 50, width: 40, height: 90, head: 0 }

describe('alignBoxes', () => {
  it.for<{
    action: AlignAction
    axis: 'x' | 'y'
    expected: [number, number]
  }>([
    { action: 'left', axis: 'x', expected: [10, 10] },
    { action: 'center', axis: 'x', expected: [75, 105] },
    { action: 'right', axis: 'x', expected: [140, 200] },
    { action: 'middle', axis: 'y', expected: [40, 25] },
    { action: 'bottom', axis: 'y', expected: [80, 50] }
  ])('$action moves only along $axis', ({ action, axis, expected }) => {
    const [first, second] = alignBoxes([a, b], action)
    expect([first[axis], second[axis]]).toEqual(expected)
  })

  it('aligns body tops so headed and headless nodes line up their bodies', () => {
    const [first, second] = alignBoxes([a, b], 'top')
    expect([first.y + first.head, second.y + second.head]).toEqual([30, 30])
  })

  it('matches body height, keeping each box its own title', () => {
    const [first, second] = alignBoxes([a, b], 'matchHeight')
    expect([first.height, second.height]).toEqual([120, 90])
  })

  it('distributes the middle boxes evenly between fixed outer boxes', () => {
    const boxes = [
      { x: 0, y: 0, width: 100, height: 10, head: 0 },
      { x: 500, y: 0, width: 50, height: 10, head: 0 },
      { x: 130, y: 0, width: 20, height: 10, head: 0 }
    ]
    expect(alignBoxes(boxes, 'distributeX').map((box) => box.x)).toEqual([
      0, 500, 290
    ])
  })
})
