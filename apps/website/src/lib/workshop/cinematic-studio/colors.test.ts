import { describe, expect, it, vi } from 'vitest'

import {
  colorPromptSentences,
  dominantColors,
  isHexColor,
  sampleImageColors
} from './colors'

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

describe('sampleImageColors', () => {
  const image = (type = 'image/png', size = 4) =>
    new File([new Uint8Array(size)], 'still.png', { type })

  function stubBitmap(pixels: Uint8ClampedArray | undefined) {
    const close = vi.fn()
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => ({ width: 1, height: 1, close }))
    )
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      pixels
        ? ({
            drawImage: vi.fn(),
            getImageData: () => ({ data: pixels })
          } as unknown as CanvasRenderingContext2D)
        : null
    )
    return close
  }

  it('reads the colors of a picture without keeping it', async () => {
    const close = stubBitmap(new Uint8ClampedArray(pixel(250, 10, 10)))
    await expect(sampleImageColors(image())).resolves.toEqual(['#ff0000'])
    expect(createImageBitmap).toHaveBeenCalledWith(
      expect.any(File),
      expect.objectContaining({ resizeQuality: 'pixelated' })
    )
    expect(close).toHaveBeenCalledOnce()
  })

  it('refuses a file that is not a supported image or is too large', async () => {
    stubBitmap(new Uint8ClampedArray(pixel(0, 0, 0)))
    await expect(sampleImageColors(image('image/gif'))).rejects.toThrow()
    await expect(
      sampleImageColors(image('image/png', 10 * 1024 * 1024 + 1))
    ).rejects.toThrow()
    expect(createImageBitmap).not.toHaveBeenCalled()
  })

  it('closes the picture when the canvas is unavailable', async () => {
    const close = stubBitmap(undefined)
    await expect(sampleImageColors(image())).rejects.toThrow(
      'Canvas unavailable'
    )
    expect(close).toHaveBeenCalledOnce()
  })

  it('closes the picture when it has no opaque pixels', async () => {
    const close = stubBitmap(new Uint8ClampedArray(pixel(0, 0, 0, 0)))
    await expect(sampleImageColors(image())).rejects.toThrow('Empty image')
    expect(close).toHaveBeenCalledOnce()
  })
})
