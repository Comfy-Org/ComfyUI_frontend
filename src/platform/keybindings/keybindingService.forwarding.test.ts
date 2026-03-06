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

function createTestKeyboardEvent(
  key: string,
  options: {
    target?: Element
    ctrlKey?: boolean
    altKey?: boolean
    metaKey?: boolean
    shiftKey?: boolean
  } = {}
): KeyboardEvent {
  const {
    target = document.body,
    ctrlKey = false,
    altKey = false,
    metaKey = false,
    shiftKey = false
  } = options

  const event = new KeyboardEvent('keydown', {
    key,
    ctrlKey,
    altKey,
    metaKey,
    shiftKey,
    bubbles: true,
    cancelable: true
  })

  event.preventDefault = vi.fn()
  event.composedPath = vi.fn(() => [target])

  return event
}

describe('keybindingService - Canvas Keybindings', () => {
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

  it('should execute DeleteSelectedItems for Delete key', async () => {
    const event = createTestKeyboardEvent('Delete')

    await keybindingService.keybindHandler(event)

    expect(vi.mocked(useCommandStore().execute)).toHaveBeenCalledWith(
      'Comfy.Canvas.DeleteSelectedItems'
    )
  })

  it('should execute DeleteSelectedItems for Backspace key', async () => {
    const event = createTestKeyboardEvent('Backspace')

    await keybindingService.keybindHandler(event)

    expect(vi.mocked(useCommandStore().execute)).toHaveBeenCalledWith(
      'Comfy.Canvas.DeleteSelectedItems'
    )
  })

  it('should not execute DeleteSelectedItems when typing in input field', async () => {
    const inputElement = document.createElement('input')
    const event = createTestKeyboardEvent('Delete', { target: inputElement })

    await keybindingService.keybindHandler(event)

    expect(vi.mocked(useCommandStore().execute)).not.toHaveBeenCalled()
  })

  it('should not execute DeleteSelectedItems when typing in textarea', async () => {
    const textareaElement = document.createElement('textarea')
    const event = createTestKeyboardEvent('Delete', {
      target: textareaElement
    })

    await keybindingService.keybindHandler(event)

    expect(vi.mocked(useCommandStore().execute)).not.toHaveBeenCalled()
  })

  it('should execute SelectAll for Ctrl+A', async () => {
    const event = createTestKeyboardEvent('a', { ctrlKey: true })

    await keybindingService.keybindHandler(event)

    expect(vi.mocked(useCommandStore().execute)).toHaveBeenCalledWith(
      'Comfy.Canvas.SelectAll'
    )
  })

  it('should execute CopySelected for Ctrl+C', async () => {
    const event = createTestKeyboardEvent('c', { ctrlKey: true })

    await keybindingService.keybindHandler(event)

    expect(vi.mocked(useCommandStore().execute)).toHaveBeenCalledWith(
      'Comfy.Canvas.CopySelected'
    )
  })

  it('should execute PasteFromClipboard for Ctrl+V', async () => {
    const event = createTestKeyboardEvent('v', { ctrlKey: true })

    await keybindingService.keybindHandler(event)

    expect(vi.mocked(useCommandStore().execute)).toHaveBeenCalledWith(
      'Comfy.Canvas.PasteFromClipboard'
    )
  })

  it('should execute PasteFromClipboardWithConnect for Ctrl+Shift+V', async () => {
    const event = createTestKeyboardEvent('v', {
      ctrlKey: true,
      shiftKey: true
    })

    await keybindingService.keybindHandler(event)

    expect(vi.mocked(useCommandStore().execute)).toHaveBeenCalledWith(
      'Comfy.Canvas.PasteFromClipboardWithConnect'
    )
  })
})
