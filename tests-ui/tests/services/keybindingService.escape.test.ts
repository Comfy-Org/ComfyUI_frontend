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

// Mock stores
vi.mock('@/stores/settingStore', () => ({
  useSettingStore: vi.fn(() => ({
    get: vi.fn(() => [])
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
