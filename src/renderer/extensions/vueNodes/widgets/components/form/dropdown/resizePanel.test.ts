import { describe, expect, it } from 'vitest'

import { resizePanel, roomInViewport } from './resizePanel'

const start = { width: 400, height: 600 }
const roomy = { width: 2000, height: 2000 }

describe('resizePanel', () => {
  it.for([
    {
      name: 'left corner grows left and down below the trigger',
      direction: 'SW',
      pointer: { x: -50, y: 30 },
      max: roomy,
      expected: { width: 450, height: 630 }
    },
    {
      name: 'left corner grows left and up above the trigger',
      direction: 'NW',
      pointer: { x: -50, y: -30 },
      max: roomy,
      expected: { width: 450, height: 630 }
    },
    {
      name: 'left corner shrinks when dragged down above the trigger',
      direction: 'NW',
      pointer: { x: 20, y: 30 },
      max: roomy,
      expected: { width: 380, height: 570 }
    },
    {
      name: 'right corner grows right and down below the trigger',
      direction: 'SE',
      pointer: { x: 50, y: 30 },
      max: roomy,
      expected: { width: 450, height: 630 }
    },
    {
      name: 'left edge changes only the width',
      direction: 'W',
      pointer: { x: -50, y: 30 },
      max: roomy,
      expected: { width: 450, height: 600 }
    },
    {
      name: 'free edge changes only the height above the trigger',
      direction: 'N',
      pointer: { x: -50, y: -30 },
      max: roomy,
      expected: { width: 400, height: 630 }
    },
    {
      name: 'stops at the minimum size',
      direction: 'SW',
      pointer: { x: 300, y: -500 },
      max: roomy,
      expected: { width: 320, height: 320 }
    },
    {
      name: 'stops at the available space',
      direction: 'SE',
      pointer: { x: 500, y: 500 },
      max: { width: 600, height: 700 },
      expected: { width: 600, height: 700 }
    }
  ] as const)('$name', ({ direction, pointer, max, expected }) => {
    expect(resizePanel(start, pointer, { direction, max })).toEqual(expected)
  })
})

describe('roomInViewport', () => {
  const rect = { left: 300, right: 700, top: 100, bottom: 640 }
  const viewport = { width: 1280, height: 900 }

  it.for([
    {
      name: 'left corner below the trigger reaches the left and bottom edges',
      direction: 'SW',
      expected: { width: 692, height: 792 }
    },
    {
      name: 'right corner above the trigger reaches the right and top edges',
      direction: 'NE',
      expected: { width: 972, height: 632 }
    },
    {
      name: 'left edge leaves the height unbounded',
      direction: 'W',
      expected: { width: 692, height: Infinity }
    },
    {
      name: 'free edge leaves the width unbounded',
      direction: 'N',
      expected: { width: Infinity, height: 632 }
    }
  ] as const)('$name', ({ direction, expected }) => {
    expect(roomInViewport(rect, viewport, direction)).toEqual(expected)
  })
})
