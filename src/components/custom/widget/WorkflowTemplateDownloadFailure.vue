<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import Badge from '@/components/ui/badge/Badge.vue'
import Button from '@/components/ui/button/Button.vue'
import type { TemplateModelDownloadState } from '@/platform/workflow/templates/utils/templateModelDownloadState'

const { state, rowName } = defineProps<{
  state: Extract<TemplateModelDownloadState, { status: 'failed' }>
  rowName: string
}>()
const emit = defineEmits<{ retry: [] }>()
const { t } = useI18n()

function failureLabel(): string {
  return t(
    state.reason === 'cancelled'
      ? 'templateWorkflows.detail.downloadCancelled'
      : 'templateWorkflows.detail.downloadFailed'
  )
}
</script>

<template>
  <span class="flex shrink-0 items-center gap-2">
    <Badge
      role="status"
      :aria-label="failureLabel()"
      severity="danger"
      variant="badge"
      class="h-5 px-2 py-0.5 text-xs font-medium normal-case"
    >
      {{ failureLabel() }}
    </Badge>
    <Button
      :aria-label="
        t(
          'templateWorkflows.detail.retryDownloadNamed',
          { model: rowName },
          { escapeParameter: false }
        )
      "
      variant="outline"
      size="unset"
      class="h-6 rounded-md bg-secondary-background px-2 text-xs"
      @click="emit('retry')"
    >
      {{ t('templateWorkflows.detail.retryDownload') }}
    </Button>
  </span>
</template>
