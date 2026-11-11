import { describe, expect, it } from 'vitest'

import { placeAttached, placeBeside } from './geometry'
import type { Rect, Side } from './geometry'

const WINDOW = { width: 1000, height: 800 }
const BUBBLE = { width: 320, height: 200 }
const ORDER: Side[] = ['right', 'left', 'below', 'above']
const ROW: Rect = { x: 100, y: 300, width: 200, height: 26 }

describe('placeAttached', () => {
  it('puts the box right of the target with its tail level with the target centre', () => {
    const placed = placeAttached(ROW, BUBBLE, WINDOW, ORDER)

    expect(placed.side).toBe('right')
    expect(placed.position.x).toBe(ROW.x + ROW.width + 16)
    expect(placed.position.y + placed.tail).toBe(ROW.y + ROW.height / 2)
  })

  it('falls back to the left when the right side does not fit the window', () => {
    const placed = placeAttached({ ...ROW, x: 600 }, BUBBLE, WINDOW, ORDER)

    expect(placed.side).toBe('left')
    expect(placed.position.x + BUBBLE.width + 16).toBe(600)
    expect(placed.position.y + placed.tail).toBe(ROW.y + ROW.height / 2)
  })

  it('places the box below with the tail under the target centre', () => {
    const placed = placeAttached(ROW, BUBBLE, WINDOW, ['below'])

    expect(placed.side).toBe('below')
    expect(placed.position.y).toBe(ROW.y + ROW.height + 16)
    expect(placed.position.x + placed.tail).toBe(ROW.x + ROW.width / 2)
  })

  it('places the box above with the tail over the target centre', () => {
    const placed = placeAttached(ROW, BUBBLE, WINDOW, ['above'])

    expect(placed.side).toBe('above')
    expect(placed.position.y + BUBBLE.height + 16).toBe(ROW.y)
    expect(placed.position.x + placed.tail).toBe(ROW.x + ROW.width / 2)
  })

  it('keeps the box inside the window and the tail on the box when the target is near the top', () => {
    const placed = placeAttached(
      { x: 100, y: 0, width: 200, height: 10 },
      BUBBLE,
      WINDOW,
      ['right']
    )

    expect(placed.position.y).toBe(8)
    expect(placed.tail).toBe(20)
  })

  it('keeps the tail on the box edge when the target is much taller than the box', () => {
    const placed = placeAttached(
      { x: 100, y: 0, width: 200, height: 800 },
      BUBBLE,
      WINDOW,
      ['right']
    )

    expect(placed.position.y + placed.tail).toBe(400)
    expect(placed.tail).toBeLessThanOrEqual(BUBBLE.height - 20)
  })
})

describe('placeBeside', () => {
  it('still puts the box top-aligned with the anchor on the first side that fits', () => {
    expect(placeBeside(ROW, BUBBLE, WINDOW, ORDER)).toEqual({
      x: ROW.x + ROW.width + 12,
      y: ROW.y
    })
  })
})
