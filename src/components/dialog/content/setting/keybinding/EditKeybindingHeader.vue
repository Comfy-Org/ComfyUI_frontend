<template>
  <div class="flex w-full items-center gap-2 p-4">
    <i
      v-if="hasError"
      class="icon-[lucide--triangle-alert] text-warning-background"
    />
    <p class="m-0 text-sm">{{ commandLabel }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import type { EditKeybindingDialogState } from '@/composables/useEditKeybindingDialog'
import { useKeybindingStore } from '@/platform/keybindings/keybindingStore'

const { commandLabel, dialogState } = defineProps<{
  commandLabel: string
  dialogState: EditKeybindingDialogState
}>()

const keybindingStore = useKeybindingStore()

const hasError = computed(() => {
  if (!dialogState.newCombo) return false
  if (dialogState.newCombo.isBrowserReserved) return true
  if (dialogState.currentCombo?.equals(dialogState.newCombo)) return false
  return !!keybindingStore.getKeybinding(dialogState.newCombo)
})
</script>
