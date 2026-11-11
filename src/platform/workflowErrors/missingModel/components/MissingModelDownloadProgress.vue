<template>
  <div
    data-testid="missing-model-download-progress"
    class="flex min-w-0 items-center gap-2"
    :title="progressText"
  >
    <span
      role="progressbar"
      :aria-label="
        t(
          'rightSidePanel.missingModels.downloadingModel',
          { model: modelName },
          { escapeParameter: false }
        )
      "
      aria-valuemin="0"
      aria-valuemax="100"
      :aria-valuenow="progressPercent"
      :aria-valuetext="progressText"
      class="block h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-secondary"
    >
      <span
        :class="
          cn(
            'block h-full rounded-full bg-primary transition-all duration-200 ease-linear',
            progressPercent === undefined && 'w-full animate-pulse'
          )
        "
        :style="
          progressPercent === undefined
            ? undefined
            : { width: `${progressPercent}%` }
        "
      />
    </span>
    <span
      class="w-14 shrink-0 truncate text-right text-2xs/tight text-muted-foreground tabular-nums"
    >
      {{ progressLabel }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { cn } from '@comfyorg/tailwind-utils'

import type { TemplateModelDownloadState } from '@/platform/workflow/templates/utils/templateModelDownloadState'
import { formatDownloadedBytes } from '@/platform/workflowErrors/missingModel/missingModelDownloadProgress'

type ActiveDownloadState = Extract<
  TemplateModelDownloadState,
  { status: 'queued' | 'starting' | 'downloading' }
>

const { state, modelName } = defineProps<{
  state: ActiveDownloadState
  modelName: string
}>()

const { t } = useI18n()

const progressPercent = computed(() => {
  if (state.status !== 'downloading' || state.fraction === null)
    return undefined
  return Math.round(Math.min(1, Math.max(0, state.fraction)) * 100)
})

const progressText = computed(() => {
  if (state.status === 'queued') {
    return t('rightSidePanel.missingModels.downloadQueued')
  }
  if (state.status === 'starting') {
    return t('rightSidePanel.missingModels.downloadStarting')
  }
  const bytes = formatDownloadedBytes(state)
  if (state.activity === 'paused') {
    return bytes
      ? t(
          'rightSidePanel.missingModels.downloadPausedProgress',
          { progress: bytes },
          { escapeParameter: false }
        )
      : t('rightSidePanel.missingModels.downloadPaused')
  }
  return bytes ?? `${progressPercent.value ?? 0}%`
})

const progressLabel = computed(() => {
  if (state.status !== 'downloading') return progressText.value
  if (state.activity === 'paused') {
    return t('rightSidePanel.missingModels.downloadPaused')
  }
  return progressPercent.value === undefined
    ? progressText.value
    : `${progressPercent.value}%`
})
</script>
