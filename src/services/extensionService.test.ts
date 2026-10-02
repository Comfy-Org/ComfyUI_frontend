import { assert, beforeEach, describe, expect, it, vi } from 'vitest'

import { reportError } from '@/platform/telemetry/reportError'
import { api } from '@/scripts/api'

import type { ExtensionLoadFailure } from './extensionService'
import {
  importCustomExtension,
  reportExtensionLoadFailures,
  shouldLoadExtension,
  useExtensionService
} from './extensionService'

vi.mock(import('@/platform/telemetry/reportError'))

vi.mock(import('@/extensions/core/index'), () => ({}))

describe('shouldLoadExtension', () => {
  it.for(['/extensions/cloud/rum.js', '/extensions/cloud/sentry.js'])(
    'skips the inlined Cloud extension %s in cloud builds',
    (extension) => {
      expect(shouldLoadExtension(extension, true)).toBe(false)
    }
  )

  it.for(['/extensions/cloud/rum.js', '/extensions/cloud/sentry.js'])(
    'keeps the legacy path %s available outside cloud builds',
    (extension) => {
      expect(shouldLoadExtension(extension, false)).toBe(true)
    }
  )

  it('skips core extensions that load through the core entry point', () => {
    expect(shouldLoadExtension('/extensions/core/foo.js', false)).toBe(false)
  })

  it('loads other extensions', () => {
    expect(shouldLoadExtension('/extensions/comfyui-foo/main.js', true)).toBe(
      true
    )
  })
})

const BROKEN = '/extensions/comfyui-broken/main.js'

describe('importCustomExtension', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  it('returns the failing path and its error instead of throwing', async () => {
    const failure = await importCustomExtension(BROKEN)

    assert.exists(failure)
    expect(failure.ext).toBe(BROKEN)
    assert(failure.error instanceof Error)
    expect(failure.error.message).toContain(BROKEN)
  })

  it('does not report or log per extension', async () => {
    await importCustomExtension(BROKEN)

    expect(reportError).not.toHaveBeenCalled()
    expect(console.error).not.toHaveBeenCalled()
    expect(console.warn).not.toHaveBeenCalled()
  })
})

describe('reportExtensionLoadFailures', () => {
  const failureFor = (ext: string): ExtensionLoadFailure => ({
    ext,
    error: new Error(`Cannot find module '${ext}'`)
  })

  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  it('stays silent when nothing failed', () => {
    reportExtensionLoadFailures([])

    expect(reportError).not.toHaveBeenCalled()
  })

  it('reports a whole load as one typed error naming the failing packs', () => {
    const failures = [failureFor(BROKEN), failureFor('/extensions/b/b.js')]

    reportExtensionLoadFailures(failures)

    expect(reportError).toHaveBeenCalledOnce()
    const [cause, options] = vi.mocked(reportError).mock.calls[0]
    assert(cause instanceof Error)
    expect(cause.message).toBe(
      'Error loading 2 extensions: /extensions/comfyui-broken/main.js, /extensions/b/b.js'
    )
    expect(cause.cause).toBe(failures[0].error)
    expect(options).toMatchObject({
      errorType: 'extension_load_failed',
      surface: 'platform',
      level: 'warning',
      tags: { failed_extension_count: 2 }
    })
    expect(options.tags).toEqual({ failed_extension_count: 2 })
    expect(options.context?.failures).toEqual([
      { ext: BROKEN, message: `Cannot find module '${BROKEN}'` },
      {
        ext: '/extensions/b/b.js',
        message: "Cannot find module '/extensions/b/b.js'"
      }
    ])
  })

  it('elides the tail once past the naming cap', () => {
    const failures = Array.from({ length: 13 }, (_, i) =>
      failureFor(`/extensions/pack-${i}/main.js`)
    )

    reportExtensionLoadFailures(failures)

    const [cause, options] = vi.mocked(reportError).mock.calls[0]
    assert(cause instanceof Error)
    expect(cause.message).toContain('Error loading 13 extensions')
    expect(cause.message).toContain('(+3 more)')
    expect(cause.message).not.toContain('pack-10')
    expect(options.tags).toMatchObject({ failed_extension_count: 13 })
    expect(options.context?.failures).toHaveLength(10)
  })

  it('does not pair its own console line with the report', () => {
    reportExtensionLoadFailures([failureFor(BROKEN)])

    expect(console.error).not.toHaveBeenCalled()
    expect(console.warn).not.toHaveBeenCalled()
  })
})

describe('loadExtensions', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  it('reports every failing custom import as one aggregate', async () => {
    vi.spyOn(api, 'getExtensions').mockResolvedValue([
      '/extensions/pack-a/main.js',
      '/extensions/pack-b/main.js'
    ])

    await useExtensionService().loadExtensions()

    expect(reportError).toHaveBeenCalledOnce()
    const [cause, options] = vi.mocked(reportError).mock.calls[0]
    assert(cause instanceof Error)
    expect(cause.message).toBe(
      'Error loading 2 extensions: /extensions/pack-a/main.js, /extensions/pack-b/main.js'
    )
    expect(options.tags).toEqual({ failed_extension_count: 2 })
  })

  it('stays silent when every custom import resolves', async () => {
    vi.spyOn(api, 'getExtensions').mockResolvedValue([])

    await useExtensionService().loadExtensions()

    expect(reportError).not.toHaveBeenCalled()
  })

  it('skips the extensions the filter rejects instead of importing them', async () => {
    vi.spyOn(api, 'getExtensions').mockResolvedValue([
      '/extensions/core/foo.js',
      '/extensions/pack-a/main.js'
    ])

    await useExtensionService().loadExtensions()

    const [cause] = vi.mocked(reportError).mock.calls[0]
    assert(cause instanceof Error)
    expect(cause.message).toBe(
      'Error loading 1 extension: /extensions/pack-a/main.js'
    )
  })

  it('times the core and custom imports as separate subphases', async () => {
    const mark = vi.spyOn(performance, 'mark')
    vi.spyOn(api, 'getExtensions').mockResolvedValue([
      '/extensions/pack-a/main.js'
    ])

    await useExtensionService().loadExtensions()

    expect(mark.mock.calls.map(([name]) => name)).toEqual([
      'bootstrap/extensions-load-core:start',
      'bootstrap/extensions-load-core:end',
      'bootstrap/extensions-load-custom:start',
      'bootstrap/extensions-load-custom:end'
    ])
  })
})
