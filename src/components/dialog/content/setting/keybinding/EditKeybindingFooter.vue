<template>
  <div class="flex w-full justify-end gap-2 px-4 py-2">
    <Button
      variant="textonly"
      size="md"
      class="text-muted-foreground"
      @click="handleCancel"
    >
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

import Button from '@/components/ui/button/Button.vue'
import { KeybindingImpl } from '@/platform/keybindings/keybinding'
import { useKeybindingService } from '@/platform/keybindings/keybindingService'
import { useKeybindingStore } from '@/platform/keybindings/keybindingStore'
import { useDialogStore } from '@/stores/dialogStore'

import type { EditKeybindingDialogState } from '@/composables/useEditKeybindingDialog'
import { DIALOG_KEY } from '@/composables/useEditKeybindingDialog'

const { dialogState, existingKeybindingOnCombo } = defineProps<{
  dialogState: Reactive<EditKeybindingDialogState>
  existingKeybindingOnCombo: KeybindingImpl | null
}>()

const keybindingStore = useKeybindingStore()
const keybindingService = useKeybindingService()
const dialogStore = useDialogStore()

function handleCancel() {
  dialogStore.closeDialog({ key: DIALOG_KEY })
}

async function handleSave() {
  const combo = dialogState.newCombo
  const commandId = dialogState.commandId
  if (!combo || !commandId) return

  if (dialogState.mode === 'add') {
    keybindingStore.addUserKeybinding(new KeybindingImpl({ commandId, combo }))
  } else if (dialogState.existingBinding) {
    keybindingStore.updateSpecificKeybinding(
      dialogState.existingBinding,
      new KeybindingImpl({ commandId, combo })
    )
  } else {
    keybindingStore.updateKeybindingOnCommand(
      new KeybindingImpl({ commandId, combo })
    )
  }
  await keybindingService.persistUserKeybindings()
  dialogStore.closeDialog({ key: DIALOG_KEY })
}
</script>
