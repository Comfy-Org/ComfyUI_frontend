import { effectScope, markRaw } from 'vue'
import type { EffectScope } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { KeybindingImpl } from '@/platform/keybindings/keybinding'
import { useKeybindingService } from '@/platform/keybindings/keybindingService'
import { useKeybindingStore } from '@/platform/keybindings/keybindingStore'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useCommandStore } from '@/stores/commandStore'
import { useDialogStore } from '@/stores/dialogStore'

const COMMAND_ID = 'Test.Shortcut'

function pressKey(target: EventTarget, init: KeyboardEventInit = {}) {
  target.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'k',
      bubbles: true,
      cancelable: true,
      ...init
    })
  )
}

function bindTestShortcut(targetElementId?: string) {
  useKeybindingStore().addUserKeybinding(
    new KeybindingImpl({
      commandId: COMMAND_ID,
      combo: { key: 'k' },
      targetElementId
    })
  )
}

function openDialog() {
  useDialogStore().dialogStack.push({
    key: 'test-dialog',
    visible: true,
    component: markRaw({ template: '<div />' }),
    contentProps: {},
    dialogComponentProps: {},
    priority: 0
  })
}

describe('keybindingService - keydown resolution', () => {
  let scope: EffectScope
  const removals: Array<() => void> = []

  beforeEach(() => {
    vi.mocked(useSettingStore().get).mockImplementation(() => [])
    vi.mocked(useCommandStore().execute).mockResolvedValue(undefined)
    useDialogStore().dialogStack.length = 0
    useCommandStore().registerCommand({ id: COMMAND_ID, function: vi.fn() })

    scope = effectScope()
    scope.run(() => useKeybindingService().listenForKeydowns())
  })

  afterEach(() => {
    scope.stop()
    removals.splice(0).forEach((remove) => remove())
    document.body.replaceChildren()
  })

  it('runs a bound shortcut through the window listeners', () => {
    bindTestShortcut()

    pressKey(document.body)

    expect(useCommandStore().execute).toHaveBeenCalledOnce()
    expect(useCommandStore().execute).toHaveBeenCalledWith(COMMAND_ID)
  })

  it.for([
    {
      name: 'a plaintext-only editor',
      build: (editor: HTMLElement) => {
        editor.contentEditable = 'plaintext-only'
        return editor
      }
    },
    {
      name: 'a focusable element nested in an editor',
      build: (editor: HTMLElement) => {
        editor.contentEditable = 'true'
        const chip = document.createElement('span')
        chip.tabIndex = 0
        editor.append(chip)
        return chip
      }
    }
  ])('leaves a key typed in $name to the editor', ({ build }) => {
    bindTestShortcut()
    const editor = document.createElement('div')
    document.body.append(editor)

    pressKey(build(editor))

    expect(useCommandStore().execute).not.toHaveBeenCalled()
  })

  it('leaves keys to an input method while it is composing', () => {
    bindTestShortcut()

    pressKey(document.body, { isComposing: true })

    expect(useCommandStore().execute).not.toHaveBeenCalled()
  })

  it('does not run a workspace shortcut for a key that also closed a dialog', () => {
    bindTestShortcut()
    openDialog()
    const closeDialog = () => {
      useDialogStore().dialogStack.length = 0
    }
    document.addEventListener('keydown', closeDialog)
    removals.push(() => document.removeEventListener('keydown', closeDialog))

    pressKey(document.body)

    expect(useCommandStore().execute).not.toHaveBeenCalled()
  })

  it('runs a canvas-targeted shortcut from the canvas listener', () => {
    bindTestShortcut('graph-canvas-container')
    const container = document.createElement('div')
    container.id = 'graph-canvas-container'
    const canvas = document.createElement('canvas')
    container.append(canvas)
    document.body.append(container)
    const { executeCanvasKeybinding } = useKeybindingService()
    const onCanvasKeydown = (event: KeyboardEvent) => {
      executeCanvasKeybinding(event)
    }
    canvas.addEventListener('keydown', onCanvasKeydown, true)

    pressKey(canvas)

    expect(useCommandStore().execute).toHaveBeenCalledOnce()
    expect(useCommandStore().execute).toHaveBeenCalledWith(COMMAND_ID)
  })
})
