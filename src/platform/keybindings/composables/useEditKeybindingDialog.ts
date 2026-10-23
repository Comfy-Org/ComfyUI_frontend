import { computed, reactive } from 'vue'

import EditKeybindingContent from '@/platform/keybindings/components/EditKeybindingContent.vue'
import EditKeybindingFooter from '@/platform/keybindings/components/EditKeybindingFooter.vue'
import EditKeybindingHeader from '@/platform/keybindings/components/EditKeybindingHeader.vue'
import { EDIT_KEYBINDING_DIALOG_KEY } from '@/platform/keybindings/components/editKeybindingDialogState'
import type { EditKeybindingDialogState } from '@/platform/keybindings/components/editKeybindingDialogState'
import type { KeyComboImpl } from '@/platform/keybindings/keyCombo'
import type { KeybindingImpl } from '@/platform/keybindings/keybinding'
import { useKeybindingStore } from '@/platform/keybindings/keybindingStore'
import { useDialogService } from '@/services/dialogService'

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
      key: EDIT_KEYBINDING_DIALOG_KEY,
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
