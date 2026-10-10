import { describe, expect, it } from 'vitest'

import { pointerFraction, rectStyle } from './stage-geometry'

function frameAt(left: number, top: number, width: number, height: number) {
  const frame = document.createElement('div')
  frame.getBoundingClientRect = () => new DOMRect(left, top, width, height)
  return frame
}

describe('pointerFraction', () => {
  it.for([
    {
      name: 'inside the frame',
      frame: frameAt(100, 50, 200, 100),
      at: [150, 75],
      expected: { x: 0.25, y: 0.25 }
    },
    {
      name: 'with no frame',
      frame: undefined,
      at: [150, 75],
      expected: { x: 0, y: 0 }
    },
    {
      name: 'on an unsized frame',
      frame: frameAt(0, 0, 0, 0),
      at: [10, 10],
      expected: { x: 0, y: 0 }
    }
  ])('reads a pointer $name', ({ frame, at, expected }) => {
    const event = new PointerEvent('pointermove', {
      clientX: at[0],
      clientY: at[1]
    })
    expect(pointerFraction(event, frame)).toEqual(expected)
  })
})

describe('rectStyle', () => {
  it('places a fractional box in percentages', () => {
    expect(rectStyle({ x: 0.1, y: 0.25, w: 0.5, h: 0.75 })).toEqual({
      left: '10%',
      top: '25%',
      width: '50%',
      height: '75%'
    })
  })
})
