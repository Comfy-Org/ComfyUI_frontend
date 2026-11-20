<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import Button from '@comfyorg/design-system/button/Button'

const { visible } = defineProps<{ visible: boolean }>()
const emit = defineEmits<{ retry: [] }>()
const { t } = useI18n()
</script>

<template>
  <div
    v-if="visible"
    role="alert"
    class="flex items-center gap-3 rounded-lg border border-destructive/40 bg-background p-3 text-sm"
  >
    <i
      aria-hidden="true"
      class="icon-[lucide--circle-alert] size-5 text-destructive"
    />
    <p class="m-0 min-w-0 flex-1">
      {{ t('agent.workflowSyncFailedTitle') }}
    </p>
    <Button
      type="button"
      variant="outline"
      size="sm"
      class="shrink-0"
      @click="emit('retry')"
    >
      {{ t('g.retry') }}
    </Button>
  </div>
</template>
