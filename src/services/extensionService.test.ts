import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useSettingStore } from '@/platform/settings/settingStore'
import { api } from '@/scripts/api'
import { useExtensionService } from '@/services/extensionService'
import { useCommandStore } from '@/stores/commandStore'
import { useExtensionStore } from '@/stores/extensionStore'
import { useMenuItemStore } from '@/stores/menuItemStore'
import { useBottomPanelStore } from '@/stores/workspace/bottomPanelStore'
import type { ComfyExtension } from '@/types/comfy'

vi.mock('@/scripts/app', () => ({ app: {} }))

// Loading core extensions executes every core extension module; that is far
// outside what these tests exercise.
vi.mock('@/extensions/core/index', () => ({}))

vi.mock('@/scripts/api', () => ({
  api: {
    getExtensions: vi.fn(),
    fileURL: (path: string) => path
  }
}))

vi.mock('@/composables/auth/useCurrentUser', () => ({
  useCurrentUser: () => ({
    onUserResolved: vi.fn(),
    onTokenRefreshed: vi.fn(),
    onUserLogout: vi.fn()
  })
}))

vi.mock('@/composables/useErrorHandling', () => ({
  useErrorHandling: () => ({
    wrapWithErrorHandling: <T>(fn: T) => fn,
    wrapWithErrorHandlingAsync: <T>(fn: T) => fn,
    toastErrorHandler: vi.fn()
  })
}))

vi.mock('@/lib/litegraph/src/contextMenuCompat', () => ({
  legacyMenuCompat: { setCurrentExtension: vi.fn() }
}))

vi.mock('@/platform/settings/settingStore', () => {
  const store = { get: vi.fn(() => []), addSetting: vi.fn() }
  return { useSettingStore: () => store }
})

vi.mock('@/platform/keybindings/keybindingStore', () => {
  const store = { addDefaultKeybinding: vi.fn() }
  return { useKeybindingStore: () => store }
})

vi.mock('@/stores/commandStore', () => {
  const store = { loadExtensionCommands: vi.fn() }
  return { useCommandStore: () => store }
})

vi.mock('@/stores/menuItemStore', () => {
  const store = { loadExtensionMenuCommands: vi.fn() }
  return { useMenuItemStore: () => store }
})

vi.mock('@/stores/widgetStore', () => {
  const store = { registerCustomWidgets: vi.fn() }
  return { useWidgetStore: () => store }
})

vi.mock('@/stores/workspace/bottomPanelStore', () => {
  const store = { registerExtensionBottomPanelTabs: vi.fn() }
  return { useBottomPanelStore: () => store }
})

describe('useExtensionService', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  describe('registerExtension', () => {
    it('registers the extension and processes its contributions', () => {
      const service = useExtensionService()
      const extension: ComfyExtension = {
        name: 'test.ext',
        settings: [
          { id: 'test.setting', name: 'Test', type: 'text', defaultValue: '' }
        ]
      }

      service.registerExtension(extension)

      expect(useExtensionStore().isExtensionInstalled('test.ext')).toBe(true)
      expect(useSettingStore().addSetting).toHaveBeenCalledTimes(1)
      expect(useCommandStore().loadExtensionCommands).toHaveBeenCalledTimes(1)
      expect(
        useMenuItemStore().loadExtensionMenuCommands
      ).toHaveBeenCalledTimes(1)
      expect(
        useBottomPanelStore().registerExtensionBottomPanelTabs
      ).toHaveBeenCalledTimes(1)
    })

    it('skips contribution processing for duplicate registrations', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      try {
        const service = useExtensionService()
        const first: ComfyExtension = { name: 'dup' }

        service.registerExtension(first)
        service.registerExtension({ name: 'dup' })

        expect(warnSpy).toHaveBeenCalledWith(
          "Extension named 'dup' already registered. Skipping duplicate registration."
        )
        // The first registration wins and is processed exactly once.
        expect(
          useExtensionStore().extensions.filter((ext) => ext.name === 'dup')
        ).toEqual([first])
        expect(useCommandStore().loadExtensionCommands).toHaveBeenCalledTimes(1)
        expect(
          useMenuItemStore().loadExtensionMenuCommands
        ).toHaveBeenCalledTimes(1)
        expect(
          useBottomPanelStore().registerExtensionBottomPanelTabs
        ).toHaveBeenCalledTimes(1)
      } finally {
        warnSpy.mockRestore()
      }
    })
  })

  describe('loadExtensions', () => {
    it('warns and continues when a custom extension fails to load', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      try {
        vi.mocked(api.getExtensions).mockResolvedValue([
          '/extensions/BadPack/bad.js'
        ])

        await useExtensionService().loadExtensions()

        expect(warnSpy).toHaveBeenCalledWith(
          'Error loading extension',
          '/extensions/BadPack/bad.js',
          expect.anything()
        )
      } finally {
        warnSpy.mockRestore()
      }
    })
  })
})
