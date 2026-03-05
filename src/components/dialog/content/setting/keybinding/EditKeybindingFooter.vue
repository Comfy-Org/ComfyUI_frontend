<template>
  <div class="flex w-full justify-end gap-2 px-4 py-2">
    <Button variant="secondary" size="md" @click="handleCancel">
      {{ $t('g.cancel') }}
    </Button>
    <Button
      :variant="hasConflict ? 'destructive' : 'primary'"
      size="md"
      :disabled="
        !dialogState.newCombo || dialogState.newCombo.isBrowserReserved
      "
      @click="handleSave"
    >
      {{ hasConflict ? $t('g.overwrite') : $t('g.save') }}
    </Button>
  </div>
</template>

<script setup lang="ts">
import type { Reactive } from 'vue'

import { computed } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import { KeybindingImpl } from '@/platform/keybindings/keybinding'
import { useKeybindingService } from '@/platform/keybindings/keybindingService'
import { useKeybindingStore } from '@/platform/keybindings/keybindingStore'
import { useDialogStore } from '@/stores/dialogStore'

import type { EditKeybindingDialogState } from '@/composables/useEditKeybindingDialog'

const DIALOG_KEY = 'edit-keybinding'

const { dialogState } = defineProps<{
  dialogState: Reactive<EditKeybindingDialogState>
}>()

const keybindingStore = useKeybindingStore()
const keybindingService = useKeybindingService()
const dialogStore = useDialogStore()

const hasConflict = computed(() => {
  if (!dialogState.newCombo) return false
  if (dialogState.currentCombo?.equals(dialogState.newCombo)) return false
  return !!keybindingStore.getKeybinding(dialogState.newCombo)
})

function handleCancel() {
  dialogStore.closeDialog({ key: DIALOG_KEY })
}

async function handleSave() {
  const combo = dialogState.newCombo
  const commandId = dialogState.commandId
  if (!combo || !commandId) return

  dialogStore.closeDialog({ key: DIALOG_KEY })

  const updated = keybindingStore.updateKeybindingOnCommand(
    new KeybindingImpl({ commandId, combo })
  )
  if (updated) await keybindingService.persistUserKeybindings()
}
</script>
