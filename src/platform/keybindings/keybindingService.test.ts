import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useKeybindingService } from '@/platform/keybindings/keybindingService'
import { useKeybindingStore } from '@/platform/keybindings/keybindingStore'
import type { Keybinding } from '@/platform/keybindings/types'
import { useCommandStore } from '@/stores/commandStore'

const mockSettingState = vi.hoisted(() => ({
  newBindings: [] as Keybinding[],
  unsetBindings: [] as Keybinding[],
  setMany: vi.fn()
}))

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: vi.fn(() => ({
    get: vi.fn((key: string) => {
      if (key === 'Comfy.Keybinding.NewBindings')
        return mockSettingState.newBindings
      if (key === 'Comfy.Keybinding.UnsetBindings')
        return mockSettingState.unsetBindings
      return []
    }),
    setMany: mockSettingState.setMany
  }))
}))

vi.mock('@/scripts/app', () => ({
  app: { canvas: null }
}))

vi.mock('@/stores/dialogStore', () => ({
  useDialogStore: vi.fn(() => ({ dialogStack: [] }))
}))

describe('keybindingService - orphaned keybinding cleanup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
    mockSettingState.newBindings = []
    mockSettingState.unsetBindings = []
  })

  function registerCommand(commandId: string) {
    useCommandStore().registerCommand({ id: commandId, function: vi.fn() })
  }

  it('should skip orphaned new bindings referencing unregistered commands', () => {
    registerCommand('Registered.Command')

    mockSettingState.newBindings = [
      { commandId: 'Registered.Command', combo: { key: 'A', ctrl: true } },
      {
        commandId: 'Removed.Extension.Command',
        combo: { key: 'B', alt: true }
      }
    ]

    const service = useKeybindingService()
    service.registerCoreKeybindings()
    service.registerUserKeybindings()

    const keybindingStore = useKeybindingStore()
    expect(
      keybindingStore.getKeybindingsByCommandId('Registered.Command')
    ).toHaveLength(1)
    expect(
      keybindingStore.getKeybindingsByCommandId('Removed.Extension.Command')
    ).toHaveLength(0)
  })

  it('should skip orphaned unset bindings referencing unregistered commands', () => {
    registerCommand('Registered.Command')

    const registeredBinding: Keybinding = {
      commandId: 'Registered.Command',
      combo: { key: 'A', ctrl: true }
    }

    mockSettingState.unsetBindings = [
      registeredBinding,
      {
        commandId: 'Removed.Extension.Command',
        combo: { key: 'B', alt: true }
      }
    ]

    const keybindingStore = useKeybindingStore()
    const unsetSpy = vi.spyOn(keybindingStore, 'unsetKeybinding')

    const service = useKeybindingService()
    service.registerCoreKeybindings()
    service.registerUserKeybindings()

    expect(unsetSpy).toHaveBeenCalledTimes(1)
    expect(unsetSpy.mock.calls[0][0].commandId).toBe('Registered.Command')
  })

  it('should persist cleanup when orphaned bindings are found', () => {
    registerCommand('Registered.Command')

    mockSettingState.newBindings = [
      { commandId: 'Registered.Command', combo: { key: 'A', ctrl: true } },
      {
        commandId: 'Removed.Extension.Command',
        combo: { key: 'B', alt: true }
      }
    ]

    const service = useKeybindingService()
    service.registerCoreKeybindings()
    service.registerUserKeybindings()

    expect(mockSettingState.setMany).toHaveBeenCalledTimes(1)
  })

  it('should not persist when no orphaned bindings exist', () => {
    registerCommand('Registered.Command')

    mockSettingState.newBindings = [
      { commandId: 'Registered.Command', combo: { key: 'A', ctrl: true } }
    ]

    const service = useKeybindingService()
    service.registerCoreKeybindings()
    service.registerUserKeybindings()

    expect(mockSettingState.setMany).not.toHaveBeenCalled()
  })
})
