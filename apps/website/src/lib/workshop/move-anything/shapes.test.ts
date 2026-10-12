import { describe, expect, it } from 'vitest'

import {
  EXAMPLE_SHAPES,
  blobAround,
  boundsOf,
  outlinePath,
  roundedBoxPath,
  shapeAt,
  shapeForBox
} from './shapes'

describe('shapeAt', () => {
  it.for([
    { name: 'the kitten', at: [0.2, 0.5], label: 'move.example.kitten' },
    {
      name: 'the left succulent',
      at: [0.35, 0.68],
      label: 'move.example.succulent'
    },
    { name: 'the window', at: [0.7, 0.2], label: undefined }
  ] as const)('finds $name under a click', ({ at, label }) => {
    expect(shapeAt(EXAMPLE_SHAPES, at)?.label).toBe(label)
  })
})

describe('shapeForBox', () => {
  it('picks the outline whose bounds best match the box', () => {
    const right = EXAMPLE_SHAPES[2]
    expect(shapeForBox(EXAMPLE_SHAPES, boundsOf(right.points))).toBe(right)
  })

  it('finds nothing for a box far from every outline', () => {
    expect(
      shapeForBox(EXAMPLE_SHAPES, { x: 0.7, y: 0.1, w: 0.2, h: 0.2 })
    ).toBeUndefined()
  })
})

describe('blobAround', () => {
  it('grows a blob about a fifth of the image across, kept inside it', () => {
    const box = boundsOf(blobAround([0.98, 0.02], 1.5))
    expect(box.w).toBeGreaterThan(0.15)
    expect(box.w).toBeLessThan(0.25)
    expect(box.x + box.w).toBeLessThanOrEqual(1)
    expect(box.y).toBeGreaterThanOrEqual(0)
  })
})

describe('paths', () => {
  it('closes an outline and a rounded box', () => {
    expect(outlinePath(EXAMPLE_SHAPES[0].points)).toMatch(/^M[\d. ]+C.*Z$/)
    expect(roundedBoxPath({ x: 0.1, y: 0.1, w: 0.2, h: 0.2 }, 1.5)).toMatch(
      /^M.*A.*Z$/
    )
  })
})
