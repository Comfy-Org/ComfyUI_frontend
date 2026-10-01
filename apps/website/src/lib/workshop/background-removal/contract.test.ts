import { describe, expect, it } from 'vitest'

import { DEFAULT_SETUP, cutoutFileName, cutoutRequest } from './contract'

describe('cutoutRequest', () => {
  it.for([
    { background: 'transparent', color: null },
    { background: 'white', color: '#FFFFFF' },
    { background: 'lilac', color: '#D9CCF5' }
  ] as const)(
    'sends $background as the fill $color',
    ({ background, color }) => {
      expect(
        cutoutRequest('/photo.jpg', {
          ...DEFAULT_SETUP,
          background,
          format: 'webp',
          seed: 7
        })
      ).toEqual({
        imageUrl: '/photo.jpg',
        background,
        backgroundColor: color,
        format: 'webp',
        edgeSoftness: DEFAULT_SETUP.edgeSoftness,
        seed: 7
      })
    }
  )
})

describe('cutoutFileName', () => {
  it.for([
    {
      name: 'potted-plant.jpg',
      format: 'png',
      file: 'potted-plant-cutout.png'
    },
    { name: 'shoe.final.jpeg', format: 'webp', file: 'shoe.final-cutout.webp' },
    { name: 'scan', format: 'png', file: 'scan-cutout.png' },
    { name: '.jpg', format: 'png', file: 'image-cutout.png' }
  ] as const)('names $name in $format as $file', ({ name, format, file }) => {
    expect(cutoutFileName(name, format)).toBe(file)
  })
})
