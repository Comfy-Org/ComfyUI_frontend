import { reactive } from 'vue'

import EditKeybindingContent from '@/components/dialog/content/setting/keybinding/EditKeybindingContent.vue'
import EditKeybindingFooter from '@/components/dialog/content/setting/keybinding/EditKeybindingFooter.vue'
import EditKeybindingHeader from '@/components/dialog/content/setting/keybinding/EditKeybindingHeader.vue'
import type { KeyComboImpl } from '@/platform/keybindings/keyCombo'
import { useDialogService } from '@/services/dialogService'

const DIALOG_KEY = 'edit-keybinding'

export interface EditKeybindingDialogState {
  commandId: string
  newCombo: KeyComboImpl | null
  currentCombo: KeyComboImpl | null
}

export function useEditKeybindingDialog() {
  const { showSmallLayoutDialog } = useDialogService()

  function show(options: {
    commandId: string
    commandLabel: string
    currentCombo: KeyComboImpl | null
  }) {
    const dialogState = reactive<EditKeybindingDialogState>({
      commandId: options.commandId,
      newCombo: options.currentCombo,
      currentCombo: options.currentCombo
    })

    function onUpdateCombo(combo: KeyComboImpl) {
      dialogState.newCombo = combo
    }

    showSmallLayoutDialog({
      key: DIALOG_KEY,
      headerComponent: EditKeybindingHeader,
      footerComponent: EditKeybindingFooter,
      component: EditKeybindingContent,
      props: { dialogState, onUpdateCombo },
      headerProps: { commandLabel: options.commandLabel, dialogState },
      footerProps: { dialogState }
    })
  }

  return { show }
}
