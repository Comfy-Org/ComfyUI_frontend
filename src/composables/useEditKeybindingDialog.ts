import { computed, reactive } from 'vue'

import EditKeybindingContent from '@/components/dialog/content/setting/keybinding/EditKeybindingContent.vue'
import EditKeybindingFooter from '@/components/dialog/content/setting/keybinding/EditKeybindingFooter.vue'
import EditKeybindingHeader from '@/components/dialog/content/setting/keybinding/EditKeybindingHeader.vue'
import type { KeyComboImpl } from '@/platform/keybindings/keyCombo'
import type { KeybindingImpl } from '@/platform/keybindings/keybinding'
import { useKeybindingStore } from '@/platform/keybindings/keybindingStore'
import { useDialogService } from '@/services/dialogService'

export const DIALOG_KEY = 'edit-keybinding'

export interface EditKeybindingDialogState {
  commandId: string
  newCombo: KeyComboImpl | null
  currentCombo: KeyComboImpl | null
  mode: 'edit' | 'add'
  existingBinding: KeybindingImpl | null
}

export function useEditKeybindingDialog() {
  const { showSmallLayoutDialog } = useDialogService()
  const keybindingStore = useKeybindingStore()

  function show(options: {
    commandId: string
    commandLabel: string
    currentCombo: KeyComboImpl | null
    mode?: 'edit' | 'add'
    existingBinding?: KeybindingImpl | null
  }) {
    const dialogState = reactive<EditKeybindingDialogState>({
      commandId: options.commandId,
      newCombo: options.currentCombo,
      currentCombo: options.currentCombo,
      mode: options.mode ?? 'edit',
      existingBinding: options.existingBinding ?? null
    })

    const existingKeybindingOnCombo = computed(() => {
      if (!dialogState.newCombo) return null
      if (dialogState.currentCombo?.equals(dialogState.newCombo)) return null
      return keybindingStore.getKeybinding(dialogState.newCombo)
    })

    function onUpdateCombo(combo: KeyComboImpl) {
      dialogState.newCombo = combo
    }

    showSmallLayoutDialog({
      key: DIALOG_KEY,
      headerComponent: EditKeybindingHeader,
      footerComponent: EditKeybindingFooter,
      component: EditKeybindingContent,
      props: {
        dialogState,
        onUpdateCombo,
        commandLabel: options.commandLabel,
        existingKeybindingOnCombo
      },
      headerProps: {},
      footerProps: { dialogState, existingKeybindingOnCombo }
    })
  }

  return { show }
}
