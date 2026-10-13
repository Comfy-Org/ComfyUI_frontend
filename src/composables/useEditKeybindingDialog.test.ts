import { isPlainObject } from 'es-toolkit'
import { isRef } from 'vue'
import { assert, describe, expect, it, vi } from 'vitest'

import { useEditKeybindingDialog } from '@/composables/useEditKeybindingDialog'
import { KeyComboImpl } from '@/platform/keybindings/keyCombo'
import { KeybindingImpl } from '@/platform/keybindings/keybinding'
import { useKeybindingStore } from '@/platform/keybindings/keybindingStore'
import { useDialogService } from '@/services/dialogService'

vi.mock(import('@/services/dialogService'))

const ctrlZ = new KeyComboImpl({ key: 'z', ctrl: true })
const ctrlY = new KeyComboImpl({ key: 'y', ctrl: true })

function shownDialog() {
  const call = vi.mocked(useDialogService().showSmallLayoutDialog).mock.lastCall
  assert.exists(call)
  const props: Record<string, unknown> = call[0].props ?? {}
  const footerProps: Record<string, unknown> = call[0].footerProps ?? {}
  const { dialogState, onUpdateCombo, existingKeybindingOnCombo } = props
  const { newKeybinding } = footerProps
  assert(isPlainObject(dialogState))
  assert(typeof onUpdateCombo === 'function')
  assert(isRef<KeybindingImpl | null>(existingKeybindingOnCombo))
  assert(isRef<KeybindingImpl | null>(newKeybinding))
  return {
    dialogState,
    onUpdateCombo,
    existingKeybindingOnCombo,
    newKeybinding
  }
}

describe('useEditKeybindingDialog', () => {
  it('preserves the scope and condition of the binding being edited', () => {
    useEditKeybindingDialog().show({
      commandId: 'test.maskEditor.undo',
      commandLabel: 'Undo',
      currentCombo: ctrlZ,
      existingBinding: new KeybindingImpl({
        commandId: 'test.maskEditor.undo',
        combo: ctrlZ,
        dialogKey: 'global-mask-editor',
        targetElementId: 'mask-editor',
        when: 'maskEditorFocused'
      })
    })
    const dialog = shownDialog()
    dialog.onUpdateCombo(ctrlY)

    expect(dialog.newKeybinding.value).toEqual(
      new KeybindingImpl({
        commandId: 'test.maskEditor.undo',
        combo: ctrlY,
        dialogKey: 'global-mask-editor',
        targetElementId: 'mask-editor',
        when: 'maskEditorFocused'
      })
    )
  })

  it('copies scope from the command defaults when adding a combo', () => {
    const store = useKeybindingStore()
    const scopedDefault = new KeybindingImpl({
      commandId: 'test.maskEditor.undo',
      combo: ctrlZ,
      dialogKey: 'global-mask-editor'
    })
    store.addDefaultKeybinding(scopedDefault)
    store.unsetKeybinding(scopedDefault)

    useEditKeybindingDialog().show({
      commandId: 'test.maskEditor.undo',
      commandLabel: 'Undo',
      currentCombo: null
    })

    expect(shownDialog().dialogState.dialogKey).toBe('global-mask-editor')
  })

  it('reports a conflict only with the binding in the same scope', () => {
    const store = useKeybindingStore()
    const workspaceUndo = new KeybindingImpl({
      commandId: 'test.undo',
      combo: ctrlZ
    })
    const maskEditorUndo = new KeybindingImpl({
      commandId: 'test.maskEditor.undo',
      combo: ctrlZ,
      dialogKey: 'global-mask-editor'
    })
    store.addDefaultKeybinding(workspaceUndo)
    store.addDefaultKeybinding(maskEditorUndo)

    useEditKeybindingDialog().show({
      commandId: 'test.maskEditor.redo',
      commandLabel: 'Redo',
      currentCombo: ctrlY,
      existingBinding: new KeybindingImpl({
        commandId: 'test.maskEditor.redo',
        combo: ctrlY,
        dialogKey: 'global-mask-editor'
      })
    })
    const dialog = shownDialog()
    dialog.onUpdateCombo(ctrlZ)

    expect(dialog.existingKeybindingOnCombo.value).toEqual(maskEditorUndo)
  })
})
