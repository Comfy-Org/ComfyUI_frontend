<script setup lang="ts">
import { useId } from 'vue'
import { useI18n } from 'vue-i18n'

import Badge from '@comfyorg/design-system/badge/Badge'
import Button from '@comfyorg/design-system/button/Button'
import Tooltip from '@comfyorg/design-system/tooltip/Tooltip'
import TooltipContent from '@comfyorg/design-system/tooltip/TooltipContent'
import TooltipTrigger from '@comfyorg/design-system/tooltip/TooltipTrigger'
import type { TemplateModelDownloadState } from '@/platform/workflow/templates/utils/templateModelDownloadState'

const { state, rowName } = defineProps<{
  state: Extract<TemplateModelDownloadState, { status: 'failed' }>
  rowName: string
}>()
const emit = defineEmits<{ retry: [] }>()
const { t } = useI18n()
const hintId = useId()

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
    <Tooltip :disabled="state.reason !== 'error'">
      <TooltipTrigger as-child>
        <Badge
          role="status"
          :aria-label="failureLabel()"
          severity="danger"
          variant="compact"
        >
          {{ failureLabel() }}
        </Badge>
      </TooltipTrigger>
      <TooltipContent>
        {{ t('templateWorkflows.detail.downloadFailedHint') }}
      </TooltipContent>
    </Tooltip>
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
      class="h-6 bg-secondary px-2 text-xs"
      @click="emit('retry')"
    >
      {{ t('templateWorkflows.detail.retryDownload') }}
    </Button>
  </span>
</template>
