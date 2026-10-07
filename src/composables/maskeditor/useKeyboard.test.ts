import { zKeybinding } from '@/platform/keybindings/types'
import { effectScope, markRaw } from 'vue'
import type { EffectScope } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { KeybindingImpl } from '@/platform/keybindings/keybinding'
import { useKeybindingService } from '@/platform/keybindings/keybindingService'
import { useKeybindingStore } from '@/platform/keybindings/keybindingStore'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useDialogStore } from '@/stores/dialogStore'

import { useKeyboard } from './useKeyboard'

function key(
  type: 'keydown' | 'keyup',
  init: KeyboardEventInit = {},
  target: EventTarget = document.body
) {
  const event = new KeyboardEvent(type, {
    key: ' ',
    code: 'Space',
    bubbles: true,
    cancelable: true,
    ...init
  })
  target.dispatchEvent(event)
  return event
}

describe('Mask Editor pan shortcut', () => {
  let scope: EffectScope
  let keyboard: ReturnType<typeof useKeyboard>
  let disposeDispatcher: () => void

  beforeEach(() => {
    useSettingStore().settingValues['Comfy.Keybinding.CapturePhase'] = true
    scope = effectScope()
    scope.run(() => {
      keyboard = useKeyboard()
    })
    disposeDispatcher = useKeybindingService().install()
    useDialogStore().showDialog({
      key: 'global-mask-editor',
      component: markRaw({ template: '<div />' })
    })
  })

  afterEach(() => {
    scope.stop()
    disposeDispatcher()
  })

  it('pans only while its shortcut is held', async () => {
    expect(key('keydown').defaultPrevented).toBe(true)
    expect(keyboard.isPanning.value).toBe(true)
    key('keydown', { repeat: true })
    key('keyup')
    await vi.waitFor(() => expect(keyboard.isPanning.value).toBe(false))
  })

  it('releases panning on blur', async () => {
    key('keydown')
    window.dispatchEvent(new Event('blur'))
    await vi.waitFor(() => expect(keyboard.isPanning.value).toBe(false))
  })

  it('stops panning when another dialog covers the editor', async () => {
    key('keydown')
    useDialogStore().showDialog({
      key: 'confirm',
      component: markRaw({ template: '<div />' })
    })
    await vi.waitFor(() => expect(keyboard.isPanning.value).toBe(false))
    expect(key('keydown').defaultPrevented).toBe(false)
  })

  it('leaves spaces in an input to native text editing and preserves focus', () => {
    const input = document.createElement('input')
    document.body.appendChild(input)
    input.focus()
    try {
      expect(key('keydown', {}, input).defaultPrevented).toBe(false)
      expect(keyboard.isPanning.value).toBe(false)
      expect(document.activeElement).toBe(input)
    } finally {
      input.remove()
    }
  })

  it('does not pan outside the editor or during composition', () => {
    expect(key('keydown', { isComposing: true }).defaultPrevented).toBe(false)
    useDialogStore().closeDialog({ key: 'global-mask-editor' })
    expect(key('keydown').defaultPrevented).toBe(false)
    expect(keyboard.isPanning.value).toBe(false)
  })

  it('releases after disposal and ignores subsequent keypresses', async () => {
    key('keydown')
    scope.stop()
    await vi.waitFor(() => expect(keyboard.isPanning.value).toBe(false))
    expect(key('keydown').defaultPrevented).toBe(false)
  })

  it('uses the rebound key for both press and release', async () => {
    const bindings = useKeybindingStore()
    const original = bindings.getDefaultKeybindingsByCommandId(
      'Comfy.MaskEditor.Pan'
    )[0]
    bindings.updateSpecificKeybinding(
      original,
      new KeybindingImpl({
        ...zKeybinding.parse(original),
        combo: { key: 'p' }
      })
    )
    expect(key('keydown').defaultPrevented).toBe(false)
    key('keydown', { key: 'p', code: 'KeyP' })
    expect(keyboard.isPanning.value).toBe(true)
    key('keyup', { key: 'P', code: 'KeyP', shiftKey: true })
    await vi.waitFor(() => expect(keyboard.isPanning.value).toBe(false))
  })
})
