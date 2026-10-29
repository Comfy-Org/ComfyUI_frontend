import { assert, describe, expect, it, vi } from 'vitest'

import { LGraphCanvas, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { CORE_SETTINGS } from '@/platform/settings/constants/coreSettings'
import { useSettingStore } from '@/platform/settings/settingStore'
import { EXTENSION_FAILURES_TRUNCATED_FIELD } from '@/platform/telemetry/extensionLoadTelemetry'
import { reportError } from '@comfyorg/telemetry/reportError'
import { api } from '@/scripts/api'
import { useExtensionStore } from '@/stores/extensionStore'

import type { ExtensionLoadFailure } from './extensionLoader'
import {
  isSafeExtensionBoot,
  loadExtensions,
  reportExtensionLoadFailures,
  shouldLoadExtension
} from './extensionLoader'

const coreLoad = vi.hoisted(() => ({
  onConfigure: undefined as unknown,
  processMouseDown: undefined as unknown,
  processMouseMove: undefined as unknown
}))

vi.mock(import('@/extensions/core/index'), () => ({
  registerCoreExtensions: async () => {
    const { LGraphCanvas, LGraphNode } =
      await import('@/lib/litegraph/src/litegraph')
    const { useExtensionStore } = await import('@/stores/extensionStore')
    coreLoad.onConfigure = LGraphNode.prototype.onConfigure
    coreLoad.processMouseDown = LGraphCanvas.prototype.processMouseDown
    coreLoad.processMouseMove = LGraphCanvas.prototype.processMouseMove
    useExtensionStore().registerExtension({ name: 'core.test' })
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

  it('leaves malformed extension entries to the isolated import failure path', () => {
    expect(
      shouldLoadExtension('http://', {
        isCloudBuild: false,
        disabledExtensionPaths: ['/extensions/agent-cushions/']
      })
    ).toBe(true)
  })

  it.for([
    { extension: '/extensions/agent-cushions/main.js', expected: false },
    {
      extension: '/extensions/agent-cushions/nested/panel.js',
      expected: false
    },
    { extension: '/extensions/agent-cushions-extra/main.js', expected: true }
  ])(
    'admits $extension as $expected with a disabled extension path',
    ({ extension, expected }) => {
      expect(
        shouldLoadExtension(extension, {
          isCloudBuild: false,
          disabledExtensionPaths: ['/extensions/agent-cushions/']
        })
      ).toBe(expected)
    }
  )

  it('skips every custom extension during a safe boot', () => {
    expect(
      shouldLoadExtension('/extensions/comfyui-foo/main.js', {
        isCloudBuild: false,
        disableAllCustomExtensions: true
      })
    ).toBe(false)
  })
})

describe('isSafeExtensionBoot', () => {
  it.for([
    { search: '?safe', expected: true },
    { search: '?safe=1', expected: true },
    { search: '?safe=true', expected: true },
    { search: '?safe=0', expected: false },
    { search: '?safe=false', expected: false },
    { search: '', expected: false }
  ])('reads $search as $expected', ({ search, expected }) => {
    expect(isSafeExtensionBoot(search)).toBe(expected)
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
    it('keeps custom modules inert while core extensions register in safe mode', async () => {
      const customExtensionLoaded = vi.fn()
      vi.stubGlobal('customExtensionLoaded', customExtensionLoaded)
      window.history.replaceState(null, '', '/?safe')
      useSettingStore().$patch({
        settingValues: {
          'Comfy.Extension.DisabledPacks': ['/extensions/pack-a/']
        }
      })
      vi.spyOn(api, 'getExtensions').mockResolvedValue([
        '/extensions/pack-a/main.js',
        '/extensions/pack-b/main.js'
      ])
      vi.spyOn(api, 'fileURL').mockReturnValue(
        'data:text/javascript,globalThis.customExtensionLoaded()'
      )

      await loadExtensions()

      expect(customExtensionLoaded).not.toHaveBeenCalled()
      expect(useExtensionStore().isCoreExtension('core.test')).toBe(true)
      expect(useExtensionStore().extensionPaths).toEqual([
        '/extensions/pack-a/',
        '/extensions/pack-b/'
      ])
    })

    it('falls back safely when persisted disabled extension paths are malformed', async () => {
      window.history.replaceState(null, '', '/?safe')
      const settingStore = useSettingStore()
      vi.mocked(fetch).mockResolvedValueOnce(
        Response.json({ 'Comfy.Extension.DisabledPacks': {} })
      )
      await settingStore.load()
      const disabledPathsSetting = CORE_SETTINGS.find(
        ({ id }) => id === 'Comfy.Extension.DisabledPacks'
      )
      assert(disabledPathsSetting)
      settingStore.addSetting(disabledPathsSetting)
      vi.spyOn(api, 'getExtensions').mockResolvedValue([
        '/extensions/pack-a/main.js'
      ])

      await loadExtensions()

      expect(useExtensionStore().isCoreExtension('core.test')).toBe(true)
      expect(reportError).toHaveBeenCalledOnce()
      expect(reportError).toHaveBeenCalledWith(expect.any(TypeError), {
        errorType: 'invalid_extension_path_setting',
        surface: 'platform',
        level: 'warning'
      })
    })

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
