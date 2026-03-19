import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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
  let canvasContainer: HTMLDivElement
  let canvasChild: HTMLCanvasElement

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

    canvasContainer = document.createElement('div')
    canvasContainer.id = 'graph-canvas-container'
    canvasChild = document.createElement('canvas')
    canvasContainer.appendChild(canvasChild)
    document.body.appendChild(canvasContainer)

    keybindingService = useKeybindingService()
    keybindingService.registerCoreKeybindings()
  })

  afterEach(() => {
    canvasContainer.remove()
  })

  it('should execute DeleteSelectedItems for Delete key on canvas', async () => {
    const event = createTestKeyboardEvent('Delete', {
      target: canvasChild
    })

    await keybindingService.keybindHandler(event)

    expect(vi.mocked(useCommandStore().execute)).toHaveBeenCalledWith(
      'Comfy.Canvas.DeleteSelectedItems'
    )
  })

  it('should execute DeleteSelectedItems for Backspace key on canvas', async () => {
    const event = createTestKeyboardEvent('Backspace', {
      target: canvasChild
    })

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

  it('should execute SelectAll for Ctrl+A on canvas', async () => {
    const event = createTestKeyboardEvent('a', {
      ctrlKey: true,
      target: canvasChild
    })

    await keybindingService.keybindHandler(event)

    expect(vi.mocked(useCommandStore().execute)).toHaveBeenCalledWith(
      'Comfy.Canvas.SelectAll'
    )
  })

  it('should not intercept Ctrl+C to allow native copy event', async () => {
    const event = createTestKeyboardEvent('c', {
      ctrlKey: true,
      target: canvasChild
    })

    await keybindingService.keybindHandler(event)

    expect(vi.mocked(useCommandStore().execute)).not.toHaveBeenCalled()
  })

  it('should not intercept Ctrl+V to allow native paste event', async () => {
    const event = createTestKeyboardEvent('v', {
      ctrlKey: true,
      target: canvasChild
    })

    await keybindingService.keybindHandler(event)

    expect(vi.mocked(useCommandStore().execute)).not.toHaveBeenCalled()
  })

  it('should execute PasteFromClipboardWithConnect for Ctrl+Shift+V on canvas', async () => {
    const event = createTestKeyboardEvent('v', {
      ctrlKey: true,
      shiftKey: true,
      target: canvasChild
    })

    await keybindingService.keybindHandler(event)

    expect(vi.mocked(useCommandStore().execute)).toHaveBeenCalledWith(
      'Comfy.Canvas.PasteFromClipboardWithConnect'
    )
  })

  it('should execute graph-canvas bindings by normalizing to graph-canvas-container', async () => {
    const event = createTestKeyboardEvent('=', {
      altKey: true,
      target: canvasChild
    })

    await keybindingService.keybindHandler(event)

    expect(vi.mocked(useCommandStore().execute)).toHaveBeenCalledWith(
      'Comfy.Canvas.ZoomIn'
    )
  })

  it('should not execute graph-canvas bindings when target is outside canvas', async () => {
    const outsideDiv = document.createElement('div')
    document.body.appendChild(outsideDiv)

    const event = createTestKeyboardEvent('=', {
      altKey: true,
      target: outsideDiv
    })

    await keybindingService.keybindHandler(event)

    expect(vi.mocked(useCommandStore().execute)).not.toHaveBeenCalled()
    outsideDiv.remove()
  })

  it('should not execute canvas commands when target is outside canvas container', async () => {
    const outsideDiv = document.createElement('div')
    document.body.appendChild(outsideDiv)

    const event = createTestKeyboardEvent('Delete', {
      target: outsideDiv
    })

    await keybindingService.keybindHandler(event)

    expect(vi.mocked(useCommandStore().execute)).not.toHaveBeenCalled()
    outsideDiv.remove()
  })
})
