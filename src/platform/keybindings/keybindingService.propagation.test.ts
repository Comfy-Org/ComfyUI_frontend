import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useKeybindingService } from '@/platform/keybindings/keybindingService'
import { useCommandStore } from '@/stores/commandStore'
import { useDialogStore } from '@/stores/dialogStore'

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: vi.fn(() => ({
    get: vi.fn(() => [])
  }))
}))

vi.mock('@/stores/dialogStore', () => ({
  useDialogStore: vi.fn(() => ({
    dialogStack: []
  }))
}))

function createKeyboardEvent(
  key: string,
  options: {
    target?: Element
    ctrlKey?: boolean
    metaKey?: boolean
    shiftKey?: boolean
    altKey?: boolean
  } = {}
): KeyboardEvent {
  const { target = document.body, ...modifiers } = options
  const event = new KeyboardEvent('keydown', {
    key,
    code: key === 'Enter' ? 'Enter' : key,
    bubbles: true,
    cancelable: true,
    ...modifiers
  })
  event.preventDefault = vi.fn()
  event.stopPropagation = vi.fn()
  event.composedPath = vi.fn(() => [target])
  return event
}

describe('keybindingService - event propagation', () => {
  let keybindingService: ReturnType<typeof useKeybindingService>

  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createTestingPinia({ stubActions: false }))

    const commandStore = useCommandStore()
    commandStore.execute = vi.fn()

    vi.mocked(useDialogStore).mockReturnValue({
      dialogStack: []
    } as Partial<ReturnType<typeof useDialogStore>> as ReturnType<
      typeof useDialogStore
    >)

    keybindingService = useKeybindingService()
    keybindingService.registerCoreKeybindings()
  })

  it('stops propagation when Ctrl+Enter fires with a non-input element focused', async () => {
    // Simulates a dropdown (combobox div) being focused when Ctrl+Enter is pressed.
    // Without stopPropagation the event reaches the dropdown handler and expands it.
    const dropdown = document.createElement('div')
    dropdown.setAttribute('role', 'combobox')

    const event = createKeyboardEvent('Enter', {
      ctrlKey: true,
      target: dropdown
    })

    await keybindingService.keybindHandler(event)

    expect(vi.mocked(useCommandStore().execute)).toHaveBeenCalledWith(
      'Comfy.QueuePrompt',
      expect.any(Object)
    )
    expect(event.stopPropagation).toHaveBeenCalled()
  })

  it('does not stop propagation when no keybinding matches', async () => {
    const event = createKeyboardEvent('F13') // no binding for this key

    await keybindingService.keybindHandler(event)

    expect(event.stopPropagation).not.toHaveBeenCalled()
  })

  it('does not stop propagation when key is reserved by text input and target is textarea', async () => {
    const textarea = document.createElement('textarea')
    const event = createKeyboardEvent('Enter', { target: textarea })

    await keybindingService.keybindHandler(event)

    expect(event.stopPropagation).not.toHaveBeenCalled()
  })
})
