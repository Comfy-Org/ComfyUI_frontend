<template>
  <div class="flex w-full justify-end gap-2 px-4 py-2">
    <Button variant="muted-textonly" size="md" @click="handleCancel">
      {{ $t('g.cancel') }}
    </Button>
    <Button
      :variant="
        existingKeybindingOnCombo
          ? 'destructive'
          : dialogState.newCombo?.isBrowserReserved
            ? 'secondary'
            : 'primary'
      "
      size="md"
      :disabled="!dialogState.newCombo"
      class="px-4 py-2"
      @click="handleSave"
    >
      {{
        existingKeybindingOnCombo
          ? $t('g.overwrite')
          : dialogState.newCombo?.isBrowserReserved
            ? $t('g.saveAnyway')
            : $t('g.save')
      }}
    </Button>
  </div>
</template>

<script setup lang="ts">
import type { Reactive } from 'vue'

import Button from '@comfyorg/design-system/button/Button'
import { KeybindingImpl } from '@comfyorg/keybindings/keybinding'
import { useKeybindingService } from '@/platform/keybindings/keybindingService'
import { useKeybindingStore } from '@comfyorg/keybindings/keybindingStore'
import { useDialogStore } from '@/stores/dialogStore'

import type { EditKeybindingDialogState } from '@/platform/keybindings/components/editKeybindingDialogState'
import { EDIT_KEYBINDING_DIALOG_KEY } from '@/platform/keybindings/components/editKeybindingDialogState'

const { dialogState, existingKeybindingOnCombo } = defineProps<{
  dialogState: Reactive<EditKeybindingDialogState>
  existingKeybindingOnCombo: KeybindingImpl | null
}>()

const keybindingStore = useKeybindingStore()
const keybindingService = useKeybindingService()
const dialogStore = useDialogStore()

function handleCancel() {
  dialogStore.closeDialog({ key: EDIT_KEYBINDING_DIALOG_KEY })
}

async function handleSave() {
  const combo = dialogState.newCombo
  const commandId = dialogState.commandId
  if (!combo || !commandId) return

  const saved = saveBinding(new KeybindingImpl({ commandId, combo }))
  if (!saved.ok) return

  dialogStore.closeDialog({ key: EDIT_KEYBINDING_DIALOG_KEY })
  await keybindingService.persistUserKeybindings()
}

function saveBinding(binding: KeybindingImpl) {
  const options = { replaceConflicts: Boolean(existingKeybindingOnCombo) }
  if (dialogState.mode === 'add') {
    return keybindingStore.addUserKeybinding(binding, options)
  }
  if (dialogState.existingBinding) {
    return keybindingStore.updateSpecificKeybinding(
      dialogState.existingBinding,
      binding,
      options
    )
  }
  return keybindingStore.updateKeybindingOnCommand(binding, options)
}
</script>
