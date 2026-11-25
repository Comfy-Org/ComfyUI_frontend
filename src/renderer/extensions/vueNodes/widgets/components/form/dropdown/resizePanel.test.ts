import { describe, expect, it } from 'vitest'

import { resizePanel } from './resizePanel'

const start = { width: 400, height: 600 }
const roomy = { width: 2000, height: 2000 }

describe('resizePanel', () => {
  it.for([
    {
      name: 'grows left and down below the trigger',
      pointer: { x: -50, y: 30 },
      growsUp: false,
      max: roomy,
      expected: { width: 450, height: 630 }
    },
    {
      name: 'grows left and up above the trigger',
      pointer: { x: -50, y: -30 },
      growsUp: true,
      max: roomy,
      expected: { width: 450, height: 630 }
    },
    {
      name: 'shrinks when dragged down above the trigger',
      pointer: { x: 20, y: 30 },
      growsUp: true,
      max: roomy,
      expected: { width: 380, height: 570 }
    },
    {
      name: 'stops at the minimum size',
      pointer: { x: 300, y: -500 },
      growsUp: false,
      max: roomy,
      expected: { width: 288, height: 320 }
    },
    {
      name: 'stops at the available space',
      pointer: { x: -500, y: 500 },
      growsUp: false,
      max: { width: 600, height: 700 },
      expected: { width: 600, height: 700 }
    }
  ])('$name', ({ pointer, growsUp, max, expected }) => {
    expect(resizePanel(start, pointer, { growsUp, max })).toEqual(expected)
  })
})
