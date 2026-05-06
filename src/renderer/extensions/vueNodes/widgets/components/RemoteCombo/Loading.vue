<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
</script>

<template>
  <div
    class="flex items-center justify-center gap-2 p-3 text-xs text-muted-foreground"
    role="status"
    aria-live="polite"
    aria-busy="true"
    data-testid="remote-combo-loading"
  >
    <i
      class="icon-[lucide--loader-circle] size-4 animate-spin text-primary-background"
      aria-hidden="true"
    />
    <span>{{ t('widgets.remoteCombo.loading') }}</span>
  </div>
</template>
