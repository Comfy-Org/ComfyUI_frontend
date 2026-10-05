<script setup lang="ts">
import { useId } from 'vue'
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
const hintId = `${useId()}-download-failed-hint`

function failureLabel(): string {
  return t(
    state.reason === 'cancelled'
      ? 'templateWorkflows.detail.downloadCancelled'
      : 'templateWorkflows.detail.downloadFailed'
  )
}
</script>

<template>
  <span class="col-start-3 row-start-1 flex shrink-0 items-center gap-2">
    <Badge
      v-tooltip.top="
        state.reason === 'error'
          ? {
              value: t('templateWorkflows.detail.downloadFailedHint'),
              class: 'template-detail-tooltip'
            }
          : undefined
      "
      role="status"
      :aria-label="failureLabel()"
      severity="danger"
      variant="compact"
    >
      {{ failureLabel() }}
    </Badge>
    <span v-if="state.reason === 'error'" :id="hintId" class="sr-only">
      {{ t('templateWorkflows.detail.downloadFailedHint') }}
    </span>
    <Button
      :aria-label="
        t(
          'templateWorkflows.detail.retryDownloadNamed',
          { model: rowName },
          { escapeParameter: false }
        )
      "
      :aria-describedby="state.reason === 'error' ? hintId : undefined"
      variant="outline"
      size="unset"
      class="h-6 rounded-md bg-secondary-background px-2 text-xs"
      @click="emit('retry')"
    >
      {{ t('templateWorkflows.detail.retryDownload') }}
    </Button>
  </span>
</template>
