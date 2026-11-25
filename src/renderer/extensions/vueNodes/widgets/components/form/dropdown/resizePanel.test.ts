import { describe, expect, it } from 'vitest'

import { resizePanel } from './resizePanel'

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
      expected: { width: 288, height: 320 }
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
