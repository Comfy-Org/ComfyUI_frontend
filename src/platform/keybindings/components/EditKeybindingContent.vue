<template>
  <div class="flex w-96 flex-col border-t px-4">
    <p class="mb-4 text-sm text-muted-foreground">
      {{ $t('g.setAKeybindingForTheFollowing') }}
    </p>
    <div class="mb-4 text-sm">
      {{ commandLabel }}
    </div>

    <input
      class="mb-4 w-full rounded-sm border bg-secondary px-3 py-2 text-center shadow-none focus:outline-none"
      :value="dialogState.newCombo?.toString() ?? ''"
      :placeholder="$t('g.enterYourKeybind')"
      :aria-label="$t('g.enterYourKeybind')"
      autocomplete="off"
      autofocus
      @keydown.stop.prevent="captureKeybinding"
    />
    <div class="min-h-12 text-sm text-destructive">
      <p v-if="dialogState.newCombo?.isBrowserReserved" class="m-0">
        {{ $t('g.browserReservedKeybinding') }}
      </p>
      <p v-else-if="existingKeybindingOnCombo" class="m-0">
        {{ $t('g.keybindingAlreadyExists') }}
        {{ existingKeybindingOnCombo.commandId }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { KeybindingImpl } from '@/platform/keybindings/keybinding'
import { KeyComboImpl } from '@/platform/keybindings/keyCombo'

import type { EditKeybindingDialogState } from '@/platform/keybindings/components/editKeybindingDialogState'

const { dialogState, onUpdateCombo, existingKeybindingOnCombo } = defineProps<{
  dialogState: EditKeybindingDialogState
  commandLabel: string
  onUpdateCombo: (combo: KeyComboImpl) => void
  existingKeybindingOnCombo: KeybindingImpl | null
}>()

function captureKeybinding(event: KeyboardEvent) {
  if (!event.shiftKey && !event.altKey && !event.ctrlKey && !event.metaKey) {
    if (event.key === 'Escape') return
  }
  onUpdateCombo(KeyComboImpl.fromEvent(event))
}
</script>
