<template>
  <div class="flex h-64 flex-col items-center justify-center">
    <i class="mb-4 icon-[lucide--package-open] size-12 text-muted opacity-50" />
    <p class="mb-2 text-lg text-muted">
      {{ t('templateWorkflows.myTemplates.empty') }}
    </p>
    <Button variant="primary" size="lg" @click="emit('create')">
      <i class="icon-[lucide--plus] size-4" />
      {{ t('templateWorkflows.myTemplates.createFirst') }}
    </Button>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'

const { t } = useI18n()

const emit = defineEmits<{
  create: []
}>()
</script>
