import { describe, expect, it } from 'vitest'

import type { MapCorner } from './map-corner'
import { cornerBox, handleBox, pickMapCorner } from './map-corner'

const FRAME = { width: 800, height: 600 }
const CARD = { width: 240, height: 140 }
const FIT = { scale: 1, x: 0, y: 0 }

const TOP_LEFT = { x: 0.12, y: 0.15 }
const TOP_RIGHT = { x: 0.88, y: 0.15 }
const BOTTOM_LEFT = { x: 0.12, y: 0.8 }
const BOTTOM_RIGHT = { x: 0.88, y: 0.8 }
const MIDDLE = { x: 0.5, y: 0.5 }

describe('pickMapCorner', () => {
  it.for<{
    name: string
    handles: { x: number; y: number }[]
    zoom?: { scale: number; x: number; y: number }
    corner: MapCorner
  }>([
    { name: 'no handles', handles: [], corner: 'top-left' },
    { name: 'a handle in the middle', handles: [MIDDLE], corner: 'top-left' },
    { name: 'a handle top left', handles: [TOP_LEFT], corner: 'top-right' },
    {
      name: 'handles in both top corners',
      handles: [TOP_LEFT, TOP_RIGHT],
      corner: 'bottom-left'
    },
    {
      name: 'handles in every corner but bottom right',
      handles: [TOP_LEFT, TOP_RIGHT, BOTTOM_LEFT],
      corner: 'bottom-right'
    },
    {
      name: 'handles in every corner',
      handles: [TOP_LEFT, TOP_RIGHT, BOTTOM_LEFT, BOTTOM_RIGHT],
      corner: 'top-left'
    },
    {
      name: 'a top left handle panned out from under the card',
      handles: [TOP_LEFT],
      zoom: { scale: 2, x: 200, y: 0 },
      corner: 'top-left'
    },
    {
      name: 'a middle handle zoomed and panned under the card',
      handles: [MIDDLE],
      zoom: { scale: 2, x: -700, y: -540 },
      corner: 'top-right'
    }
  ])('picks $corner with $name', ({ handles, zoom = FIT, corner }) => {
    const boxes = handles.map((at) => handleBox(at, FRAME, zoom))
    expect(pickMapCorner(FRAME, CARD, boxes)).toBe(corner)
  })

  it('lifts the bottom corners clear of the hint along the bottom', () => {
    const box = cornerBox('bottom-right', FRAME, CARD)
    expect(box.x + box.width).toBeLessThan(FRAME.width)
    expect(FRAME.height - (box.y + box.height)).toBeGreaterThanOrEqual(40)
  })
})
