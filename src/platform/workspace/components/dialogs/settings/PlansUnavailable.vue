<template>
  <div
    class="flex flex-1 flex-col items-start gap-3 rounded-2xl border border-interface-stroke p-6"
  >
    <div class="flex items-center gap-2 text-text-secondary" role="alert">
      <i class="pi pi-exclamation-circle text-danger" aria-hidden="true" />
      <span class="text-sm">{{ t('subscription.planLoadError') }}</span>
    </div>
    <Button
      variant="secondary"
      size="lg"
      class="rounded-lg px-4 text-sm font-normal"
      @click="emit('retry')"
    >
      {{ t('subscription.planLoadErrorRetry') }}
    </Button>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'

const emit = defineEmits<{ retry: [] }>()
const { t } = useI18n()
</script>
