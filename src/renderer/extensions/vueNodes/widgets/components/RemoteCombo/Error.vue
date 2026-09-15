<script setup lang="ts">
import { inject } from 'vue'

defineProps<{
  message?: string
}>()

import { RemoteComboContextError, RemoteComboKey } from './state'

const ctx = inject(RemoteComboKey)
if (!ctx) {
  throw new RemoteComboContextError('RemoteCombo.Error')
}
</script>

<template>
  <div
    class="flex items-center gap-2 rounded-sm bg-destructive-background/10 px-3 py-2 text-xs text-base-foreground"
    role="alert"
    aria-live="assertive"
    data-testid="remote-combo-error"
  >
    <i
      class="icon-[lucide--alert-circle] size-4 shrink-0 text-destructive-background"
      aria-hidden="true"
    />
    <span class="flex-1">{{ message ?? ctx.errorMessage.value }}</span>
  </div>
</template>
