import { describe, expect, it } from 'vitest'

import { parseImageWidgetValue } from './imageUtil'

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
