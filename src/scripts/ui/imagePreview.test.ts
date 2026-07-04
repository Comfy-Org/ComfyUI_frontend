import { describe, expect, it } from 'vitest'

import { calculateImageGrid } from './imagePreview'

function createImage(width: number, height: number) {
  const img = document.createElement('img')
  Object.defineProperty(img, 'naturalWidth', {
    configurable: true,
    value: width
  })
  Object.defineProperty(img, 'naturalHeight', {
    configurable: true,
    value: height
  })
  return img
}

describe('imagePreview', () => {
  it('calculates the highest-area grid', () => {
    const images = [
      createImage(100, 100),
      createImage(100, 100),
      createImage(100, 100)
    ]

    expect(calculateImageGrid(images, 300, 120)).toMatchObject({
      cellWidth: 100,
      cellHeight: 100,
      cols: 3,
      rows: 1
    })
  })
})
