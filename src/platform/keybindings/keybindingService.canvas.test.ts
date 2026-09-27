import { useSettingStore } from '@/platform/settings/settingStore'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { registerCoreKeybindingCommands } from '@/platform/keybindings/__fixtures__/registerCoreKeybindingCommands'
import { KeybindingImpl } from '@/platform/keybindings/keybinding'
import { useKeybindingService } from '@/platform/keybindings/keybindingService'
import { useKeybindingStore } from '@/platform/keybindings/keybindingStore'
import { useCommandStore } from '@/stores/commandStore'
import { useDialogStore } from '@/stores/dialogStore'

function createTestKeyboardEvent(
  key: string,
  options: {
    target?: Element
    ctrlKey?: boolean
    altKey?: boolean
    metaKey?: boolean
    shiftKey?: boolean
    repeat?: boolean
  } = {}
): KeyboardEvent {
  const {
    target = document.body,
    ctrlKey = false,
    altKey = false,
    metaKey = false,
    shiftKey = false,
    repeat = false
  } = options

  const event = new KeyboardEvent('keydown', {
    key,
    ctrlKey,
    altKey,
    metaKey,
    shiftKey,
    repeat,
    bubbles: true,
    cancelable: true
  })

  event.preventDefault = vi.fn()
  event.composedPath = vi.fn(() => [target])

  return event
}

beforeEach(() => {
  vi.mocked(useSettingStore().get).mockImplementation(() => [])
  useDialogStore().dialogStack = []
})

describe('keybindingService - Canvas Keybindings', () => {
  let keybindingService: ReturnType<typeof useKeybindingService>
  let canvasContainer: HTMLDivElement
  let canvasChild: HTMLCanvasElement

  beforeEach(() => {
    const commandStore = useCommandStore()
    commandStore.execute = vi.fn()

    Object.assign(useDialogStore(), { dialogStack: [] })

    canvasContainer = document.createElement('div')
    canvasContainer.id = 'graph-canvas-container'
    canvasChild = document.createElement('canvas')
    canvasContainer.appendChild(canvasChild)
    document.body.appendChild(canvasContainer)

    registerCoreKeybindingCommands()
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

  describe('keybinding whose command is no longer registered', () => {
    beforeEach(() => {
      useKeybindingStore().addUserKeybinding(
        new KeybindingImpl({
          commandId: 'Test.RemovedExtensionCommand',
          combo: { key: 'F9' },
          targetElementId: 'graph-canvas-container'
        })
      )
    })

    it('is ignored by keybindHandler and leaves the key unconsumed', async () => {
      const event = createTestKeyboardEvent('F9', { target: canvasChild })

      await keybindingService.keybindHandler(event)

      expect(vi.mocked(useCommandStore().execute)).not.toHaveBeenCalled()
      expect(event.preventDefault).not.toHaveBeenCalled()
    })

    it('is ignored by executeCanvasKeybinding so litegraph can handle the key', () => {
      const event = createTestKeyboardEvent('F9', { target: canvasChild })

      expect(keybindingService.executeCanvasKeybinding(event)).toBe(false)
      expect(vi.mocked(useCommandStore().execute)).not.toHaveBeenCalled()
      expect(event.preventDefault).not.toHaveBeenCalled()
    })
  })

  describe('executeCanvasKeybinding', () => {
    beforeEach(() => {
      useCommandStore().registerCommand({
        id: 'Test.CanvasCommand',
        function: () => {}
      })
      useKeybindingStore().addUserKeybinding(
        new KeybindingImpl({
          commandId: 'Test.CanvasCommand',
          combo: { key: 'F9' },
          targetElementId: 'graph-canvas-container'
        })
      )
    })

    it('executes a canvas-targeted command and consumes the key', () => {
      const event = createTestKeyboardEvent('F9', { target: canvasChild })

      expect(keybindingService.executeCanvasKeybinding(event)).toBe(true)
      expect(vi.mocked(useCommandStore().execute)).toHaveBeenCalledWith(
        'Test.CanvasCommand'
      )
      expect(event.preventDefault).toHaveBeenCalled()
    })

    it('ignores key repeats', () => {
      const event = createTestKeyboardEvent('F9', {
        target: canvasChild,
        repeat: true
      })

      expect(keybindingService.executeCanvasKeybinding(event)).toBe(false)
      expect(vi.mocked(useCommandStore().execute)).not.toHaveBeenCalled()
    })

    it('leaves non-canvas keybindings to the window handler', () => {
      useKeybindingStore().addUserKeybinding(
        new KeybindingImpl({
          commandId: 'Test.CanvasCommand',
          combo: { key: 'F10' }
        })
      )
      const event = createTestKeyboardEvent('F10', { target: canvasChild })

      expect(keybindingService.executeCanvasKeybinding(event)).toBe(false)
      expect(vi.mocked(useCommandStore().execute)).not.toHaveBeenCalled()
    })
  })
})
