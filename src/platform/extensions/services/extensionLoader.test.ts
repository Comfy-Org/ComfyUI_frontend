import { assert, describe, expect, it, vi } from 'vitest'

import { LGraphCanvas, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useExtensionStore } from '@/platform/extensions/stores/extensionStore'
import { CORE_SETTINGS } from '@/platform/settings/constants/coreSettings'
import { useSettingStore } from '@/platform/settings/settingStore'
import { reportError } from '@comfyorg/telemetry/reportError'
import { api } from '@/scripts/api'

import { loadExtensions } from './extensionLoader'

const coreLoad = vi.hoisted(() => ({
  onConfigure: undefined as unknown,
  processMouseDown: undefined as unknown,
  processMouseMove: undefined as unknown
}))

vi.mock(import('@/extensions/core/index'), () => ({
  registerCoreExtensions: async () => {
    const { LGraphCanvas, LGraphNode } =
      await import('@/lib/litegraph/src/litegraph')
    const { useExtensionStore } =
      await import('@/platform/extensions/stores/extensionStore')
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

describe('extension loading', () => {
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

      const [cause, options] = vi.mocked(reportError).mock.calls[0]
      assert(cause instanceof AggregateError)
      expect(cause.message).toBe('Error loading extensions')
      expect(options.tags).toEqual({ failed_extension_count: 1 })
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
