import { describe, expect, it } from 'vitest'

import { previewCompressionParams } from './previewCompressionParams'

describe('previewCompressionParams', () => {
  it('returns no params when compression is disabled and no preview format is set', () => {
    expect(
      previewCompressionParams({
        compressionEnabled: false,
        previewFormat: '',
        maxSize: 4096
      })
    ).toBe('')
  })

  it('keeps the global preview format when compression is disabled', () => {
    expect(
      previewCompressionParams({
        compressionEnabled: false,
        previewFormat: 'jpeg;80',
        maxSize: 4096
      })
    ).toBe('&preview=jpeg;80')
  })

  it('adds max_size and a default format when compression is enabled', () => {
    expect(
      previewCompressionParams({
        compressionEnabled: true,
        previewFormat: '',
        maxSize: 4096
      })
    ).toBe('&preview=webp;90&max_size=4096')
  })

  it('respects the global preview format when compression is enabled', () => {
    expect(
      previewCompressionParams({
        compressionEnabled: true,
        previewFormat: 'jpeg;80',
        maxSize: 2048
      })
    ).toBe('&preview=jpeg;80&max_size=2048')
  })

  it('clamps out-of-range max sizes into the 512-8192 range', () => {
    expect(
      previewCompressionParams({
        compressionEnabled: true,
        previewFormat: '',
        maxSize: 0
      })
    ).toBe('&preview=webp;90&max_size=512')
    expect(
      previewCompressionParams({
        compressionEnabled: true,
        previewFormat: '',
        maxSize: 100000
      })
    ).toBe('&preview=webp;90&max_size=8192')
  })

  it('rounds fractional max sizes to an integer', () => {
    expect(
      previewCompressionParams({
        compressionEnabled: true,
        previewFormat: '',
        maxSize: 1536.4
      })
    ).toBe('&preview=webp;90&max_size=1536')
  })
})
