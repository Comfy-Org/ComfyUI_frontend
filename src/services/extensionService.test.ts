import { assert, beforeEach, describe, expect, it, vi } from 'vitest'

import { reportError } from '@/platform/telemetry/reportError'
import { app } from '@/scripts/app'
import { api } from '@/scripts/api'
import { useExtensionStore } from '@/stores/extensionStore'

import type { ExtensionLoadFailure } from './extensionService'
import {
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

describe('extension loading', () => {
  const failureFor = (ext: string): ExtensionLoadFailure => ({
    ext,
    error: new Error(`Cannot find module '${ext}'`)
  })

  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  describe('reportExtensionLoadFailures', () => {
    it('stays silent when nothing failed', () => {
      reportExtensionLoadFailures([])

      expect(reportError).not.toHaveBeenCalled()
    })

    it('reports a whole load as one typed aggregate error', () => {
      const failures = [failureFor(BROKEN), failureFor('/extensions/b/b.js')]

      reportExtensionLoadFailures(failures)

      expect(reportError).toHaveBeenCalledOnce()
      const [cause, options] = vi.mocked(reportError).mock.calls[0]
      assert(cause instanceof AggregateError)
      expect(cause.message).toBe('Error loading 2 extensions')
      expect(cause.errors).toEqual(failures.map(({ error }) => error))
      expect(options).toMatchObject({
        errorType: 'error_loading_extension',
        level: 'warning'
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

    it('keeps every failure in context', () => {
      const failures = Array.from({ length: 13 }, (_, i) =>
        failureFor(`/extensions/pack-${i}/main.js`)
      )

      reportExtensionLoadFailures(failures)

      const [cause, options] = vi.mocked(reportError).mock.calls[0]
      assert(cause instanceof AggregateError)
      expect(cause.message).toBe('Error loading 13 extensions')
      expect(cause.errors).toHaveLength(13)
      expect(options.tags).toMatchObject({ failed_extension_count: 13 })
      expect(options.context?.failures).toHaveLength(13)
    })

    it('normalizes non-Error and hostile thrown values safely', () => {
      const hostile = new Proxy(
        {},
        {
          get() {
            throw new Error('unreadable')
          },
          ownKeys() {
            throw new Error('unreadable')
          }
        }
      )

      expect(() =>
        reportExtensionLoadFailures([
          { ext: '/extensions/number.js', error: 42 },
          { ext: '/extensions/hostile.js', error: hostile }
        ])
      ).not.toThrow()

      const [cause, options] = vi.mocked(reportError).mock.calls[0]
      assert(cause instanceof AggregateError)
      expect(cause.errors.map((error) => error.message)).toEqual([
        '42',
        'Unknown extension load failure'
      ])
      expect(options.context?.failures).toEqual([
        { ext: '/extensions/number.js', message: '42' },
        {
          ext: '/extensions/hostile.js',
          message: 'Unknown extension load failure'
        }
      ])
    })

    it('does not pair its own console line with the report', () => {
      reportExtensionLoadFailures([failureFor(BROKEN)])

      expect(console.error).not.toHaveBeenCalled()
      expect(console.warn).not.toHaveBeenCalled()
    })
  })

  describe('loadExtensions', () => {
    it('reports every failing custom import as one aggregate', async () => {
      vi.spyOn(api, 'getExtensions').mockResolvedValue([
        '/extensions/pack-a/main.js',
        '/extensions/pack-b/main.js'
      ])

      await useExtensionService().loadExtensions()

      expect(reportError).toHaveBeenCalledOnce()
      const [cause, options] = vi.mocked(reportError).mock.calls[0]
      assert(cause instanceof Error)
      expect(cause.message).toBe('Error loading 2 extensions')
      expect(options.tags).toEqual({ failed_extension_count: 2 })
      expect(console.error).not.toHaveBeenCalled()
    })

    it('stays silent when no custom extensions are listed', async () => {
      vi.spyOn(api, 'getExtensions').mockResolvedValue([])

      await useExtensionService().loadExtensions()

      expect(reportError).not.toHaveBeenCalled()
    })

    it('skips core extensions', async () => {
      vi.spyOn(api, 'getExtensions').mockResolvedValue([
        '/extensions/core/foo.js',
        '/extensions/pack-a/main.js'
      ])

      await useExtensionService().loadExtensions()

      const [cause] = vi.mocked(reportError).mock.calls[0]
      assert(cause instanceof Error)
      expect(cause.message).toBe('Error loading 1 extension')
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
})

describe('graph-load extension hooks', () => {
  type HookApp = typeof app

  function register(extension: { name: string; [key: string]: unknown }) {
    useExtensionStore().registerExtension(extension)
  }

  it.for([
    {
      entrypoint: 'loadGraphData',
      call: (hookApp: HookApp) => hookApp.loadGraphData()
    },
    {
      entrypoint: 'loadApiJson',
      call: (hookApp: HookApp) => hookApp.loadApiJson({}, 'nested.json')
    },
    {
      entrypoint: 'handleFile',
      call: (hookApp: HookApp) => hookApp.handleFile(new File([], 'nested.png'))
    }
  ])(
    'rejects $entrypoint started after an await in a graph-load hook',
    async ({ call }) => {
      let nested: Promise<unknown> | undefined
      register({
        name: 'nested-loader',
        beforeLoadGraph: async (hookApp: HookApp) => {
          await Promise.resolve()
          nested = call(hookApp)
          await nested.catch(() => {})
        }
      })

      await useExtensionService().invokeExtensionsAsync('beforeLoadGraph')

      await expect(nested).rejects.toThrow(
        'A graph-load lifecycle hook cannot start a nested graph load'
      )
    }
  )

  it('lets a retained hook app load once the hook dispatch has finished', async () => {
    let retained: HookApp | undefined
    register({
      name: 'retaining-extension',
      afterLoadGraph: (hookApp: HookApp) => {
        retained = hookApp
      }
    })
    await useExtensionService().invokeExtensionsAsync('afterLoadGraph')
    const handleFile = vi.spyOn(app, 'handleFile').mockResolvedValue(undefined)
    const file = new File([], 'later.png')

    await retained?.handleFile(file)

    expect(handleFile).toHaveBeenCalledWith(file)
  })
})
