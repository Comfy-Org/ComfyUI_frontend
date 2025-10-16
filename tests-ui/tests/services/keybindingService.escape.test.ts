import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { CORE_KEYBINDINGS } from '@/constants/coreKeybindings'
import { useKeybindingService } from '@/services/keybindingService'
import { useCommandStore } from '@/stores/commandStore'
import { useDialogStore } from '@/stores/dialogStore'
import {
  KeyComboImpl,
  KeybindingImpl,
  useKeybindingStore
} from '@/stores/keybindingStore'

const settingStoreGetMock = vi.fn()
const settingStoreSetMock = vi.fn()

// Mock stores
vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: vi.fn(() => ({
    get: settingStoreGetMock,
    set: settingStoreSetMock
  }))
}))

vi.mock('@/stores/dialogStore', () => ({
  useDialogStore: vi.fn(() => ({
    dialogStack: []
  }))
}))

describe('keybindingService - Escape key handling', () => {
  let keybindingService: ReturnType<typeof useKeybindingService>
  let mockCommandExecute: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())

    settingStoreGetMock.mockImplementation(() => [])
    settingStoreSetMock.mockResolvedValue(undefined)

    // Mock command store execute
    mockCommandExecute = vi.fn()
    const commandStore = useCommandStore()
    commandStore.execute = mockCommandExecute

    // Reset dialog store mock to empty
    vi.mocked(useDialogStore).mockReturnValue({
      dialogStack: []
    } as any)

    keybindingService = useKeybindingService()
    keybindingService.registerCoreKeybindings()
  })

  it('should register Escape key for ExitSubgraph command', () => {
    const keybindingStore = useKeybindingStore()

    // Check that the Escape keybinding exists in core keybindings
    const escapeKeybinding = CORE_KEYBINDINGS.find(
      (kb) =>
        kb.combo.key === 'Escape' && kb.commandId === 'Comfy.Graph.ExitSubgraph'
    )
    expect(escapeKeybinding).toBeDefined()

    // Check that it was registered in the store
    const registeredBinding = keybindingStore.getKeybinding(
      new KeyComboImpl({ key: 'Escape' })
    )
    expect(registeredBinding).toBeDefined()
    expect(registeredBinding?.commandId).toBe('Comfy.Graph.ExitSubgraph')
  })

  it('should execute ExitSubgraph command when Escape is pressed', async () => {
    const event = new KeyboardEvent('keydown', {
      key: 'Escape',
      code: 'Escape',
      bubbles: true,
      cancelable: true
    })

    // Mock event methods
    event.preventDefault = vi.fn()
    event.composedPath = vi.fn(() => [document.body])

    await keybindingService.keybindHandler(event)

    expect(event.preventDefault).toHaveBeenCalled()
    expect(mockCommandExecute).toHaveBeenCalledWith('Comfy.Graph.ExitSubgraph')
  })

  it('should not execute command when Escape is pressed with modifiers', async () => {
    const event = new KeyboardEvent('keydown', {
      key: 'Escape',
      code: 'Escape',
      ctrlKey: true,
      bubbles: true,
      cancelable: true
    })

    event.preventDefault = vi.fn()
    event.composedPath = vi.fn(() => [document.body])

    await keybindingService.keybindHandler(event)

    expect(mockCommandExecute).not.toHaveBeenCalled()
  })

  it('should not execute command when typing in input field', async () => {
    const inputElement = document.createElement('input')
    const event = new KeyboardEvent('keydown', {
      key: 'Escape',
      code: 'Escape',
      bubbles: true,
      cancelable: true
    })

    event.preventDefault = vi.fn()
    event.composedPath = vi.fn(() => [inputElement])

    await keybindingService.keybindHandler(event)

    expect(mockCommandExecute).not.toHaveBeenCalled()
  })

  it('should close dialogs when no keybinding is registered', async () => {
    // Remove the Escape keybinding
    const keybindingStore = useKeybindingStore()
    keybindingStore.unsetKeybinding(
      new KeybindingImpl({
        commandId: 'Comfy.Graph.ExitSubgraph',
        combo: { key: 'Escape' }
      })
    )

    // Create a mock dialog
    const dialog = document.createElement('dialog')
    dialog.open = true
    dialog.close = vi.fn()
    document.body.appendChild(dialog)

    const event = new KeyboardEvent('keydown', {
      key: 'Escape',
      code: 'Escape',
      bubbles: true,
      cancelable: true
    })

    event.composedPath = vi.fn(() => [document.body])

    await keybindingService.keybindHandler(event)

    expect(dialog.close).toHaveBeenCalled()
    expect(mockCommandExecute).not.toHaveBeenCalled()

    // Cleanup
    document.body.removeChild(dialog)
  })

  it('should allow user to rebind Escape key to different command', async () => {
    const keybindingStore = useKeybindingStore()

    // Add a user keybinding for Escape to a different command
    keybindingStore.addUserKeybinding(
      new KeybindingImpl({
        commandId: 'Custom.Command',
        combo: { key: 'Escape' }
      })
    )

    const event = new KeyboardEvent('keydown', {
      key: 'Escape',
      code: 'Escape',
      bubbles: true,
      cancelable: true
    })

    event.preventDefault = vi.fn()
    event.composedPath = vi.fn(() => [document.body])

    await keybindingService.keybindHandler(event)

    expect(event.preventDefault).toHaveBeenCalled()
    expect(mockCommandExecute).toHaveBeenCalledWith('Custom.Command')
    expect(mockCommandExecute).not.toHaveBeenCalledWith(
      'Comfy.Graph.ExitSubgraph'
    )
  })

  it('should not execute Escape keybinding when dialogs are open', async () => {
    // Mock dialog store to have open dialogs
    vi.mocked(useDialogStore).mockReturnValue({
      dialogStack: [{ key: 'test-dialog' }]
    } as any)

    // Re-create keybinding service to pick up new mock
    keybindingService = useKeybindingService()

    const event = new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true
    })

    event.preventDefault = vi.fn()
    event.composedPath = vi.fn(() => [document.body])

    await keybindingService.keybindHandler(event)

    // Should not call preventDefault or execute command
    expect(event.preventDefault).not.toHaveBeenCalled()
    expect(mockCommandExecute).not.toHaveBeenCalled()
  })
})

describe('keybindingService - migration support', () => {
  let keybindingService: ReturnType<typeof useKeybindingService>
  let keybindingStore: ReturnType<typeof useKeybindingStore>

  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())

    settingStoreSetMock.mockResolvedValue(undefined)
    settingStoreGetMock.mockImplementation((key: string) => {
      if (key === 'Comfy.Keybinding.UnsetBindings') {
        return []
      }
      if (key === 'Comfy.Keybinding.NewBindings') {
        return []
      }
      return []
    })

    keybindingService = useKeybindingService()
    keybindingService.registerCoreKeybindings()
    keybindingStore = useKeybindingStore()
  })

  it('migrates legacy unset bindings using default combos', async () => {
    // Legacy format used lowercase letters
    // User wants to unset the 'R' shortcut (Comfy.RefreshNodeDefinitions)
    const legacyUnset = [
      {
        commandId: 'Comfy.RefreshNodeDefinitions',
        combo: { key: 'r' } // Old format
      }
    ]

    settingStoreGetMock.mockImplementation((key: string) => {
      if (key === 'Comfy.Keybinding.UnsetBindings') {
        return legacyUnset
      }
      if (key === 'Comfy.Keybinding.NewBindings') {
        return []
      }
      return []
    })

    await keybindingService.registerUserKeybindings()

    const unsetBindings = Object.values(
      keybindingStore.getUserUnsetKeybindings()
    )

    // Should have migrated and unset the binding
    expect(unsetBindings).toHaveLength(1)
    expect(unsetBindings[0].combo.key).toBe('KeyR')
    expect(unsetBindings[0].commandId).toBe('Comfy.RefreshNodeDefinitions')

    // Should have saved the migrated format
    expect(settingStoreSetMock).toHaveBeenCalledWith(
      'Comfy.Keybinding.UnsetBindings',
      expect.arrayContaining([
        expect.objectContaining({
          commandId: 'Comfy.RefreshNodeDefinitions',
          combo: expect.objectContaining({
            key: 'KeyR'
          })
        })
      ])
    )

    // Verify the keybinding no longer matches
    const eventCombo = new KeyComboImpl({ key: 'KeyR' })
    const resolved = keybindingStore.getKeybinding(eventCombo)
    expect(resolved).toBeUndefined()
  })

  it('matches migrated event.code against legacy user bindings', async () => {
    // User has a legacy binding in old format
    const legacyBindings = [
      {
        commandId: 'Custom.Legacy',
        combo: { key: 'q' }
      }
    ]

    settingStoreGetMock.mockImplementation((key: string) => {
      if (key === 'Comfy.Keybinding.UnsetBindings') {
        return []
      }
      if (key === 'Comfy.Keybinding.NewBindings') {
        return legacyBindings
      }
      return []
    })

    // Register user keybindings (which will migrate them)
    await keybindingService.registerUserKeybindings()

    // Now press 'Q' key with event.code format
    const eventCombo = new KeyComboImpl({ key: 'KeyQ' })

    const resolved = keybindingStore.getKeybinding(eventCombo)

    expect(resolved?.commandId).toBe('Custom.Legacy')
  })
})
