<template>
  <div class="flex w-96 flex-col border-t border-border-default p-4">
    <InputText
      ref="keybindingInput"
      class="mb-2 bg-secondary-background text-center"
      :model-value="dialogState.newCombo?.toString() ?? ''"
      :placeholder="$t('g.enterYourKeybind')"
      autocomplete="off"
      fluid
      @keydown.stop.prevent="captureKeybinding"
    />
    <div class="min-h-12">
      <p
        v-if="dialogState.newCombo?.isBrowserReserved"
        class="m-0 text-sm text-destructive-background"
      >
        {{ $t('g.browserReservedKeybinding') }}
      </p>
      <p
        v-else-if="existingKeybindingOnCombo"
        class="m-0 text-sm text-destructive-background"
      >
        {{ $t('g.keybindingAlreadyExists') }}
        {{ existingKeybindingOnCombo.commandId }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import InputText from 'primevue/inputtext'
import { computed, onMounted, ref } from 'vue'

import type { KeybindingImpl } from '@/platform/keybindings/keybinding'
import { KeyComboImpl } from '@/platform/keybindings/keyCombo'
import { useKeybindingStore } from '@/platform/keybindings/keybindingStore'

import type { EditKeybindingDialogState } from '@/composables/useEditKeybindingDialog'

const { dialogState, onUpdateCombo } = defineProps<{
  dialogState: EditKeybindingDialogState
  onUpdateCombo: (combo: KeyComboImpl) => void
}>()

const keybindingStore = useKeybindingStore()
const keybindingInput = ref<InstanceType<typeof InputText> | null>(null)

const existingKeybindingOnCombo = computed<KeybindingImpl | null>(() => {
  if (!dialogState.newCombo) return null
  if (dialogState.currentCombo?.equals(dialogState.newCombo)) return null
  return keybindingStore.getKeybinding(dialogState.newCombo)
})

function captureKeybinding(event: KeyboardEvent) {
  if (!event.shiftKey && !event.altKey && !event.ctrlKey && !event.metaKey) {
    if (event.key === 'Escape') return
  }
  onUpdateCombo(KeyComboImpl.fromEvent(event))
}

onMounted(() => {
  setTimeout(() => {
    // @ts-expect-error - $el is an internal property of the InputText component
    keybindingInput.value?.$el?.focus()
  }, 100)
})
</script>
