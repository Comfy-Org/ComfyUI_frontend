import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { KeybindingImpl } from '@/platform/keybindings/keybinding'
import { useKeybindingStore } from '@/platform/keybindings/keybindingStore'
import type { KeybindingPreset } from '@/platform/keybindings/types'

const mockApi = vi.hoisted(() => ({
  listUserDataFullInfo: vi.fn(),
  getUserData: vi.fn(),
  storeUserData: vi.fn(),
  deleteUserData: vi.fn()
}))

const mockDownloadBlob = vi.hoisted(() => vi.fn())
const mockUploadFile = vi.hoisted(() => vi.fn())
const mockConfirm = vi.hoisted(() => vi.fn().mockResolvedValue(true))
const mockSettingSet = vi.hoisted(() => vi.fn())
const mockToastAdd = vi.hoisted(() => vi.fn())
const mockPersistUserKeybindings = vi.hoisted(() =>
  vi.fn().mockResolvedValue(undefined)
)

vi.mock('@/scripts/api', () => ({
  api: mockApi
}))

vi.mock('@/base/common/downloadUtil', () => ({
  downloadBlob: mockDownloadBlob
}))

vi.mock('@/scripts/utils', () => ({
  uploadFile: mockUploadFile
}))

vi.mock('@/services/dialogService', () => ({
  useDialogService: () => ({
    confirm: mockConfirm,
    prompt: vi.fn().mockResolvedValue('test-preset')
  })
}))

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => ({
    set: mockSettingSet,
    get: vi.fn().mockReturnValue('default')
  })
}))

vi.mock('@/platform/updates/common/toastStore', () => ({
  useToastStore: () => ({
    add: mockToastAdd
  })
}))

vi.mock('@/composables/useErrorHandling', () => ({
  useErrorHandling: () => ({
    wrapWithErrorHandling: <T extends (...args: unknown[]) => unknown>(fn: T) =>
      fn,
    wrapWithErrorHandlingAsync: <T extends (...args: unknown[]) => unknown>(
      fn: T
    ) => fn,
    toastErrorHandler: vi.fn()
  })
}))

vi.mock('@/platform/keybindings/keybindingService', () => ({
  useKeybindingService: () => ({
    persistUserKeybindings: mockPersistUserKeybindings
  })
}))

vi.mock('@/stores/dialogStore', () => ({
  useDialogStore: () => ({
    showDialog: vi.fn(),
    closeDialog: vi.fn(),
    dialogStack: []
  })
}))

vi.mock('@/i18n', () => ({
  t: (key: string) => key
}))

describe('useKeybindingPresetService', () => {
  let store: ReturnType<typeof useKeybindingStore>

  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createTestingPinia({ stubActions: false }))
    store = useKeybindingStore()
  })

  async function getPresetService() {
    const { useKeybindingPresetService } = await import('./presetService')
    return useKeybindingPresetService()
  }

  describe('listPresets', () => {
    it('parses API response correctly', async () => {
      mockApi.listUserDataFullInfo.mockResolvedValue([
        { path: 'vim.json', size: 100, modified: 123 },
        { path: 'emacs.json', size: 200, modified: 456 }
      ])

      const service = await getPresetService()
      const presets = await service.listPresets()

      expect(mockApi.listUserDataFullInfo).toHaveBeenCalledWith('keybindings')
      expect(presets).toEqual(['vim', 'emacs'])
    })

    it('returns empty array when no presets exist', async () => {
      mockApi.listUserDataFullInfo.mockResolvedValue([])

      const service = await getPresetService()
      const presets = await service.listPresets()

      expect(presets).toEqual([])
    })
  })

  describe('savePreset', () => {
    it('calls storeUserData with correct path and data', async () => {
      mockApi.storeUserData.mockResolvedValue(new Response())

      const keybinding = new KeybindingImpl({
        commandId: 'test.cmd',
        combo: { key: 'A', ctrl: true }
      })
      store.addUserKeybinding(keybinding)

      const service = await getPresetService()
      await service.savePreset('my-preset')

      expect(mockApi.storeUserData).toHaveBeenCalledWith(
        'keybindings/my-preset.json',
        expect.stringContaining('"name":"my-preset"'),
        { overwrite: true, stringify: false }
      )
      expect(store.currentPresetName).toBe('my-preset')
    })
  })

  describe('deletePreset', () => {
    it('calls deleteUserData and resets to default if active', async () => {
      mockApi.deleteUserData.mockResolvedValue(new Response())

      store.currentPresetName = 'vim'
      store.addUserKeybinding(
        new KeybindingImpl({
          commandId: 'test.cmd',
          combo: { key: 'A', ctrl: true }
        })
      )

      const service = await getPresetService()
      await service.deletePreset('vim')

      expect(mockApi.deleteUserData).toHaveBeenCalledWith(
        'keybindings/vim.json'
      )
      expect(store.currentPresetName).toBe('default')
      expect(Object.keys(store.getUserKeybindings())).toHaveLength(0)
    })
  })

  describe('exportPreset', () => {
    it('calls downloadBlob with correct JSON', async () => {
      store.currentPresetName = 'my-preset'

      const service = await getPresetService()
      service.exportPreset()

      expect(mockDownloadBlob).toHaveBeenCalledWith(
        'my-preset.json',
        expect.any(Blob)
      )
    })
  })

  describe('importPreset', () => {
    it('validates and rejects invalid files', async () => {
      mockUploadFile.mockResolvedValue(
        new File(['{"invalid": true}'], 'bad.json', {
          type: 'application/json'
        })
      )

      const service = await getPresetService()
      await expect(service.importPreset()).rejects.toThrow()
    })

    it('applies valid preset and sets current to default', async () => {
      const validPreset: KeybindingPreset = {
        name: 'imported',
        newBindings: [
          { commandId: 'test.cmd', combo: { key: 'B', alt: true } }
        ],
        unsetBindings: []
      }
      mockUploadFile.mockResolvedValue(
        new File([JSON.stringify(validPreset)], 'imported.json', {
          type: 'application/json'
        })
      )

      const service = await getPresetService()
      await service.importPreset()

      expect(store.currentPresetName).toBe('default')
      expect(Object.keys(store.getUserKeybindings())).toHaveLength(1)
    })
  })

  describe('isCurrentPresetModified', () => {
    it('detects modifications when on default preset', () => {
      expect(store.isCurrentPresetModified).toBe(false)

      store.addUserKeybinding(
        new KeybindingImpl({
          commandId: 'test.cmd',
          combo: { key: 'A', ctrl: true }
        })
      )

      expect(store.isCurrentPresetModified).toBe(true)
    })

    it('detects no modifications when saved data matches current state', () => {
      const keybinding = new KeybindingImpl({
        commandId: 'test.cmd',
        combo: { key: 'A', ctrl: true }
      })
      store.addUserKeybinding(keybinding)
      store.currentPresetName = 'my-preset'
      store.savedPresetData = {
        name: 'my-preset',
        newBindings: [
          { commandId: 'test.cmd', combo: { key: 'A', ctrl: true } }
        ],
        unsetBindings: []
      }

      expect(store.isCurrentPresetModified).toBe(false)
    })

    it('detects modifications when saved data differs from current state', () => {
      store.addUserKeybinding(
        new KeybindingImpl({
          commandId: 'test.cmd',
          combo: { key: 'A', ctrl: true }
        })
      )
      store.currentPresetName = 'my-preset'
      store.savedPresetData = {
        name: 'my-preset',
        newBindings: [
          { commandId: 'test.cmd', combo: { key: 'B', alt: true } }
        ],
        unsetBindings: []
      }

      expect(store.isCurrentPresetModified).toBe(true)
    })
  })

  describe('applyPreset', () => {
    it('resets keybindings and applies preset data', async () => {
      store.addUserKeybinding(
        new KeybindingImpl({
          commandId: 'old.cmd',
          combo: { key: 'Z', ctrl: true }
        })
      )

      const preset: KeybindingPreset = {
        name: 'vim',
        newBindings: [
          { commandId: 'new.cmd', combo: { key: 'A', ctrl: true } }
        ],
        unsetBindings: []
      }

      const service = await getPresetService()
      service.applyPreset(preset)

      expect(store.currentPresetName).toBe('vim')
      expect(store.savedPresetData).toEqual(preset)
      expect(Object.keys(store.getUserKeybindings())).toHaveLength(1)
      const bindings = Object.values(store.getUserKeybindings())
      expect(bindings[0].commandId).toBe('new.cmd')
    })
  })
})
