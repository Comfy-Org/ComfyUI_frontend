import { describe, expect, it } from 'vitest'

import { dialPoint, fromDial, nudgeDial } from './dial'

describe('dialPoint and fromDial', () => {
  it.for([
    { name: 'from the camera sits in the centre', direction: 0, elevation: 90 },
    { name: 'shining right sits on the left', direction: 0, elevation: 0 },
    { name: 'shining down sits at the top', direction: 90, elevation: 30 },
    { name: 'from behind sits on the rim', direction: -135, elevation: -90 }
  ])('$name and reads back', ({ direction, elevation }) => {
    const { x, y } = dialPoint(direction, elevation)
    expect(Math.hypot(x, y)).toBeCloseTo((90 - elevation) / 180)
    expect(fromDial(x, y, direction)).toEqual({ direction, elevation })
  })

  it('keeps the direction in the centre and stops at the rim', () => {
    expect(fromDial(0, 0, 40)).toEqual({ direction: 40, elevation: 90 })
    expect(fromDial(-3, 0, 40)).toEqual({ direction: 0, elevation: -90 })
  })
})

describe('nudgeDial', () => {
  it.for([
    { key: 'ArrowRight', step: 5, at: [175, 10], to: [-180, 10] },
    { key: 'ArrowLeft', step: 15, at: [0, 10], to: [-15, 10] },
    { key: 'ArrowUp', step: 5, at: [20, 88], to: [20, 90] },
    { key: 'ArrowDown', step: 5, at: [20, 10], to: [20, 5] }
  ])('$key by $step turns $at into $to', ({ key, step, at, to }) => {
    expect(nudgeDial(at[0], at[1], key, step)).toEqual({
      direction: to[0],
      elevation: to[1]
    })
  })

  it('ignores other keys', () => {
    expect(nudgeDial(0, 0, 'Enter')).toBeUndefined()
  })
})
