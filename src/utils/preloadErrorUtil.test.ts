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

  it.for(['http://host:99999', 'https://['])(
    'keeps malformed URL details without throwing for %s',
    (url) => {
      const message = `Unable to contact ${url}`
      expect(parsePreloadError(new Error(message))).toEqual({
        kind: 'unknown',
        url,
        fileType: 'unknown',
        chunkName: null,
        message
      })
    }
  )

  it.for([
    'Importing a module script failed.',
    'error loading dynamically imported module',
    'Failed to fetch dynamically imported module'
  ])('recognizes a dynamic import failure without a URL: %s', (message) => {
    expect(parsePreloadError(new TypeError(message))).toMatchObject({
      kind: 'dynamic_import',
      url: null,
      fileType: 'unknown'
    })
  })

  it('does not classify an arbitrary CSS URL as a Vite CSS preload failure', () => {
    expect(
      parsePreloadError(
        new Error('Module failed while using https://example.com/app.css')
      )
    ).toMatchObject({ kind: 'unknown', fileType: 'css' })
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
