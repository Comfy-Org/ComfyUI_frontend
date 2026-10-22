import { describe, expect, it } from 'vitest'

import {
  cropRegion,
  fitContain,
  outputFrame,
  outputSizeFrame,
  previewWorld,
  unionBounds
} from '@/components/cropByBBoxes/cropByBBoxesGeometry'

describe('unionBounds', () => {
  it('returns undefined for no boxes', () => {
    expect(unionBounds([])).toBeUndefined()
  })

  it('spans every box', () => {
    expect(
      unionBounds([
        { x: 10, y: 20, width: 30, height: 40 },
        { x: 50, y: 5, width: 10, height: 10 }
      ])
    ).toEqual({ x: 10, y: 5, width: 50, height: 55 })
  })
})

describe('cropRegion', () => {
  it.for([
    {
      name: 'uses the union as is',
      union: { x: 100, y: 100, width: 50, height: 40 },
      padding: 0,
      expected: { x: 100, y: 100, width: 50, height: 40 }
    },
    {
      name: 'adds padding on every side',
      union: { x: 100, y: 100, width: 50, height: 40 },
      padding: 10,
      expected: { x: 90, y: 90, width: 70, height: 60 }
    },
    {
      name: 'clamps to the image',
      union: { x: 100, y: 100, width: 50, height: 40 },
      padding: 500,
      expected: { x: 0, y: 0, width: 200, height: 160 }
    },
    {
      name: 'falls back to the backend default for a box outside the image',
      union: { x: 300, y: 10, width: 20, height: 20 },
      padding: 0,
      expected: { x: 76, y: 16, width: 48, height: 48 }
    }
  ])('$name', ({ union, padding, expected }) => {
    expect(cropRegion(union, padding, 200, 160)).toEqual(expected)
  })
})

describe('outputFrame', () => {
  const output = { width: 512, height: 256 }

  it.for([
    {
      name: 'stretch covers exactly the crop',
      keepAspect: 'stretch' as const,
      region: { x: 10, y: 100, width: 400, height: 100 },
      expected: { x: 10, y: 100, width: 400, height: 100 }
    },
    {
      name: 'pad grows a wide crop vertically into the output aspect',
      keepAspect: 'pad' as const,
      region: { x: 10, y: 100, width: 400, height: 100 },
      expected: { x: 10, y: 50, width: 400, height: 200 }
    },
    {
      name: 'pad grows a tall crop horizontally into the output aspect',
      keepAspect: 'pad' as const,
      region: { x: 100, y: 0, width: 100, height: 200 },
      expected: { x: -50, y: 0, width: 400, height: 200 }
    },
    {
      name: 'pad rounds the scaled crop half to even like Python',
      keepAspect: 'pad' as const,
      region: { x: 0, y: 300, width: 1024, height: 5 },
      expected: { x: 0, y: 46, width: 1024, height: 512 }
    }
  ])('$name', ({ keepAspect, region, expected }) => {
    expect(outputFrame(region, output, keepAspect)).toEqual(expected)
  })
})

describe('outputSizeFrame', () => {
  it('centres the output size on the crop region', () => {
    expect(
      outputSizeFrame(
        { x: 100, y: 50, width: 60, height: 40 },
        { width: 100, height: 20 }
      )
    ).toEqual({ x: 80, y: 60, width: 100, height: 20 })
  })
})

describe('previewWorld', () => {
  const image = { width: 200, height: 100 }

  it.for([
    {
      name: 'is the image alone without frames',
      frames: [],
      expected: { x: 0, y: 0, width: 200, height: 100 }
    },
    {
      name: 'stays on the image when the frames fit inside it',
      frames: [{ x: 20, y: 20, width: 50, height: 50 }],
      expected: { x: 0, y: 0, width: 200, height: 100 }
    },
    {
      name: 'grows on every side any frame overflows',
      frames: [
        { x: -30, y: 10, width: 100, height: 50 },
        { x: 50, y: -10, width: 180, height: 150 }
      ],
      expected: { x: -30, y: -10, width: 260, height: 150 }
    }
  ])('$name', ({ frames, expected }) => {
    expect(previewWorld(image, frames)).toEqual(expected)
  })
})

describe('fitContain', () => {
  it('letterboxes wide content in the middle of the box', () => {
    expect(
      fitContain({ width: 200, height: 100 }, { width: 100, height: 100 })
    ).toEqual({ x: 0, y: 25, width: 100, height: 50 })
  })
})
