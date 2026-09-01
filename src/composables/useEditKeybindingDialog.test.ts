import type { ComputedRef } from 'vue'
import { describe, expect, it, vi } from 'vitest'

import type { EditKeybindingDialogState } from '@/composables/useEditKeybindingDialog'
import { useEditKeybindingDialog } from '@/composables/useEditKeybindingDialog'
import { KeyComboImpl } from '@/platform/keybindings/keyCombo'
import { KeybindingImpl } from '@/platform/keybindings/keybinding'
import { useKeybindingStore } from '@/platform/keybindings/keybindingStore'

interface DialogProps {
  dialogState: EditKeybindingDialogState
  existingKeybindingOnCombo: ComputedRef<KeybindingImpl | null>
  onUpdateCombo: (combo: KeyComboImpl) => void
}

interface FooterProps {
  newKeybinding: ComputedRef<KeybindingImpl | null>
}

const showSmallLayoutDialog = vi.hoisted(() =>
  vi.fn<(options: { props: DialogProps; footerProps: FooterProps }) => void>()
)

vi.mock('@/services/dialogService', () => ({
  useDialogService: () => ({ showSmallLayoutDialog })
}))

const ctrlZ = new KeyComboImpl({ key: 'z', ctrl: true })
const ctrlY = new KeyComboImpl({ key: 'y', ctrl: true })

function shownDialog() {
  const call = showSmallLayoutDialog.mock.lastCall
  if (!call) throw new Error('dialog was not shown')
  return { ...call[0].props, ...call[0].footerProps }
}

describe('useEditKeybindingDialog', () => {
  it('builds the new binding with the scope of the binding being edited', () => {
    useEditKeybindingDialog().show({
      commandId: 'test.maskEditor.undo',
      commandLabel: 'Undo',
      currentCombo: ctrlZ,
      existingBinding: new KeybindingImpl({
        commandId: 'test.maskEditor.undo',
        combo: ctrlZ,
        dialogKey: 'global-mask-editor',
        targetElementId: 'mask-editor'
      })
    })
    const dialog = shownDialog()
    dialog.onUpdateCombo(ctrlY)

    expect(dialog.newKeybinding.value).toEqual(
      new KeybindingImpl({
        commandId: 'test.maskEditor.undo',
        combo: ctrlY,
        dialogKey: 'global-mask-editor',
        targetElementId: 'mask-editor'
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
