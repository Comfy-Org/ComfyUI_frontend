import { describe, expect, it } from 'vitest'

import {
  dockCap,
  placeAsk,
  placeAttached,
  placeBeside,
  placeDock,
  placeStanding,
  placeStrip,
  slotWidth
} from './geometry'
import type { Pointing, Rect, Side } from './geometry'

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

describe('placeAsk', () => {
  const CANVAS = { x: 0, y: 40, width: 1280, height: 760 }

  it('BA-21: centres on the visible canvas and sits just above its bottom edge', () => {
    expect(placeAsk(CANVAS, WIDE)).toEqual({ centerX: 640, bottom: 10 })
  })

  it('BA-21: follows the canvas when the docked Agent panel or a bottom panel narrows it', () => {
    const smaller = { x: 0, y: 40, width: 880, height: 560 }

    expect(placeAsk(smaller, WIDE)).toEqual({ centerX: 440, bottom: 210 })
  })

  it('BA-21: centres on the window until the canvas has been measured', () => {
    const unmeasured = { x: 0, y: 0, width: 0, height: 0 }

    expect(placeAsk(unmeasured, WIDE)).toEqual({ centerX: 640, bottom: 10 })
  })
})

describe('slotWidth', () => {
  it('BA-05: is about 60% of the canvas, within a reasonable range', () => {
    expect(slotWidth({ x: 0, y: 40, width: 1000, height: 700 }, WIDE)).toBe(600)
    expect(slotWidth({ x: 0, y: 40, width: 2000, height: 700 }, WIDE)).toBe(640)
    expect(slotWidth({ x: 0, y: 40, width: 400, height: 700 }, WIDE)).toBe(320)
  })

  it('BA-05: never wider than the canvas it sits on', () => {
    expect(slotWidth({ x: 0, y: 40, width: 300, height: 700 }, WIDE)).toBe(284)
  })
})

describe('dockCap', () => {
  it('BA-11: is a third of the canvas height, and never less than room for a few lines', () => {
    expect(dockCap({ x: 0, y: 40, width: 1280, height: 720 }, WIDE)).toBe(240)
    expect(dockCap({ x: 0, y: 40, width: 1280, height: 300 }, WIDE)).toBe(160)
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

describe('placeDock', () => {
  const SIZE = { width: 72, height: 92 }

  it('CP-01, CP-19: sits at the bottom left of the visible canvas, 40 px in from its left edge and 10 px up', () => {
    const canvas = { x: 0, y: 40, width: 1280, height: 760 }

    expect(placeDock(canvas, SIZE, WIDE)).toEqual({ x: 40, y: 698 })
  })

  it('CP-01, CP-19: follows the canvas when the docked Agent panel or a bottom panel narrows it', () => {
    const smaller = { x: 320, y: 40, width: 960, height: 560 }

    expect(placeDock(smaller, SIZE, WIDE)).toEqual({ x: 360, y: 498 })
  })

  it('CP-01, CP-19: sits in the window until the canvas has been measured', () => {
    const unmeasured = { x: 0, y: 0, width: 0, height: 0 }

    expect(placeDock(unmeasured, SIZE, WIDE)).toEqual({ x: 40, y: 698 })
  })
})

describe('placeStanding', () => {
  const SIZE = { width: 144, height: 144 }
  const FIELD: Rect = { x: 400, y: 300, width: 180, height: 20 }
  const STAND = {
    order: ['right', 'left'] as Pointing[],
    avoid: [] as Rect[],
    fingertips: { left: { x: 19, y: 78 }, right: { x: 124, y: 79 } },
    gap: 10
  }

  it('CP-06: stands left of the target and points right, her fingertip a gap from it and level with its centre', () => {
    expect(placeStanding(FIELD, SIZE, WIDE, STAND)).toEqual({
      points: 'right',
      position: { x: 400 - 10 - 124, y: 310 - 79 }
    })
  })

  it('CP-06: stands right of the target and points left when the left side does not fit the window', () => {
    const nearTheLeftEdge = { ...FIELD, x: 60 }

    expect(placeStanding(nearTheLeftEdge, SIZE, WIDE, STAND)).toEqual({
      points: 'left',
      position: { x: 60 + 180 + 10 - 19, y: 310 - 78 }
    })
  })

  it('CP-06: stays beside a target near the top of the window, moved down to fit', () => {
    const nearTheTop = { ...FIELD, y: 10 }

    expect(placeStanding(nearTheTop, SIZE, WIDE, STAND)).toEqual({
      points: 'right',
      position: { x: 400 - 10 - 124, y: 8 }
    })
  })

  it('CP-10: takes the other side when the answer card or the Ask strip is on her first one', () => {
    const card = { x: 250, y: 200, width: 100, height: 120 }

    expect(
      placeStanding(FIELD, SIZE, WIDE, { ...STAND, avoid: [null, card] }).points
    ).toBe('left')
  })

  it('CP-10: stays on the first side that fits when everything is covered', () => {
    const everywhere = { x: 0, y: 0, width: 1280, height: 800 }

    expect(
      placeStanding(FIELD, SIZE, WIDE, { ...STAND, avoid: [everywhere] }).points
    ).toBe('right')
  })

  it('CP-06: stays inside the window when neither side has room', () => {
    const everything = { x: 0, y: 0, width: 1280, height: 800 }
    const stood = placeStanding(everything, SIZE, WIDE, STAND)

    expect(stood.points).toBe('right')
    expect(stood.position).toEqual({ x: 8, y: 400 - 79 })
  })
})
