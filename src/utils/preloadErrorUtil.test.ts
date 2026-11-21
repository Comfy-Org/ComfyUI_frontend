import { describe, expect, it } from 'vitest'

import { isAppChunkLoadFailure, parsePreloadError } from './preloadErrorUtil'

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

  it("parses Firefox's dynamic import failure message", () => {
    const error = new TypeError(
      'error loading dynamically imported module: https://cloud.comfy.org/assets/cloudRemoteConfig-CiQjAbK-.js'
    )
    const result = parsePreloadError(error)

    expect(result.url).toBe(
      'https://cloud.comfy.org/assets/cloudRemoteConfig-CiQjAbK-.js'
    )
    expect(result.fileType).toBe('js')
    expect(isAppChunkLoadFailure(result, 'https://cloud.comfy.org/')).toBe(true)
  })

  it('does not throw when Firefox dispatches the event without an error', () => {
    const result = parsePreloadError(undefined)

    expect(result).toEqual({
      url: null,
      fileType: 'unknown',
      chunkName: null,
      message: 'undefined'
    })
  })

  it('does not throw on a payload that cannot be converted to a string', () => {
    const result = parsePreloadError(Object.create(null))

    expect(result.url).toBeNull()
    expect(result.message).toBe('Unprintable preload error payload')
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

describe('isAppChunkLoadFailure', () => {
  const page = 'https://cloud.comfy.org/'
  const check = (message: string, pageUrl = page) =>
    isAppChunkLoadFailure(parsePreloadError(new Error(message)), pageUrl)

  it.for([
    'Failed to fetch dynamically imported module: https://cloud.comfy.org/assets/agentPanel-B_g1kPe0.js',
    'error loading dynamically imported module: https://cloud.comfy.org/assets/load3d-UgKt02cX.js',
    'Failed to fetch dynamically imported module: /assets/cloudBadges-DTaCAACw.js'
  ])('is true for our own JS chunk: %s', (message) => {
    expect(check(message)).toBe(true)
  })

  it('is true for a chunk served under a sub-path with a relative base', () => {
    expect(
      check(
        'Failed to fetch dynamically imported module: http://127.0.0.1:8188/comfy/assets/load3d-abc123.js',
        'http://127.0.0.1:8188/comfy/'
      )
    ).toBe(true)
  })

  it.for([
    'Unable to preload CSS for /assets/vendor-vue-core-abc123.css',
    'Failed to fetch dynamically imported module: https://cloud.comfy.org/extensions/sam3/assets/editor.js',
    'Failed to fetch dynamically imported module: https://cloud.comfy.org/extensions/core/clipspace.js',
    'Failed to fetch dynamically imported module: https://cdn.example.com/assets/vendor-three-def456.js',
    'Importing a module script failed.'
  ])(
    'is false for a CSS dependency, a custom node script, another origin or no URL: %s',
    (message) => {
      expect(check(message)).toBe(false)
    }
  )
})
