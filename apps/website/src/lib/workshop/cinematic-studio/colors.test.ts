import { describe, expect, it } from 'vitest'

import { colorPromptSentences, dominantColors, isHexColor } from './colors'

const pixel = (r: number, g: number, b: number, a = 255) => [r, g, b, a]

describe('colorPromptSentences', () => {
  it('names the colors and, when one leads, says so', () => {
    expect(colorPromptSentences(['#112233'])).toEqual([
      'Color grade: dominant colors #112233. Keep skin tones believable.'
    ])
    expect(colorPromptSentences(['#112233', '#445566'], 1)[1]).toMatch(
      /^Palette priority: #445566 is the main color/
    )
  })

  it('skips anything that is not a hex color and caps at eight', () => {
    const many = Array.from({ length: 10 }, () => '#abcdef')
    expect(colorPromptSentences(['red', ...many])[0]).toBe(
      `Color grade: dominant colors ${many.slice(0, 8).join(', ')}. Keep skin tones believable.`
    )
    expect(colorPromptSentences(['nope'])).toEqual([])
    expect(colorPromptSentences(['#112233'], 3)).toHaveLength(1)
  })
})

describe('dominantColors', () => {
  it('counts near shades together, most common first, skipping transparency', () => {
    const pixels = new Uint8ClampedArray([
      ...pixel(250, 10, 10),
      ...pixel(245, 5, 12),
      ...pixel(10, 10, 250),
      ...pixel(0, 255, 0, 0)
    ])
    expect(dominantColors(pixels)).toEqual(['#ff0000', '#0000ff'])
  })

  it('returns valid hex colors', () => {
    const colors = dominantColors(new Uint8ClampedArray(pixel(17, 130, 201)))
    expect(colors.every(isHexColor)).toBe(true)
  })
})
