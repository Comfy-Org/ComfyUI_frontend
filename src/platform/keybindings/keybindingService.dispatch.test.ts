import { markRaw } from 'vue'
import type { Mock } from 'vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useContextKeyStore } from '@/platform/keybindings/contextKeyStore'
import { KeybindingImpl } from '@/platform/keybindings/keybinding'
import { useKeybindingService } from '@/platform/keybindings/keybindingService'
import { useKeybindingStore } from '@/platform/keybindings/keybindingStore'
import { useCommandStore } from '@/stores/commandStore'
import { useDialogStore } from '@/stores/dialogStore'

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: vi.fn(() => ({
    get: vi.fn(() => [])
  }))
}))

const MASK_EDITOR = 'global-mask-editor'
const dialogComponent = markRaw({ template: '<div />' })

function keydown(
  target: EventTarget,
  init: KeyboardEventInit & { key: string }
): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    bubbles: true,
    cancelable: true,
    ...init
  })
  target.dispatchEvent(event)
  return event
}

describe('keybindingService dispatch', () => {
  let handler: (event: KeyboardEvent) => Promise<void>
  let undo: Mock<() => void>
  let maskEditorUndo: Mock<() => void>
  let exitSubgraph: Mock<() => void>
  let sidebar: Mock<() => void>
  let pan: Mock<() => void>
  let never: Mock<() => void>
  let textCommand: Mock<() => void>

  beforeEach(() => {
    const commandStore = useCommandStore()
    undo = vi.fn<() => void>()
    maskEditorUndo = vi.fn<() => void>()
    exitSubgraph = vi.fn<() => void>()
    sidebar = vi.fn<() => void>()
    pan = vi.fn<() => void>()
    never = vi.fn<() => void>()
    textCommand = vi.fn<() => void>()
    commandStore.registerCommands([
      { id: 'test.undo', function: undo },
      { id: 'test.maskEditor.undo', function: maskEditorUndo },
      { id: 'test.exitSubgraph', function: exitSubgraph },
      { id: 'test.sidebar', function: sidebar },
      { id: 'test.pan', function: pan },
      { id: 'test.never', function: never },
      { id: 'test.textCommand', function: textCommand }
    ])
    useContextKeyStore().register('ext.wasdMode', 'ext')

    const keybindingStore = useKeybindingStore()
    keybindingStore.addDefaultKeybinding(
      new KeybindingImpl({
        commandId: 'test.undo',
        combo: { key: 'z', ctrl: true }
      })
    )
    keybindingStore.addDefaultKeybinding(
      new KeybindingImpl({
        commandId: 'test.maskEditor.undo',
        combo: { key: 'z', ctrl: true },
        dialogKey: MASK_EDITOR
      })
    )
    keybindingStore.addDefaultKeybinding(
      new KeybindingImpl({
        commandId: 'test.exitSubgraph',
        combo: { key: 'Escape' }
      })
    )
    keybindingStore.addDefaultKeybinding(
      new KeybindingImpl({ commandId: 'test.sidebar', combo: { key: 'w' } })
    )
    keybindingStore.addDefaultKeybinding(
      new KeybindingImpl({
        commandId: 'test.pan',
        combo: { key: 'w' },
        when: 'ext.wasdMode'
      })
    )
    keybindingStore.addDefaultKeybinding(
      new KeybindingImpl({
        commandId: 'test.never',
        combo: { key: 'w' },
        when: 'ext.missing'
      })
    )
    keybindingStore.addDefaultKeybinding(
      new KeybindingImpl({
        commandId: 'test.textCommand',
        combo: { key: 'ArrowLeft', ctrl: true },
        when: 'textInputFocus'
      })
    )

    handler = useKeybindingService().keybindHandler
    window.addEventListener('keydown', handler)
  })

  afterEach(() => {
    window.removeEventListener('keydown', handler)
  })

  it('runs the workspace binding when no dialog is open', () => {
    const event = keydown(document.body, { key: 'z', ctrlKey: true })

    expect(undo).toHaveBeenCalledOnce()
    expect(maskEditorUndo).not.toHaveBeenCalled()
    expect(event.defaultPrevented).toBe(true)
  })

  it('skips a keydown another handler already claimed', () => {
    const claimant = document.createElement('div')
    document.body.appendChild(claimant)
    claimant.addEventListener('keydown', (event) => event.preventDefault())

    keydown(claimant, { key: 'z', ctrlKey: true })

    expect(undo).not.toHaveBeenCalled()
    claimant.remove()
  })

  it('skips composition keydowns', () => {
    keydown(document.body, { key: 'z', ctrlKey: true, isComposing: true })

    expect(undo).not.toHaveBeenCalled()
  })

  it('runs the binding scoped to the active dialog instead of the workspace one', () => {
    useDialogStore().showDialog({
      key: MASK_EDITOR,
      component: dialogComponent
    })

    const event = keydown(document.body, { key: 'z', ctrlKey: true })

    expect(maskEditorUndo).toHaveBeenCalledOnce()
    expect(undo).not.toHaveBeenCalled()
    expect(event.defaultPrevented).toBe(true)
  })

  it('blocks the scoped binding while another dialog covers its dialog', () => {
    const dialogStore = useDialogStore()
    dialogStore.showDialog({ key: MASK_EDITOR, component: dialogComponent })
    dialogStore.showDialog({ key: 'confirm', component: dialogComponent })

    keydown(document.body, { key: 'z', ctrlKey: true })

    expect(maskEditorUndo).not.toHaveBeenCalled()
    expect(undo).not.toHaveBeenCalled()
  })

  it('keeps the scoped binding blocked when the top of three dialogs closes', () => {
    const dialogStore = useDialogStore()
    dialogStore.showDialog({ key: MASK_EDITOR, component: dialogComponent })
    dialogStore.showDialog({ key: 'confirm', component: dialogComponent })
    dialogStore.showDialog({ key: 'tooltip', component: dialogComponent })
    dialogStore.closeDialog({ key: 'tooltip' })

    keydown(document.body, { key: 'z', ctrlKey: true })

    expect(maskEditorUndo).not.toHaveBeenCalled()

    dialogStore.closeDialog({ key: 'confirm' })
    keydown(document.body, { key: 'z', ctrlKey: true })

    expect(maskEditorUndo).toHaveBeenCalledOnce()
  })

  it('does not run a scoped binding from a text input', () => {
    useDialogStore().showDialog({
      key: MASK_EDITOR,
      component: dialogComponent
    })
    const input = document.createElement('input')
    input.type = 'number'
    document.body.appendChild(input)

    keydown(input, { key: 'z', ctrlKey: true })

    expect(maskEditorUndo).not.toHaveBeenCalled()
    input.remove()
  })

  it('treats a descendant of an editable region as a text input', () => {
    const editor = document.createElement('div')
    editor.contentEditable = 'true'
    const span = document.createElement('span')
    editor.appendChild(span)
    document.body.appendChild(editor)

    keydown(span, { key: 'z', ctrlKey: true })

    expect(undo).not.toHaveBeenCalled()
    editor.remove()
  })

  it('dispatches key repeats', () => {
    keydown(document.body, { key: 'z', ctrlKey: true, repeat: true })

    expect(undo).toHaveBeenCalledOnce()
  })

  it('does not treat a slider as a text input', () => {
    const slider = document.createElement('input')
    slider.type = 'range'
    document.body.appendChild(slider)

    keydown(slider, { key: 'z', ctrlKey: true })

    expect(undo).toHaveBeenCalledOnce()
    slider.remove()
  })

  it('runs the narrower binding while its context key holds', () => {
    const contextKeys = useContextKeyStore()

    keydown(document.body, { key: 'w' })
    expect(sidebar).toHaveBeenCalledOnce()
    expect(pan).not.toHaveBeenCalled()

    contextKeys.set('ext.wasdMode', true)
    keydown(document.body, { key: 'w' })
    expect(pan).toHaveBeenCalledOnce()
    expect(sidebar).toHaveBeenCalledOnce()

    contextKeys.set('ext.wasdMode', false)
    keydown(document.body, { key: 'w' })
    expect(sidebar).toHaveBeenCalledTimes(2)
  })

  it('never runs a binding whose context key nobody registered', () => {
    keydown(document.body, { key: 'w' })

    expect(never).not.toHaveBeenCalled()
    expect(sidebar).toHaveBeenCalledOnce()
  })

  it('lets a clause opt a reserved combo into text inputs', () => {
    const textarea = document.createElement('textarea')
    document.body.appendChild(textarea)

    keydown(textarea, { key: 'ArrowLeft', ctrlKey: true })
    expect(textCommand).toHaveBeenCalledOnce()

    keydown(document.body, { key: 'ArrowLeft', ctrlKey: true })
    expect(textCommand).toHaveBeenCalledOnce()
    textarea.remove()
  })

  it('runs an extension binding over the core binding on the same combo', () => {
    const extensionUndo = vi.fn<() => void>()
    useCommandStore().registerCommand({
      id: 'ext.undo',
      function: extensionUndo
    })
    useKeybindingStore().addExtensionKeybinding(
      new KeybindingImpl({
        commandId: 'ext.undo',
        combo: { key: 'z', ctrl: true }
      }),
      'ext'
    )

    keydown(document.body, { key: 'z', ctrlKey: true })

    expect(extensionUndo).toHaveBeenCalledOnce()
    expect(undo).not.toHaveBeenCalled()
  })

  it('keeps an extension binding out of text inputs even when its clause asks', () => {
    const extensionCommand = vi.fn<() => void>()
    useCommandStore().registerCommand({
      id: 'ext.text',
      function: extensionCommand
    })
    useKeybindingStore().addExtensionKeybinding(
      new KeybindingImpl({
        commandId: 'ext.text',
        combo: { key: 'ArrowLeft', ctrl: true },
        when: 'textInputFocus'
      }),
      'ext'
    )
    const textarea = document.createElement('textarea')
    document.body.appendChild(textarea)

    keydown(textarea, { key: 'ArrowLeft', ctrlKey: true })

    expect(extensionCommand).not.toHaveBeenCalled()
    expect(textCommand).toHaveBeenCalledOnce()
    textarea.remove()
  })

  it('leaves Escape to a dismissable layer', () => {
    const layer = document.createElement('div')
    layer.setAttribute('data-dismissable-layer', '')
    const button = document.createElement('button')
    layer.appendChild(button)
    document.body.appendChild(layer)

    const event = keydown(button, { key: 'Escape' })

    expect(exitSubgraph).not.toHaveBeenCalled()
    expect(event.defaultPrevented).toBe(false)
    layer.remove()
  })

  it('leaves a binding to an unregistered command inert', () => {
    useKeybindingStore().addUserKeybinding(
      new KeybindingImpl({
        commandId: 'test.missing',
        combo: { key: 'k', ctrl: true }
      })
    )
    vi.spyOn(console, 'warn').mockImplementation(() => {})

    const event = keydown(document.body, { key: 'k', ctrlKey: true })

    expect(event.defaultPrevented).toBe(false)
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('test.missing')
    )
  })
})
