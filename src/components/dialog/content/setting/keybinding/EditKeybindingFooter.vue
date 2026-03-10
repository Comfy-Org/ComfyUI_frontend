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
        hasConflict
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
        hasConflict
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

import { computed } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import { KeybindingImpl } from '@/platform/keybindings/keybinding'
import { useKeybindingService } from '@/platform/keybindings/keybindingService'
import { useKeybindingStore } from '@/platform/keybindings/keybindingStore'
import { useDialogStore } from '@/stores/dialogStore'

import type { EditKeybindingDialogState } from '@/composables/useEditKeybindingDialog'
import { DIALOG_KEY } from '@/composables/useEditKeybindingDialog'

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
