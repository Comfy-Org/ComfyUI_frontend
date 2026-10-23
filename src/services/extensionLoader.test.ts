import { assert, describe, expect, it, vi } from 'vitest'

import { LGraphCanvas, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { EXTENSION_FAILURES_TRUNCATED_FIELD } from '@/platform/telemetry/extensionLoadTelemetry'
import { reportError } from '@/platform/telemetry/reportError'
import { api } from '@/scripts/api'

import type { ExtensionLoadFailure } from './extensionLoader'
import {
  loadExtensions,
  reportExtensionLoadFailures,
  shouldLoadExtension
} from './extensionLoader'

vi.mock(import('@/platform/telemetry/reportError'))

const coreLoad = vi.hoisted(() => ({
  onConfigure: undefined as unknown,
  processMouseDown: undefined as unknown,
  processMouseMove: undefined as unknown
}))

vi.mock(import('@/extensions/core/index'), () => ({
  registerCoreExtensions: async () => {
    const { LGraphCanvas, LGraphNode } =
      await import('@/lib/litegraph/src/litegraph')
    coreLoad.onConfigure = LGraphNode.prototype.onConfigure
    coreLoad.processMouseDown = LGraphCanvas.prototype.processMouseDown
    coreLoad.processMouseMove = LGraphCanvas.prototype.processMouseMove
  }
}))

const beforeLoad = {
  onConfigure: LGraphNode.prototype.onConfigure,
  processMouseDown: LGraphCanvas.prototype.processMouseDown,
  processMouseMove: LGraphCanvas.prototype.processMouseMove
}

describe('shouldLoadExtension', () => {
  it.for(['/extensions/cloud/rum.js', '/extensions/cloud/sentry.js'])(
    'skips the inlined Cloud extension %s in cloud builds',
    (extension) => {
      expect(shouldLoadExtension(extension, { isCloudBuild: true })).toBe(false)
    }
  )

  it.for(['/extensions/cloud/rum.js', '/extensions/cloud/sentry.js'])(
    'keeps the legacy path %s available outside cloud builds',
    (extension) => {
      expect(shouldLoadExtension(extension, { isCloudBuild: false })).toBe(true)
    }
  )

  it('skips core extensions that load through the core entry point', () => {
    expect(
      shouldLoadExtension('/extensions/core/foo.js', { isCloudBuild: false })
    ).toBe(false)
  })

  it('loads other extensions', () => {
    expect(
      shouldLoadExtension('/extensions/comfyui-foo/main.js', {
        isCloudBuild: true
      })
    ).toBe(true)
  })

  it('skips every module from a disabled pack without prefix-matching peers', () => {
    const disabled = ['/extensions/agent-cushions/']

    expect(
      shouldLoadExtension('/extensions/agent-cushions/main.js', {
        isCloudBuild: false,
        disabledPackPaths: disabled
      })
    ).toBe(false)
    expect(
      shouldLoadExtension('/extensions/agent-cushions/nested/panel.js', {
        isCloudBuild: false,
        disabledPackPaths: disabled
      })
    ).toBe(false)
    expect(
      shouldLoadExtension('/extensions/agent-cushions-extra/main.js', {
        isCloudBuild: false,
        disabledPackPaths: disabled
      })
    ).toBe(true)
  })

  it('skips every custom extension during a safe boot', () => {
    expect(
      shouldLoadExtension('/extensions/comfyui-foo/main.js', {
        isCloudBuild: false,
        disableAllCustomExtensions: true
      })
    ).toBe(false)
  })
})

const BROKEN = '/extensions/comfyui-broken/main.js'

describe('extension loading', () => {
  const failureFor = (ext: string): ExtensionLoadFailure => ({
    ext,
    error: new Error(`Cannot find module '${ext}'`)
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

      await loadExtensions()

      expect(reportError).toHaveBeenCalledOnce()
      const [cause, options] = vi.mocked(reportError).mock.calls[0]
      assert(cause instanceof AggregateError)
      expect(cause.message).toBe('Error loading extensions')
      expect(options.tags).toEqual({ failed_extension_count: 2 })
      expect(console.error).not.toHaveBeenCalled()
    })

    it('stays silent when no custom extensions are listed', async () => {
      vi.spyOn(api, 'getExtensions').mockResolvedValue([])

      await loadExtensions()

      expect(reportError).not.toHaveBeenCalled()
    })

    it('skips core extensions', async () => {
      vi.spyOn(api, 'getExtensions').mockResolvedValue([
        '/extensions/core/foo.js',
        '/extensions/pack-a/main.js'
      ])

      await loadExtensions()

      const [cause] = vi.mocked(reportError).mock.calls[0]
      assert(cause instanceof AggregateError)
      expect(cause.message).toBe('Error loading extensions')
    })

    it('installs the node and canvas prototype patches before core extensions register', async () => {
      vi.spyOn(api, 'getExtensions').mockResolvedValue([])

      await loadExtensions()

      const installed = {
        onConfigure: LGraphNode.prototype.onConfigure,
        processMouseDown: LGraphCanvas.prototype.processMouseDown,
        processMouseMove: LGraphCanvas.prototype.processMouseMove
      }
      expect(coreLoad).toEqual(installed)
      expect(installed.onConfigure).not.toBe(beforeLoad.onConfigure)
      expect(installed.processMouseDown).not.toBe(beforeLoad.processMouseDown)
      expect(installed.processMouseMove).not.toBe(beforeLoad.processMouseMove)
    })

    it('times the core and custom imports as separate subphases', async () => {
      const mark = vi.spyOn(performance, 'mark')
      vi.spyOn(api, 'getExtensions').mockResolvedValue([
        '/extensions/pack-a/main.js'
      ])

      await loadExtensions()

      expect(mark.mock.calls.map(([name]) => name)).toEqual([
        'bootstrap/extensions-load-core:start',
        'bootstrap/extensions-load-core:end',
        'bootstrap/extensions-load-custom:start',
        'bootstrap/extensions-load-custom:end'
      ])
    })
  })
})
