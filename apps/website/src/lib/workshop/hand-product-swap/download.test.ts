import { describe, expect, it } from 'vitest'

import { swapFileName } from './download'

describe('swapFileName', () => {
  it.for([
    {
      hand: 'hand-holding-can.jpg',
      url: '/images/apps/hand-product-swap/result-serum.jpg',
      seed: 42,
      name: 'hand-holding-can-swapped-42.jpg'
    },
    {
      hand: 'my hand.png',
      url: 'blob:https://comfy.org/1234',
      seed: 7,
      name: 'my hand-swapped-7.jpg'
    },
    {
      hand: 'grip.webp',
      url: 'https://cdn.example/out/result.PNG',
      seed: 3,
      name: 'grip-swapped-3.png'
    }
  ])('names $hand as $name', ({ hand, url, seed, name }) => {
    expect(swapFileName(hand, { url, seed })).toBe(name)
  })
})
