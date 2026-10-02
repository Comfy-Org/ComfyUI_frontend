import { assert, beforeEach, describe, expect, it, vi } from 'vitest'

import { bootstrapTracer } from '@/platform/telemetry/perf/bootstrapTracer'
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

// The loader-level cases below need `loadExtensions` to run end to end, which
// takes exactly two stubs. The core extension entry point is one: importing it
// pulls in the whole core extension tree, and that is what kept this path
// untested and left the wiring between the import and the report unpinned.
vi.mock(import('@/extensions/core/index'), () => ({}))

// `api.getExtensions` is the other, stubbed per case on the real module rather
// than by mocking it — mocking `@/scripts/api` breaks `@/scripts/app`, which
// this service imports and which registers api listeners while it is still
// being evaluated. `fileURL` therefore stays real too, so the custom imports
// below reject on a path with no module behind it exactly as the standalone
// cases do. The stores come from the global testing Pinia.

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

    // The rejection is the real one from an unresolvable dynamic import, not a
    // stub, so this covers the actual catch rather than a simulated one.
    assert.exists(failure)
    expect(failure.ext).toBe(BROKEN)
    assert(failure.error instanceof Error)
    expect(failure.error.message).toContain(BROKEN)
  })

  it('does not report or log per extension', async () => {
    // One systemic failure rejects the whole list at once, and off cloud each
    // report would occupy a slot in reportError's 25-entry pending buffer.
    await importCustomExtension(BROKEN)

    expect(reportError).not.toHaveBeenCalled()
    // The console line this catch used to write is what the batch report
    // replaced. Asserting its absence here, and not only on the batch, is what
    // stops the duplicate emission coming back where it actually lived.
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
    // The paths must be in the message, not only in tags: reportError's console
    // line prints the error and never options.tags, and on DEV and self-hosted
    // installs the console is the only live sink.
    expect(cause.message).toBe(
      'Error loading 2 extension(s): /extensions/comfyui-broken/main.js, /extensions/b/b.js'
    )
    expect(cause.cause).toBe(failures[0].error)
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
    assert(cause instanceof Error)
    expect(cause.message).toContain('Error loading 13 extension(s)')
    expect(cause.message).toContain('(+3 more)')
    expect(cause.message).not.toContain('pack-10')
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

describe('loadExtensions', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  it('reports every failing custom import as one aggregate', async () => {
    // The pieces are covered above in isolation, which leaves the wiring
    // between them unpinned: dropping the reportExtensionLoadFailures call, or
    // passing it the wrong half of the outcomes, loses every failure silently
    // and no assertion above notices.
    vi.spyOn(api, 'getExtensions').mockResolvedValue([
      '/extensions/pack-a/main.js',
      '/extensions/pack-b/main.js'
    ])

    await useExtensionService().loadExtensions()

    expect(reportError).toHaveBeenCalledOnce()
    const [cause, options] = vi.mocked(reportError).mock.calls[0]
    assert(cause instanceof Error)
    expect(cause.message).toBe(
      'Error loading 2 extension(s): /extensions/pack-a/main.js, /extensions/pack-b/main.js'
    )
    expect(options.tags).toMatchObject({ failed_extension_count: 2 })
  })

  it('stays silent when every custom import resolves', async () => {
    // Nothing the backend lists resolves in this environment, so an empty list
    // is what proves the report is driven by failures rather than emitted on
    // every load.
    vi.spyOn(api, 'getExtensions').mockResolvedValue([])

    await useExtensionService().loadExtensions()

    expect(reportError).not.toHaveBeenCalled()
  })

  it('skips the extensions the filter rejects instead of importing them', async () => {
    // `shouldLoadExtension` is covered in isolation above, which leaves the
    // same wiring gap the reporting call had: deleting the `.filter(...)` from
    // `loadExtensions` keeps every standalone case green. A core path is the
    // lever because that branch of the filter does not depend on the build —
    // `__DISTRIBUTION__` is `localhost` under vitest, so the cloud-inlined
    // branch cannot be reached from here. Importing a core extension twice is
    // the bug the skip exists to prevent: they already arrive through the core
    // entry point.
    vi.spyOn(api, 'getExtensions').mockResolvedValue([
      '/extensions/core/foo.js',
      '/extensions/pack-a/main.js'
    ])

    await useExtensionService().loadExtensions()

    const [cause] = vi.mocked(reportError).mock.calls[0]
    assert(cause instanceof Error)
    // One failure, not two: the core path was never imported, so it never
    // reached the report.
    expect(cause.message).toBe(
      'Error loading 1 extension(s): /extensions/pack-a/main.js'
    )
  })

  it('times the core and custom imports as separate subphases', async () => {
    // Keeps the instrumentation itself under test: bootstrapTracer.test.ts
    // pins how the tracer nests spans, but nothing pinned that this loader is
    // the thing that opens these two.
    const settle = vi.spyOn(bootstrapTracer, 'settle')
    vi.spyOn(api, 'getExtensions').mockResolvedValue([
      '/extensions/pack-a/main.js'
    ])

    await useExtensionService().loadExtensions()

    expect(settle.mock.calls.map(([phase]) => phase)).toEqual([
      'bootstrap/extensions-load-core',
      'bootstrap/extensions-load-custom'
    ])
  })
})
