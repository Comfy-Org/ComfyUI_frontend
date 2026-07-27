import { describe, expect, it } from 'vitest'

import { RENDER_COUNT, pickSeed, renderSrc } from './useHeroWorkflowRun'

describe('renderSrc', () => {
  it('maps indices to zero-padded webp paths', () => {
    expect(renderSrc(0)).toBe('/images/hero/renders/render-01.webp')
    expect(renderSrc(RENDER_COUNT - 1)).toBe(
      '/images/hero/renders/render-50.webp'
    )
  })
})

describe('pickSeed', () => {
  it('never lands on the previous render bucket two runs in a row', () => {
    const lastIndex = 7
    // Force a seed that collides with the last render bucket.
    const collidingRandom = () => (RENDER_COUNT + lastIndex) / 999_999_999
    const seed = pickSeed(collidingRandom, lastIndex)
    expect(seed % RENDER_COUNT).not.toBe(lastIndex)
  })

  it('keeps the seed unchanged when there is no collision', () => {
    const seed = pickSeed(() => 0.5, null)
    expect(seed).toBe(Math.floor(0.5 * 999_999_999))
  })
})
