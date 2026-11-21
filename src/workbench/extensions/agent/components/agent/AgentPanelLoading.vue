<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import AppSpinner from '@/components/common/AppSpinner.vue'

const { t } = useI18n()
</script>

<template>
  <div
    class="flex size-full items-center justify-center bg-background text-foreground"
  >
    <h2 id="agent-panel-title" class="sr-only">{{ t('agent.title') }}</h2>
    <AppSpinner label class="size-6" />
  </div>
</template>
