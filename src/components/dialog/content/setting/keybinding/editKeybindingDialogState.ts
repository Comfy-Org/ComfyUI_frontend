import type { KeyComboImpl } from '@/platform/keybindings/keyCombo'
import type { KeybindingImpl } from '@/platform/keybindings/keybinding'

export const EDIT_KEYBINDING_DIALOG_KEY = 'edit-keybinding'

export interface EditKeybindingDialogState {
  commandId: string
  newCombo: KeyComboImpl | null
  currentCombo: KeyComboImpl | null
  mode: 'edit' | 'add'
  existingBinding: KeybindingImpl | null
}
