import { describe, expect, it } from 'vitest'

import { resizePanel, roomInViewport } from './resizePanel'

const start = { width: 400, height: 600 }
const roomy = { width: 2000, height: 2000 }

describe('resizePanel', () => {
  it.for([
    {
      name: 'left corner grows left and down below the trigger',
      handle: 'left-corner',
      pointer: { x: -50, y: 30 },
      growsUp: false,
      max: roomy,
      expected: { width: 450, height: 630 }
    },
    {
      name: 'left corner grows left and up above the trigger',
      handle: 'left-corner',
      pointer: { x: -50, y: -30 },
      growsUp: true,
      max: roomy,
      expected: { width: 450, height: 630 }
    },
    {
      name: 'left corner shrinks when dragged down above the trigger',
      handle: 'left-corner',
      pointer: { x: 20, y: 30 },
      growsUp: true,
      max: roomy,
      expected: { width: 380, height: 570 }
    },
    {
      name: 'right corner grows right and down below the trigger',
      handle: 'right-corner',
      pointer: { x: 50, y: 30 },
      growsUp: false,
      max: roomy,
      expected: { width: 450, height: 630 }
    },
    {
      name: 'left edge changes only the width',
      handle: 'left-edge',
      pointer: { x: -50, y: 30 },
      growsUp: false,
      max: roomy,
      expected: { width: 450, height: 600 }
    },
    {
      name: 'free edge changes only the height above the trigger',
      handle: 'free-edge',
      pointer: { x: -50, y: -30 },
      growsUp: true,
      max: roomy,
      expected: { width: 400, height: 630 }
    },
    {
      name: 'stops at the minimum size',
      handle: 'left-corner',
      pointer: { x: 300, y: -500 },
      growsUp: false,
      max: roomy,
      expected: { width: 320, height: 320 }
    },
    {
      name: 'stops at the available space',
      handle: 'right-corner',
      pointer: { x: 500, y: 500 },
      growsUp: false,
      max: { width: 600, height: 700 },
      expected: { width: 600, height: 700 }
    }
  ] as const)('$name', ({ handle, pointer, growsUp, max, expected }) => {
    expect(resizePanel(start, pointer, { handle, growsUp, max })).toEqual(
      expected
    )
  })
})

describe('roomInViewport', () => {
  const rect = { left: 300, right: 700, top: 100, bottom: 640 }
  const viewport = { width: 1280, height: 900 }

  it.for([
    {
      name: 'left corner below the trigger reaches the left and bottom edges',
      handle: 'left-corner',
      growsUp: false,
      expected: { width: 692, height: 792 }
    },
    {
      name: 'right corner above the trigger reaches the right and top edges',
      handle: 'right-corner',
      growsUp: true,
      expected: { width: 972, height: 632 }
    },
    {
      name: 'left edge leaves the height unbounded',
      handle: 'left-edge',
      growsUp: false,
      expected: { width: 692, height: Infinity }
    },
    {
      name: 'free edge leaves the width unbounded',
      handle: 'free-edge',
      growsUp: true,
      expected: { width: Infinity, height: 632 }
    }
  ] as const)('$name', ({ handle, growsUp, expected }) => {
    expect(roomInViewport(rect, viewport, { handle, growsUp })).toEqual(
      expected
    )
  })
})
