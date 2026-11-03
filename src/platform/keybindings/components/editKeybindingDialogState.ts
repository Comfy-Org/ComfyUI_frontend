import type { KeyComboImpl } from '@comfyorg/keybindings/keyCombo'
import type { KeybindingImpl } from '@comfyorg/keybindings/keybinding'

export const EDIT_KEYBINDING_DIALOG_KEY = 'edit-keybinding'

export interface EditKeybindingDialogState {
  commandId: string
  newCombo: KeyComboImpl | null
  currentCombo: KeyComboImpl | null
  mode: 'edit' | 'add'
  existingBinding: KeybindingImpl | null
}
