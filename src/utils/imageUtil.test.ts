import { describe, expect, it } from 'vitest'

import {
  fitDimensionsToNodeWidth,
  getGridThumbnailUrl,
  is_all_same_aspect_ratio,
  parseImageWidgetValue
} from './imageUtil'

describe('getGridThumbnailUrl', () => {
  it('adds a compact preview format to a full-resolution view URL', () => {
    const result = getGridThumbnailUrl(
      '/api/view?filename=image.png&type=output&subfolder='
    )
    expect(result).toMatch(/[?&]preview=webp(%3B|;)75/)
    expect(result).toContain('filename=image.png')
  })

  it('preserves an existing preview param (user-configured format)', () => {
    const result = getGridThumbnailUrl(
      '/api/view?filename=image.png&type=output&preview=jpeg;50'
    )
    expect(result).toContain('preview=jpeg')
    expect(result).not.toMatch(/preview=webp/)
  })

  it('leaves SVGs untouched since the server cannot rasterize them', () => {
    const url = '/api/view?filename=diagram.svg&type=output'
    expect(getGridThumbnailUrl(url)).toBe(url)
  })

  it('leaves non-view URLs (e.g. blob previews) untouched', () => {
    const blob = 'blob:http://localhost/abc-123'
    expect(getGridThumbnailUrl(blob)).toBe(blob)
  })

  it('leaves empty and malformed URLs untouched', () => {
    expect(getGridThumbnailUrl('')).toBe('')
    expect(getGridThumbnailUrl('http://[bad-url')).toBe('http://[bad-url')
  })

  it('preserves absolute URL shape when adding preview params', () => {
    const result = getGridThumbnailUrl(
      'https://comfy.local/api/view?filename=image.png&type=output'
    )

    expect(result).toMatch(/^https:\/\/comfy\.local\/api\/view\?/)
    expect(result).toContain('preview=webp')
  })
})

describe('parseImageWidgetValue', () => {
  it('parses a plain filename', () => {
    expect(parseImageWidgetValue('example.png')).toEqual({
      filename: 'example.png',
      subfolder: '',
      type: 'input'
    })
  })

  it('parses filename with type suffix', () => {
    expect(parseImageWidgetValue('example.png [output]')).toEqual({
      filename: 'example.png',
      subfolder: '',
      type: 'output'
    })
  })

  it('parses subfolder and filename', () => {
    expect(parseImageWidgetValue('clipspace/mask-123.png')).toEqual({
      filename: 'mask-123.png',
      subfolder: 'clipspace',
      type: 'input'
    })
  })

  it('parses subfolder, filename, and type', () => {
    expect(
      parseImageWidgetValue(
        'clipspace/clipspace-painted-masked-123.png [input]'
      )
    ).toEqual({
      filename: 'clipspace-painted-masked-123.png',
      subfolder: 'clipspace',
      type: 'input'
    })
  })

  it('parses nested subfolders', () => {
    expect(parseImageWidgetValue('a/b/c/image.png [temp]')).toEqual({
      filename: 'image.png',
      subfolder: 'a/b/c',
      type: 'temp'
    })
  })

  it('handles empty string', () => {
    expect(parseImageWidgetValue('')).toEqual({
      filename: '',
      subfolder: '',
      type: 'input'
    })
  })
})

describe('is_all_same_aspect_ratio', () => {
  function image(width: number, height: number) {
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

  it('accepts empty, single, and matching aspect ratio image sets', () => {
    expect(is_all_same_aspect_ratio([])).toBe(true)
    expect(is_all_same_aspect_ratio([image(10, 20)])).toBe(true)
    expect(is_all_same_aspect_ratio([image(10, 20), image(30, 60)])).toBe(true)
  })

  it('rejects mismatched aspect ratios', () => {
    expect(is_all_same_aspect_ratio([image(10, 20), image(20, 20)])).toBe(false)
  })
})

describe('fitDimensionsToNodeWidth', () => {
  it('scales image dimensions to the node width with a minimum height', () => {
    expect(fitDimensionsToNodeWidth(400, 200, 100)).toEqual({
      minWidth: 100,
      minHeight: 64
    })
    expect(fitDimensionsToNodeWidth(200, 400, 100)).toEqual({
      minWidth: 100,
      minHeight: 200
    })
  })

  it('returns zero dimensions when the aspect ratio is zero or NaN', () => {
    expect(fitDimensionsToNodeWidth(0, 100, 200)).toEqual({
      minWidth: 0,
      minHeight: 0
    })
    expect(fitDimensionsToNodeWidth(0, 0, 200)).toEqual({
      minWidth: 0,
      minHeight: 0
    })
  })
})
