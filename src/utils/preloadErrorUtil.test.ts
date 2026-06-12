import { describe, expect, it } from 'vitest'

import {
  isExtensionOriginPreloadError,
  parsePreloadError
} from './preloadErrorUtil'

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

describe('isExtensionOriginPreloadError', () => {
  function makeError(message: string, stack?: string): Error {
    const error = new Error(message)
    error.stack = stack ?? `Error: ${message}`
    return error
  }

  it('detects a failed fetch of an extension module by URL', () => {
    const error = makeError(
      'Failed to fetch dynamically imported module: https://example.com/extensions/SomePack/js/widgets.js'
    )
    const info = parsePreloadError(error)

    expect(isExtensionOriginPreloadError(error, info)).toBe(true)
  })

  it('detects a relative extension URL', () => {
    const error = makeError(
      'Failed to fetch dynamically imported module: /extensions/SomePack/widgets.js'
    )
    const info = parsePreloadError(error)

    expect(isExtensionOriginPreloadError(error, info)).toBe(true)
  })

  it('detects an evaluation error thrown inside an extension module via the stack', () => {
    const error = makeError(
      "Cannot read properties of undefined (reading 'SomeExport')",
      [
        "TypeError: Cannot read properties of undefined (reading 'SomeExport')",
        '    at https://example.com/extensions/core/clipspace.js:3:55'
      ].join('\n')
    )
    const info = parsePreloadError(error)

    expect(info.url).toBeNull()
    expect(isExtensionOriginPreloadError(error, info)).toBe(true)
  })

  it('does not flag first-party chunk fetch failures', () => {
    const error = makeError(
      'Failed to fetch dynamically imported module: https://example.com/assets/vendor-three-def456.js'
    )
    const info = parsePreloadError(error)

    expect(isExtensionOriginPreloadError(error, info)).toBe(false)
  })

  it('does not flag evaluation errors with first-party stacks', () => {
    const error = makeError(
      'Some chunk evaluation failure',
      [
        'Error: Some chunk evaluation failure',
        '    at https://example.com/assets/index-abc123.js:1:100'
      ].join('\n')
    )
    const info = parsePreloadError(error)

    expect(isExtensionOriginPreloadError(error, info)).toBe(false)
  })

  it('does not flag dev-server source paths under /src/extensions/', () => {
    const error = makeError(
      'Some dev evaluation failure',
      [
        'Error: Some dev evaluation failure',
        '    at http://localhost:5173/src/extensions/core/clipspace.ts:3:55'
      ].join('\n')
    )
    const info = parsePreloadError(error)

    expect(isExtensionOriginPreloadError(error, info)).toBe(false)
  })

  it('does not flag errors without url or stack URLs', () => {
    const error = makeError('Something failed')
    const info = parsePreloadError(error)

    expect(isExtensionOriginPreloadError(error, info)).toBe(false)
  })

  it('does not flag errors with no stack at all', () => {
    const error = makeError('Something failed')
    error.stack = undefined
    const info = parsePreloadError(error)

    expect(isExtensionOriginPreloadError(error, info)).toBe(false)
  })

  it('ignores unparseable URLs in the stack', () => {
    const error = makeError(
      'Some failure',
      [
        'Error: Some failure',
        '    at https://[invalid/extensions/SomePack/widgets.js:1:1'
      ].join('\n')
    )
    const info = parsePreloadError(error)

    expect(isExtensionOriginPreloadError(error, info)).toBe(false)
  })
})
