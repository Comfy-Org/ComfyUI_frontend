import { describe, expect, it } from 'vitest'

import { LinkDirection } from '../types/globalEnums'
import { bezierHead, bezierTail, linkSpline } from './linkSnapGeometry'

const spline = linkSpline(
  [0, 0],
  [400, 0],
  LinkDirection.RIGHT,
  LinkDirection.LEFT
)

describe('linkSnapGeometry', () => {
  it('bends a spline out of each slot along its direction', () => {
    expect(spline).toEqual([
      [0, 0],
      [100, 0],
      [300, 0],
      [400, 0]
    ])
  })

  it.for([
    { t: 0, head: [0, 0], tail: [400, 0] },
    { t: 0.5, head: [200, 0], tail: [200, 0] },
    { t: 1, head: [400, 0], tail: [0, 0] }
  ])('trims a curve from either end at $t', ({ t, head, tail }) => {
    expect(bezierHead(spline, t)[3]).toEqual(head)
    expect(bezierTail(spline, t)[0]).toEqual(tail)
    expect(bezierHead(spline, t)[0]).toEqual([0, 0])
    expect(bezierTail(spline, t)[3]).toEqual([400, 0])
  })
})
