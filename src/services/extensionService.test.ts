import { assert, beforeEach, describe, expect, it, vi } from 'vitest'

import { EXTENSION_FAILURES_TRUNCATED_FIELD } from '@/platform/telemetry/extensionLoadTelemetry'
import { reportError } from '@/platform/telemetry/reportError'
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

    it('reports a whole load as one typed error naming the failing packs', () => {
      const firstError = new Error(`Cannot find module '${BROKEN}'`)
      const secondError = new Error("Cannot find module '/extensions/b/b.js'")
      const failures = [
        { ext: BROKEN, error: firstError },
        { ext: '/extensions/b/b.js', error: secondError }
      ]

      reportExtensionLoadFailures(failures)

      expect(reportError).toHaveBeenCalledOnce()
      const [cause, options] = vi.mocked(reportError).mock.calls[0]
      assert(cause instanceof AggregateError)
      expect(cause.message).toBe('Error loading extensions')
      expect(cause.stack).toContain(
        `Failed extensions: ${BROKEN}, /extensions/b/b.js`
      )
      expect(options).toMatchObject({
        errorType: 'error_loading_extension',
        surface: 'platform',
        level: 'warning'
      })
      expect(options.tags).toEqual({ failed_extension_count: 2 })
      expect(options.context).toEqual({
        failures: [
          {
            ext: BROKEN,
            message: `Cannot find module '${BROKEN}'`,
            stack: expect.stringContaining(`Cannot find module '${BROKEN}'`)
          },
          {
            ext: '/extensions/b/b.js',
            message: "Cannot find module '/extensions/b/b.js'",
            stack: expect.stringContaining(
              "Cannot find module '/extensions/b/b.js'"
            )
          }
        ]
      })
    })

    it('keeps a batch at the cap untruncated', () => {
      reportExtensionLoadFailures(
        Array.from({ length: 10 }, (_, i) =>
          failureFor(`/extensions/pack-${i}/main.js`)
        )
      )

      expect(
        vi.mocked(reportError).mock.calls[0][1].context
      ).not.toHaveProperty(EXTENSION_FAILURES_TRUNCATED_FIELD)
    })

    it('elides the tail once past the naming cap', () => {
      const failures = Array.from({ length: 13 }, (_, i) =>
        failureFor(`/extensions/pack-${i}/main.js`)
      )

      reportExtensionLoadFailures(failures)

      const [cause, options] = vi.mocked(reportError).mock.calls[0]
      assert(cause instanceof AggregateError)
      expect(cause.message).toBe('Error loading extensions')
      expect(cause.errors).toHaveLength(10)
      expect(cause.stack).not.toContain('/extensions/pack-10/main.js')
      expect(options.tags).toMatchObject({ failed_extension_count: 13 })
      expect(options.context?.failures).toHaveLength(10)
      expect(options.context?.[EXTENSION_FAILURES_TRUNCATED_FIELD]).toBe(true)
    })

    it('caps each failure path, message, and stack', () => {
      const error = new Error('m'.repeat(5000))
      error.stack = 's'.repeat(5000)

      reportExtensionLoadFailures([
        { ext: `/extensions/comfyui-foo/${'a'.repeat(600)}.js`, error }
      ])

      expect(vi.mocked(reportError).mock.calls[0][1].context?.failures).toEqual(
        [
          {
            ext: `/extensions/comfyui-foo/${'a'.repeat(488)}`,
            message: 'm'.repeat(2048),
            stack: 's'.repeat(2048)
          }
        ]
      )
    })

    it.for([
      {
        name: 'an unserializable non-Error value',
        error: Object.create(null, {
          toJSON: {
            value: () => {
              throw new Error('serialization failed')
            }
          }
        })
      },
      {
        name: 'an Error whose message and stack getters throw',
        error: Object.defineProperties(new Error('unused'), {
          message: {
            get: () => {
              throw new Error('message getter failed')
            }
          },
          stack: {
            get: () => {
              throw new Error('stack getter failed')
            }
          }
        })
      },
      {
        name: 'a revoked proxy',
        error: (() => {
          const { proxy, revoke } = Proxy.revocable({}, {})
          revoke()
          return proxy
        })()
      }
    ])('reports $name as an unknown load failure', ({ error }) => {
      reportExtensionLoadFailures([{ ext: BROKEN, error }])

      expect(vi.mocked(reportError).mock.calls[0][1].context?.failures).toEqual(
        [
          {
            ext: BROKEN,
            message: 'Unknown extension load failure',
            stack: undefined
          }
        ]
      )
    })

    it('records a stack only when the rejection is an Error', () => {
      reportExtensionLoadFailures([
        {
          ext: BROKEN,
          error: {
            message: 'thrown object',
            stack: 'at run (/extensions/comfyui-other/main.js:1:1)'
          }
        }
      ])

      expect(vi.mocked(reportError).mock.calls[0][1].context?.failures).toEqual(
        [{ ext: BROKEN, message: 'thrown object', stack: undefined }]
      )
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
      assert(cause instanceof AggregateError)
      expect(cause.message).toBe('Error loading extensions')
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
      assert(cause instanceof AggregateError)
      expect(cause.message).toBe('Error loading extensions')
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

  describe('invokeExtensionsAsync', () => {
    const hook = 'init'

    function createCallableThenable(
      error: Error
    ): (() => void) & Promise<void> {
      const callable = () => undefined
      const rejected = Promise.reject<void>(error)
      Reflect.defineProperty(callable, 'then', {
        value: rejected.then.bind(rejected)
      })
      Reflect.defineProperty(callable, 'catch', {
        value: rejected.catch.bind(rejected)
      })
      Reflect.defineProperty(callable, 'finally', {
        value: rejected.finally.bind(rejected)
      })
      Reflect.defineProperty(callable, Symbol.toStringTag, { value: 'Promise' })
      return callable as typeof callable & Promise<void>
    }

    it('skips extensions without the hook and preserves registration order', async () => {
      const calls: string[] = []
      const store = useExtensionStore()
      store.registerExtension({
        name: 'a',
        [hook]: () => {
          calls.push('a')
        }
      })
      store.registerExtension({ name: 'none' })
      store.registerExtension({
        name: 'b',
        [hook]: () => {
          calls.push('b')
        }
      })

      await useExtensionService().invokeExtensionsAsync(hook)

      expect(calls).toEqual(['a', 'b'])
    })

    it('invokes sync hooks before awaiting async hooks', async () => {
      const calls: string[] = []
      const store = useExtensionStore()
      store.registerExtension({
        name: 'sync',
        [hook]: () => {
          calls.push('sync')
        }
      })
      store.registerExtension({
        name: 'async',
        [hook]: async () => {
          calls.push('async')
        }
      })

      const pending = useExtensionService().invokeExtensionsAsync(hook)
      expect(calls).toEqual(['sync', 'async'])
      await expect(pending).resolves.toBeUndefined()
    })

    it('isolates a throwing hook and continues with later extensions', async () => {
      const after = vi.fn()
      const store = useExtensionStore()
      store.registerExtension({
        name: 'throws',
        [hook]: () => {
          throw new Error('boom')
        }
      })
      store.registerExtension({ name: 'after', [hook]: after })

      await useExtensionService().invokeExtensionsAsync(hook)

      expect(after).toHaveBeenCalledOnce()
      expect(console.error).toHaveBeenCalledOnce()
    })

    it('isolates a rejection from a callable thenable', async () => {
      const error = new Error('boom')
      const callableThenable = createCallableThenable(error)
      const after = vi.fn()
      const store = useExtensionStore()
      store.registerExtension({
        name: 'rejects',
        [hook]: () => callableThenable
      })
      store.registerExtension({ name: 'after', [hook]: after })

      await useExtensionService().invokeExtensionsAsync(hook)

      expect(after).toHaveBeenCalledOnce()
      expect(console.error).toHaveBeenCalledOnce()
    })
  })
})
