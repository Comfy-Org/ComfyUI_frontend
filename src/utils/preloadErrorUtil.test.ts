import { describe, expect, it } from 'vitest'

import { parsePreloadError } from './preloadErrorUtil'

describe('parsePreloadError', () => {
  it('parses CSS preload error', () => {
    const error = new Error(
      'Unable to preload CSS for /assets/vendor-vue-core-abc123.css'
    )
    const result = parsePreloadError(error)

    expect(result.url).toBe('/assets/vendor-vue-core-abc123.css')
    expect(result.fileType).toBe('css')
    expect(result.chunkName).toBe('vendor-vue-core')
    expect(result.message).toBe(error.message)
  })

  it('parses dynamically imported module error', () => {
    const error = new Error(
      'Failed to fetch dynamically imported module: https://example.com/assets/vendor-three-def456.js'
    )
    const result = parsePreloadError(error)

    expect(result.url).toBe('https://example.com/assets/vendor-three-def456.js')
    expect(result.fileType).toBe('js')
    expect(result.chunkName).toBe('vendor-three')
  })

  it('extracts URL from generic error message', () => {
    const error = new Error(
      'Something went wrong loading https://cdn.example.com/assets/app-9f8e7d.js'
    )
    const result = parsePreloadError(error)

    expect(result.url).toBe('https://cdn.example.com/assets/app-9f8e7d.js')
    expect(result.fileType).toBe('js')
    expect(result.chunkName).toBe('app')
  })

  it('returns null url when no URL found', () => {
    const error = new Error('Something failed')
    const result = parsePreloadError(error)

    expect(result.url).toBeNull()
    expect(result.fileType).toBe('unknown')
    expect(result.chunkName).toBeNull()
  })

  it('detects font file types', () => {
    const error = new Error(
      'Unable to preload CSS for /assets/inter-abc123.woff2'
    )
    const result = parsePreloadError(error)

    expect(result.fileType).toBe('font')
  })

  it('detects image file types', () => {
    const error = new Error('Unable to preload CSS for /assets/logo-abc123.png')
    const result = parsePreloadError(error)

    expect(result.fileType).toBe('image')
  })

  it('handles mjs extension', () => {
    const error = new Error(
      'Failed to fetch dynamically imported module: /assets/chunk-abc123.mjs'
    )
    const result = parsePreloadError(error)

    expect(result.fileType).toBe('js')
  })

  it('handles URLs with query parameters', () => {
    const error = new Error(
      'Unable to preload CSS for /assets/style-abc123.css?v=2'
    )
    const result = parsePreloadError(error)

    expect(result.url).toBe('/assets/style-abc123.css?v=2')
    expect(result.fileType).toBe('css')
  })

  it('extracts chunk name from filename without hash', () => {
    const error = new Error(
      'Failed to fetch dynamically imported module: /assets/index.js'
    )
    const result = parsePreloadError(error)

    expect(result.chunkName).toBe('index')
  })
})
