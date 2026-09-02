import { computed, reactive } from 'vue'

import EditKeybindingContent from '@/components/dialog/content/setting/keybinding/EditKeybindingContent.vue'
import EditKeybindingFooter from '@/components/dialog/content/setting/keybinding/EditKeybindingFooter.vue'
import EditKeybindingHeader from '@/components/dialog/content/setting/keybinding/EditKeybindingHeader.vue'
import type { KeyComboImpl } from '@/platform/keybindings/keyCombo'
import { KeybindingImpl } from '@/platform/keybindings/keybinding'
import { useKeybindingStore } from '@/platform/keybindings/keybindingStore'
import { useDialogService } from '@/services/dialogService'

export const DIALOG_KEY = 'edit-keybinding'

export interface EditKeybindingDialogState {
  commandId: string
  newCombo: KeyComboImpl | null
  currentCombo: KeyComboImpl | null
  existingBinding: KeybindingImpl | null
  targetElementId?: string
  dialogKey?: string
  when?: string
}

export function useEditKeybindingDialog() {
  const { showSmallLayoutDialog } = useDialogService()
  const keybindingStore = useKeybindingStore()

  function show(options: {
    commandId: string
    commandLabel: string
    currentCombo: KeyComboImpl | null
    existingBinding?: KeybindingImpl | null
  }) {
    const scopeTemplate =
      options.existingBinding ??
      keybindingStore.getDefaultKeybindingsByCommandId(options.commandId)[0] ??
      keybindingStore.getKeybindingByCommandId(options.commandId)
    const dialogState = reactive<EditKeybindingDialogState>({
      commandId: options.commandId,
      newCombo: options.currentCombo,
      currentCombo: options.currentCombo,
      existingBinding: options.existingBinding ?? null,
      targetElementId: scopeTemplate?.targetElementId,
      dialogKey: scopeTemplate?.dialogKey,
      when: scopeTemplate?.when
    })

    const newKeybinding = computed(() =>
      dialogState.newCombo
        ? new KeybindingImpl({
            commandId: dialogState.commandId,
            combo: dialogState.newCombo,
            targetElementId: dialogState.targetElementId,
            dialogKey: dialogState.dialogKey,
            when: dialogState.when
          })
        : null
    )

    const existingKeybindingOnCombo = computed(() => {
      const candidate = newKeybinding.value
      if (!candidate) return null
      if (dialogState.currentCombo?.equals(candidate.combo)) return null
      return keybindingStore.findConflictingKeybinding(candidate) ?? null
    })

    const existingKeybindingSource = computed(() => {
      const existing = existingKeybindingOnCombo.value
      if (!existing) return null
      const source = keybindingStore.sourceOf(existing)
      return source.tier === 'extension' ? source.name : null
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
        existingKeybindingOnCombo,
        existingKeybindingSource
      },
      headerProps: {},
      footerProps: { dialogState, newKeybinding, existingKeybindingOnCombo }
    })
  }

  return { show }
}
