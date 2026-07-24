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
const mockPrompt = vi.hoisted(() => vi.fn().mockResolvedValue('test-preset'))
const mockShowSmallLayoutDialog = vi.hoisted(() =>
  vi.fn().mockImplementation((options: Record<string, unknown>) => {
    const props = options.props as Record<string, unknown> | undefined
    const onResult = props?.onResult as ((v: boolean) => void) | undefined
    onResult?.(true)
  })
)
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
    prompt: mockPrompt,
    showSmallLayoutDialog: mockShowSmallLayoutDialog
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

    it('does not update store when storeUserData rejects', async () => {
      mockApi.storeUserData.mockRejectedValue(new Error('Server error'))

      const keybinding = new KeybindingImpl({
        commandId: 'test.cmd',
        combo: { key: 'A', ctrl: true }
      })
      store.addUserKeybinding(keybinding)
      store.currentPresetName = 'old-preset'

      const service = await getPresetService()
      await expect(service.savePreset('my-preset')).rejects.toThrow(
        'Server error'
      )

      expect(store.currentPresetName).toBe('old-preset')
      expect(store.savedPresetData).toBeNull()
    })
  })

  describe('deletePreset', () => {
    it('calls deleteUserData and resets to default if active', async () => {
      mockApi.deleteUserData.mockResolvedValue(
        new Response(null, { status: 200 })
      )

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

    it('throws when deleteUserData response is not ok', async () => {
      mockApi.deleteUserData.mockResolvedValue(
        new Response(null, { status: 500 })
      )

      store.currentPresetName = 'vim'

      const service = await getPresetService()
      await expect(service.deletePreset('vim')).rejects.toThrow(
        'g.keybindingPresets.deletePresetFailed'
      )
    })

    it('does nothing when user cancels confirmation', async () => {
      mockConfirm.mockResolvedValueOnce(false)

      const service = await getPresetService()
      await service.deletePreset('vim')

      expect(mockApi.deleteUserData).not.toHaveBeenCalled()
    })

    it('does not reset to default when deleting a non-active preset', async () => {
      mockApi.deleteUserData.mockResolvedValue(
        new Response(null, { status: 200 })
      )

      store.currentPresetName = 'emacs'

      const service = await getPresetService()
      await service.deletePreset('vim')

      expect(store.currentPresetName).toBe('emacs')
      expect(mockPersistUserKeybindings).not.toHaveBeenCalled()
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

    it('throws when file contains non-JSON content', async () => {
      mockUploadFile.mockResolvedValue(
        new File(['not valid json {{'], 'bad.json', {
          type: 'application/json'
        })
      )

      const service = await getPresetService()
      await expect(service.importPreset()).rejects.toThrow(
        'g.keybindingPresets.invalidPresetFile'
      )
    })

    it('saves preset to storage and switches to it', async () => {
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
      mockApi.storeUserData.mockResolvedValue(new Response())
      mockApi.getUserData.mockResolvedValue(
        new Response(JSON.stringify(validPreset), { status: 200 })
      )

      const service = await getPresetService()
      await service.importPreset()

      expect(mockApi.storeUserData).toHaveBeenCalledWith(
        'keybindings/imported.json',
        JSON.stringify(validPreset),
        { overwrite: true, stringify: false }
      )
      expect(store.currentPresetName).toBe('imported')
      expect(Object.keys(store.getUserKeybindings())).toHaveLength(1)
    })
  })

  describe('presetFilePath sanitization', () => {
    it('rejects names with path separators', async () => {
      const service = await getPresetService()
      await expect(service.savePreset('../evil')).rejects.toThrow()
      await expect(service.savePreset('foo/bar')).rejects.toThrow()
      await expect(service.savePreset('foo\\bar')).rejects.toThrow()
    })

    it('rejects names starting with a dot', async () => {
      const service = await getPresetService()
      await expect(service.savePreset('.hidden')).rejects.toThrow()
    })

    it('rejects the reserved name "default"', async () => {
      const service = await getPresetService()
      await expect(service.savePreset('default')).rejects.toThrow()
    })

    it('rejects names ending with .json extension', async () => {
      const service = await getPresetService()
      await expect(service.savePreset('vim.json')).rejects.toThrow()
      await expect(service.savePreset('preset.JSON')).rejects.toThrow()
    })

    it('rejects empty names', async () => {
      const service = await getPresetService()
      await expect(service.savePreset('')).rejects.toThrow()
      await expect(service.savePreset('   ')).rejects.toThrow()
    })
  })

  describe('loadPreset name override', () => {
    it('overrides embedded name with the requested name', async () => {
      const presetData = {
        name: 'wrong-name',
        newBindings: [],
        unsetBindings: []
      }
      mockApi.getUserData.mockResolvedValue(
        new Response(JSON.stringify(presetData), { status: 200 })
      )

      const service = await getPresetService()
      const loaded = await service.loadPreset('correct-name')

      expect(loaded?.name).toBe('correct-name')
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
      expect(store.savedPresetData?.name).toBe('vim')
      expect(store.savedPresetData?.newBindings).toHaveLength(1)
      expect(store.savedPresetData?.newBindings[0].commandId).toBe('new.cmd')
      expect(Object.keys(store.getUserKeybindings())).toHaveLength(1)
      const bindings = Object.values(store.getUserKeybindings())
      expect(bindings[0].commandId).toBe('new.cmd')
    })

    it('applies unset bindings from preset', async () => {
      store.addDefaultKeybinding(
        new KeybindingImpl({
          commandId: 'test.selectAll',
          combo: { key: 'a', ctrl: true }
        })
      )

      const preset: KeybindingPreset = {
        name: 'vim',
        newBindings: [],
        unsetBindings: [
          { commandId: 'test.selectAll', combo: { key: 'a', ctrl: true } }
        ]
      }

      const service = await getPresetService()
      service.applyPreset(preset)

      expect(store.currentPresetName).toBe('vim')
      const unset = Object.values(store.getUserUnsetKeybindings())
      expect(unset).toHaveLength(1)
      expect(unset[0].commandId).toBe('test.selectAll')
    })
  })

  describe('switchPreset', () => {
    it('discards unsaved changes when dialog returns false', async () => {
      store.addUserKeybinding(
        new KeybindingImpl({
          commandId: 'dirty.cmd',
          combo: { key: 'X', ctrl: true }
        })
      )

      mockShowSmallLayoutDialog.mockImplementationOnce(
        (options: Record<string, unknown>) => {
          const props = options.props as Record<string, unknown> | undefined
          const onResult = props?.onResult as ((v: boolean) => void) | undefined
          onResult?.(false)
        }
      )

      const targetPreset: KeybindingPreset = {
        name: 'vim',
        newBindings: [
          { commandId: 'vim.cmd', combo: { key: 'J', ctrl: false } }
        ],
        unsetBindings: []
      }
      mockApi.getUserData.mockResolvedValueOnce(
        new Response(JSON.stringify(targetPreset), { status: 200 })
      )

      const service = await getPresetService()
      await service.switchPreset('vim')

      expect(store.currentPresetName).toBe('vim')
    })

    it('saves unsaved changes when dialog returns true on non-default preset', async () => {
      store.currentPresetName = 'my-preset'
      store.savedPresetData = {
        name: 'my-preset',
        newBindings: [],
        unsetBindings: []
      }
      store.addUserKeybinding(
        new KeybindingImpl({
          commandId: 'dirty.cmd',
          combo: { key: 'X', ctrl: true }
        })
      )

      mockApi.storeUserData.mockResolvedValueOnce(new Response())

      const targetPreset: KeybindingPreset = {
        name: 'vim',
        newBindings: [
          { commandId: 'vim.cmd', combo: { key: 'J', ctrl: false } }
        ],
        unsetBindings: []
      }
      mockApi.getUserData.mockResolvedValueOnce(
        new Response(JSON.stringify(targetPreset), { status: 200 })
      )

      const service = await getPresetService()
      await service.switchPreset('vim')

      expect(mockApi.storeUserData).toHaveBeenCalledWith(
        'keybindings/my-preset.json',
        expect.any(String),
        { overwrite: true, stringify: false }
      )
      expect(store.currentPresetName).toBe('vim')
    })

    it('cancels switch when dialog returns null', async () => {
      store.addUserKeybinding(
        new KeybindingImpl({
          commandId: 'dirty.cmd',
          combo: { key: 'X', ctrl: true }
        })
      )

      mockShowSmallLayoutDialog.mockImplementationOnce(
        (options: Record<string, unknown>) => {
          const dialogComponentProps = options.dialogComponentProps as
            | Record<string, unknown>
            | undefined
          const onClose = dialogComponentProps?.onClose as
            | (() => void)
            | undefined
          onClose?.()
        }
      )

      const service = await getPresetService()
      await service.switchPreset('vim')

      expect(store.currentPresetName).toBe('default')
      expect(mockApi.getUserData).not.toHaveBeenCalled()
    })

    it('switches without dialog when preset is not modified', async () => {
      const targetPreset: KeybindingPreset = {
        name: 'vim',
        newBindings: [
          { commandId: 'vim.cmd', combo: { key: 'J', ctrl: false } }
        ],
        unsetBindings: []
      }
      mockApi.getUserData.mockResolvedValueOnce(
        new Response(JSON.stringify(targetPreset), { status: 200 })
      )

      const service = await getPresetService()
      await service.switchPreset('vim')

      expect(mockShowSmallLayoutDialog).not.toHaveBeenCalled()
      expect(store.currentPresetName).toBe('vim')
    })

    it('prompts save-as-new when modified default preset and user chooses save', async () => {
      store.addUserKeybinding(
        new KeybindingImpl({
          commandId: 'dirty.cmd',
          combo: { key: 'X', ctrl: true }
        })
      )

      // promptAndSaveNewPreset succeeds
      mockApi.listUserDataFullInfo.mockResolvedValueOnce([])
      mockApi.storeUserData.mockResolvedValueOnce(new Response())

      const targetPreset: KeybindingPreset = {
        name: 'vim',
        newBindings: [
          { commandId: 'vim.cmd', combo: { key: 'J', ctrl: false } }
        ],
        unsetBindings: []
      }
      mockApi.getUserData.mockResolvedValueOnce(
        new Response(JSON.stringify(targetPreset), { status: 200 })
      )

      const service = await getPresetService()
      await service.switchPreset('vim')

      expect(mockPrompt).toHaveBeenCalled()
      expect(store.currentPresetName).toBe('vim')
    })

    it('cancels switch when modified default preset and save-as-new is cancelled', async () => {
      store.addUserKeybinding(
        new KeybindingImpl({
          commandId: 'dirty.cmd',
          combo: { key: 'X', ctrl: true }
        })
      )

      // promptAndSaveNewPreset returns false (user cancels prompt)
      mockPrompt.mockResolvedValueOnce(null)

      const service = await getPresetService()
      await service.switchPreset('vim')

      expect(mockApi.getUserData).not.toHaveBeenCalled()
      expect(store.currentPresetName).toBe('default')
    })

    it('switches to default target after unsaved changes dialog', async () => {
      store.currentPresetName = 'my-preset'
      store.savedPresetData = {
        name: 'my-preset',
        newBindings: [],
        unsetBindings: []
      }
      store.addUserKeybinding(
        new KeybindingImpl({
          commandId: 'dirty.cmd',
          combo: { key: 'X', ctrl: true }
        })
      )

      // Dialog returns false (discard)
      mockShowSmallLayoutDialog.mockImplementationOnce(
        (options: Record<string, unknown>) => {
          const props = options.props as Record<string, unknown> | undefined
          const onResult = props?.onResult as ((v: boolean) => void) | undefined
          onResult?.(false)
        }
      )

      const service = await getPresetService()
      await service.switchPreset('default')

      expect(store.currentPresetName).toBe('default')
      expect(store.savedPresetData).toBeNull()
    })
  })

  describe('promptAndSaveNewPreset', () => {
    it('returns false when user cancels prompt', async () => {
      mockPrompt.mockResolvedValueOnce(null)

      const service = await getPresetService()
      const result = await service.promptAndSaveNewPreset()

      expect(result).toBe(false)
    })

    it('returns false when user enters empty name', async () => {
      mockPrompt.mockResolvedValueOnce('   ')

      const service = await getPresetService()
      const result = await service.promptAndSaveNewPreset()

      expect(result).toBe(false)
    })

    it('saves successfully with valid name', async () => {
      mockApi.listUserDataFullInfo.mockResolvedValueOnce([])
      mockApi.storeUserData.mockResolvedValueOnce(new Response())

      const service = await getPresetService()
      const result = await service.promptAndSaveNewPreset()

      expect(result).toBe(true)
      expect(mockApi.storeUserData).toHaveBeenCalledWith(
        'keybindings/test-preset.json',
        expect.any(String),
        { overwrite: true, stringify: false }
      )
    })

    it('confirms overwrite when preset name already exists', async () => {
      mockApi.listUserDataFullInfo.mockResolvedValueOnce([
        { path: 'test-preset.json', size: 100, modified: 123 }
      ])
      mockApi.storeUserData.mockResolvedValueOnce(new Response())

      const service = await getPresetService()
      const result = await service.promptAndSaveNewPreset()

      expect(result).toBe(true)
      expect(mockConfirm).toHaveBeenCalled()
      expect(mockApi.storeUserData).toHaveBeenCalledWith(
        'keybindings/test-preset.json',
        expect.any(String),
        { overwrite: true, stringify: false }
      )
    })

    it('returns false when user rejects overwrite', async () => {
      mockApi.listUserDataFullInfo.mockResolvedValueOnce([
        { path: 'test-preset.json', size: 100, modified: 123 }
      ])
      mockConfirm.mockResolvedValueOnce(false)

      const service = await getPresetService()
      const result = await service.promptAndSaveNewPreset()

      expect(result).toBe(false)
      expect(mockApi.storeUserData).not.toHaveBeenCalled()
    })
  })

  describe('switchToDefaultPreset', () => {
    it('resets bindings and updates store and settings', async () => {
      store.addUserKeybinding(
        new KeybindingImpl({
          commandId: 'test.cmd',
          combo: { key: 'A', ctrl: true }
        })
      )
      store.currentPresetName = 'vim'
      store.savedPresetData = {
        name: 'vim',
        newBindings: [],
        unsetBindings: []
      }

      const service = await getPresetService()
      await service.switchToDefaultPreset()

      expect(Object.keys(store.getUserKeybindings())).toHaveLength(0)
      expect(store.currentPresetName).toBe('default')
      expect(store.savedPresetData).toBeNull()
      expect(mockPersistUserKeybindings).toHaveBeenCalled()
      expect(mockSettingSet).toHaveBeenCalledWith(
        'Comfy.Keybinding.CurrentPreset',
        'default'
      )
    })

    it('does not reset bindings when resetBindings is false', async () => {
      store.addUserKeybinding(
        new KeybindingImpl({
          commandId: 'test.cmd',
          combo: { key: 'A', ctrl: true }
        })
      )
      store.currentPresetName = 'vim'

      const service = await getPresetService()
      await service.switchToDefaultPreset({ resetBindings: false })

      expect(Object.keys(store.getUserKeybindings())).toHaveLength(1)
      expect(store.currentPresetName).toBe('default')
      expect(store.savedPresetData).toBeNull()
    })
  })

  describe('loadPreset error handling', () => {
    it('throws when API returns non-ok response', async () => {
      mockApi.getUserData.mockResolvedValueOnce(
        new Response(null, { status: 404 })
      )

      const service = await getPresetService()
      await expect(service.loadPreset('missing')).rejects.toThrow(
        'g.keybindingPresets.loadPresetFailed'
      )
    })

    it('throws when response contains invalid JSON', async () => {
      mockApi.getUserData.mockResolvedValueOnce(
        new Response('not-json{{{', { status: 200 })
      )

      const service = await getPresetService()
      await expect(service.loadPreset('bad-json')).rejects.toThrow()
    })

    it('throws when Zod validation fails', async () => {
      mockApi.getUserData.mockResolvedValueOnce(
        new Response(JSON.stringify({ name: 'valid', wrongField: true }), {
          status: 200
        })
      )

      const service = await getPresetService()
      await expect(service.loadPreset('bad-schema')).rejects.toThrow(
        'g.keybindingPresets.invalidPresetFile'
      )
    })
  })
})
