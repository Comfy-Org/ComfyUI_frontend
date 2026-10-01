import { describe, expect, it } from 'vitest'

import { outputSize, swapRequest } from './contract'

describe('outputSize', () => {
  it.for([
    { resolution: '1K', width: 1200, height: 900, size: [1024, 768] },
    { resolution: '2K', width: 1200, height: 900, size: [2048, 1536] },
    { resolution: '4K', width: 900, height: 1600, size: [2304, 4096] }
  ] as const)(
    'sets the long edge for $resolution and keeps the photo’s shape',
    ({ resolution, width, height, size }) => {
      const out = outputSize(resolution, width, height)
      expect([out.width, out.height]).toEqual(size)
    }
  )
})

describe('swapRequest', () => {
  it('sends the photos, the rounded region, the resolution and the seed', () => {
    expect(
      swapRequest({
        hand: { url: '/hand.jpg', width: 1200, height: 900 },
        productUrl: '/can.png',
        region: { x: 0.123456, y: 0.2, w: 1 / 3, h: 0.5 },
        resolution: '1K',
        seed: 7
      })
    ).toEqual({
      handImageUrl: '/hand.jpg',
      productImageUrl: '/can.png',
      region: { x: 0.1235, y: 0.2, w: 0.3333, h: 0.5 },
      resolution: '1K',
      width: 1024,
      height: 768,
      seed: 7
    })
  })
})
