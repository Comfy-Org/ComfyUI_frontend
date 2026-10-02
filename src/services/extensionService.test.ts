import { beforeEach, describe, expect, it, vi } from 'vitest'

import { reportError } from '@/platform/telemetry/reportError'

import type { ExtensionLoadFailure } from './extensionService'
import {
  importCustomExtension,
  reportExtensionLoadFailures,
  shouldLoadExtension
} from './extensionService'

vi.mock(import('@/platform/telemetry/reportError'))

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
  it('returns the failing path and its error instead of throwing', async () => {
    const failure = await importCustomExtension(BROKEN)

    // The rejection is the real one from an unresolvable dynamic import, not a
    // stub, so this covers the actual catch rather than a simulated one.
    expect(failure).toBeDefined()
    expect(failure!.ext).toBe(BROKEN)
    expect(failure!.error).toBeInstanceOf(Error)
    expect((failure!.error as Error).message).toContain(BROKEN)
  })

  it('does not report per extension', async () => {
    // One systemic failure rejects the whole list at once, and off cloud each
    // report would occupy a slot in reportError's 25-entry pending buffer.
    await importCustomExtension(BROKEN)

    expect(reportError).not.toHaveBeenCalled()
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
    // The paths must be in the message, not only in tags: reportError's console
    // line prints the error and never options.tags, and on DEV and self-hosted
    // installs the console is the only live sink.
    expect((cause as Error).message).toBe(
      'Error loading 2 extension(s): /extensions/comfyui-broken/main.js, /extensions/b/b.js'
    )
    expect((cause as Error).cause).toBe(failures[0].error)
    expect(options).toMatchObject({
      errorType: 'extension_load_failed',
      surface: 'platform',
      level: 'warning',
      tags: { failed_extension_count: 2 }
    })
    // Only the count is tagged — the paths are backend-controlled and unbounded,
    // so they must not become an indexed facet.
    expect(options.tags).not.toHaveProperty('extension')
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
    expect((cause as Error).message).toContain('Error loading 13 extension(s)')
    expect((cause as Error).message).toContain('(+3 more)')
    expect((cause as Error).message).not.toContain('pack-10')
    expect(options.tags).toMatchObject({ failed_extension_count: 13 })
    expect(options.context?.failures).toHaveLength(10)
  })

  it('does not pair its own console line with the report', () => {
    // reportError writes the console record itself, so a second one here would
    // emit the same failure twice — once as an untyped console error.
    reportExtensionLoadFailures([failureFor(BROKEN)])

    expect(console.error).not.toHaveBeenCalled()
    expect(console.warn).not.toHaveBeenCalled()
  })
})
