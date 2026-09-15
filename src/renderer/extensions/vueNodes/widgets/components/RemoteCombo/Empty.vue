<script setup lang="ts">
import { ComboboxEmpty } from 'reka-ui'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
</script>

<template>
  <ComboboxEmpty
    class="p-3 text-center text-xs text-muted-foreground"
    aria-live="polite"
    data-testid="remote-combo-empty"
  >
    <slot>
      {{ t('widgets.remoteCombo.noResults') }}
    </slot>
  </ComboboxEmpty>
</template>
