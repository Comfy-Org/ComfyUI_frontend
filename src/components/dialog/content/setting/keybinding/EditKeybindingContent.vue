<template>
  <div class="flex w-96 flex-col border-t border-border-default px-4">
    <p class="mb-4 text-sm text-muted-foreground">
      {{ $t('g.setAKeybindingForTheFollowing') }}
    </p>
    <div class="mb-4 text-sm text-base-foreground">
      {{ commandLabel }}
    </div>

    <input
      class="text-foreground mb-4 w-full rounded-sm border border-border-default bg-secondary-background px-3 py-2 text-center shadow-none focus:outline-none"
      :value="dialogState.newCombo?.toString() ?? ''"
      :placeholder="$t('g.enterYourKeybind')"
      :aria-label="$t('g.enterYourKeybind')"
      autocomplete="off"
      autofocus
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
import type { KeybindingImpl } from '@/platform/keybindings/keybinding'
import { KeyComboImpl } from '@/platform/keybindings/keyCombo'

import type { EditKeybindingDialogState } from '@/composables/useEditKeybindingDialog'

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
