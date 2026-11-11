import { describe, expect, it } from 'vitest'

import {
  clipAround,
  placeAttached,
  placeBeside,
  placePanel,
  placeStrip
} from './geometry'
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

const WIDE = { width: 1280, height: 800 }

describe('keeping clear of the open panel', () => {
  const PANEL = { x: 820, y: 48, width: 320, height: 400 }
  const NEAR_PANEL = { x: 600, y: 200, width: 180, height: 18 }

  it('P-14: a bubble takes the next side when its first side would sit under the panel', () => {
    expect(placeAttached(NEAR_PANEL, BUBBLE, WIDE, ORDER, PANEL).side).not.toBe(
      placeAttached(NEAR_PANEL, BUBBLE, WIDE, ORDER).side
    )
  })

  it('P-14: a comment box takes the next side when its first side would sit under the panel', () => {
    const free = placeBeside(NEAR_PANEL, BUBBLE, WIDE, ORDER, PANEL)

    expect(free.x + BUBBLE.width).toBeLessThanOrEqual(PANEL.x)
  })

  it('P-14: is placed as before when no side is clear of the panel', () => {
    const everywhere = { x: 0, y: 0, width: 1280, height: 800 }

    expect(placeAttached(NEAR_PANEL, BUBBLE, WIDE, ORDER, everywhere)).toEqual(
      placeAttached(NEAR_PANEL, BUBBLE, WIDE, ORDER)
    )
  })
})

describe('placePanel', () => {
  const TRIGGER = { x: 1000, y: 8, width: 110, height: 28 }
  const CANVAS = { x: 0, y: 40, width: 1280, height: 760 }

  it('P-12: sits under the trigger with right edges aligned and room to scroll', () => {
    expect(placePanel(TRIGGER, 320, CANVAS, WIDE)).toEqual({
      x: 790,
      y: 44,
      maxHeight: 748
    })
  })

  it('P-13: moves left to stay over the canvas when the docked Agent panel is open', () => {
    const besideAgentPanel = { ...CANVAS, width: 880 }

    expect(placePanel(TRIGGER, 320, besideAgentPanel, WIDE).x).toBe(552)
  })

  it('P-13: stays inside a window too narrow for both', () => {
    const narrow = { width: 400, height: 800 }
    const sliver = { x: 0, y: 40, width: 100, height: 760 }

    expect(placePanel({ ...TRIGGER, x: 250 }, 320, sliver, narrow).x).toBe(8)
  })
})

describe('placeStrip', () => {
  const CANVAS = { x: 0, y: 40, width: 1280, height: 760 }
  const STRIP = { width: 16, height: 200 }

  it('TS-24: sits against the right edge of the canvas, vertically centred', () => {
    expect(placeStrip(CANVAS, STRIP, WIDE, null)).toEqual({ x: 1256, y: 320 })
  })

  it('TS-24: follows the canvas edge when the docked Agent panel narrows it', () => {
    const besideAgentPanel = { ...CANVAS, width: 880 }

    expect(placeStrip(besideAgentPanel, STRIP, WIDE, null).x).toBe(856)
  })

  it('TS-25: stays where it is while the open panel is clear of it', () => {
    const panel = { x: 960, y: 44, width: 320, height: 180 }

    expect(placeStrip(CANVAS, STRIP, WIDE, panel)).toEqual({ x: 1256, y: 320 })
  })

  it('TS-25: moves just left of the open panel when they would overlap', () => {
    const tallPanel = { x: 960, y: 44, width: 320, height: 500 }

    expect(placeStrip(CANVAS, STRIP, WIDE, tallPanel)).toEqual({
      x: 936,
      y: 320
    })
  })

  it('TS-24: is placed in the window until the canvas has been measured', () => {
    const unmeasured = { x: 0, y: 0, width: 0, height: 0 }

    expect(placeStrip(unmeasured, STRIP, WIDE, null)).toEqual({
      x: 1256,
      y: 300
    })
  })
})

describe('clipAround', () => {
  it('P-15: leaves the trigger out of the surface that takes the pointer', () => {
    expect(clipAround({ x: 1000, y: 8, width: 110, height: 28 })).toBe(
      'polygon(evenodd, 0 0, 100% 0, 100% 100%, 0 100%, 0 0, 1000px 8px, 1000px 36px, 1110px 36px, 1110px 8px, 1000px 8px)'
    )
    expect(clipAround(null)).toBeUndefined()
  })
})
