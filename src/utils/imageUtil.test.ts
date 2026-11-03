import { describe, expect, it } from 'vitest'

import { getGridThumbnailUrl, parseImageWidgetValue } from './imageUtil'

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

  it.for([
    {
      raw: 'scenes\\sky.png [output]',
      filename: 'sky.png',
      subfolder: 'scenes',
      type: 'output'
    },
    {
      raw: 'a\\b/sky.png',
      filename: 'sky.png',
      subfolder: 'a/b',
      type: 'input'
    },
    {
      raw: 'pasted/12:30.png',
      filename: '12:30.png',
      subfolder: 'pasted',
      type: 'input'
    },
    {
      raw: '12:30/out.png [output]',
      filename: 'out.png',
      subfolder: '12:30',
      type: 'output'
    },
    {
      raw: 'scenes//sky.png [output]',
      filename: 'sky.png',
      subfolder: 'scenes/',
      type: 'output'
    },
    {
      raw: '/sky.png [output]',
      filename: 'sky.png',
      subfolder: '',
      type: 'output'
    },
    {
      raw: 'scenes/sky.png/ [output]',
      filename: '',
      subfolder: 'scenes/sky.png',
      type: 'output'
    },
    {
      raw: 'scenes/../sky.png [temp]',
      filename: 'sky.png',
      subfolder: 'scenes/..',
      type: 'temp'
    },
    {
      raw: 'D:\\sky.png [output]',
      filename: 'sky.png',
      subfolder: 'D:',
      type: 'output'
    }
  ])(
    'splits $raw into subfolder "$subfolder" and filename "$filename"',
    ({ raw, ...expected }) => {
      expect(parseImageWidgetValue(raw)).toEqual(expected)
    }
  )
})
