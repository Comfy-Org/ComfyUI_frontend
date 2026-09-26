<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import { cn } from '@comfyorg/tailwind-utils'

import WorkflowTemplateDownloadFailure from '@/components/custom/widget/WorkflowTemplateDownloadFailure.vue'
import Badge from '@/components/ui/badge/Badge.vue'
import Button from '@/components/ui/button/Button.vue'
import type { TemplateDetailRow } from '@/platform/workflow/templates/types/templateDetail'
import type { TemplateModelDownloadState } from '@/platform/workflow/templates/utils/templateModelDownloadState'
import { formatSize } from '@/utils/formatUtil'

type DownloadableStatus = Extract<
  TemplateDetailRow['status'],
  { kind: 'downloadable' }
>

const { status, rowName } = defineProps<{
  status: DownloadableStatus
  rowName: string
}>()
const emit = defineEmits<{ download: [] }>()
const { t } = useI18n()

type DownloadingState = Extract<
  TemplateModelDownloadState,
  { status: 'downloading' }
>

function getPassiveDownloadLabel(
  state: TemplateModelDownloadState | undefined
): string | undefined {
  if (state?.status === 'queued') {
    return t('templateWorkflows.detail.downloadQueued')
  }
  if (state?.status === 'starting') {
    return t('templateWorkflows.detail.downloadStarting')
  }
}

function getProgressPercent(state: DownloadingState): number | undefined {
  if (state.fraction === null) return undefined
  return Math.round(Math.min(1, Math.max(0, state.fraction)) * 100)
}

function getKnownProgressText(state: DownloadingState): string | undefined {
  if (state.receivedBytes !== null && state.totalBytes !== null) {
    return `${formatSize(state.receivedBytes)} / ${formatSize(state.totalBytes)}`
  }
  if (state.receivedBytes !== null) return formatSize(state.receivedBytes)
  if (state.totalBytes !== null) return formatSize(state.totalBytes)
}

function getProgressText(state: DownloadingState): string {
  const knownProgress = getKnownProgressText(state)
  if (state.activity !== 'paused') {
    return knownProgress ?? t('templateWorkflows.detail.downloading')
  }
  return knownProgress
    ? t('templateWorkflows.detail.downloadPausedProgress', {
        progress: knownProgress
      })
    : t('templateWorkflows.detail.downloadPaused')
}

function namedLabel(key: string): string {
  return t(key, { model: rowName }, { escapeParameter: false })
}
</script>

<template>
  <Button
    v-if="!status.downloadState || status.downloadState.status === 'idle'"
    :aria-label="namedLabel('templateWorkflows.detail.downloadModelNamed')"
    :title="status.label"
    variant="textonly"
    size="unset"
    class="size-6 shrink-0 rounded-sm p-1"
    @click="emit('download')"
  >
    <i aria-hidden="true" class="icon-[tabler--download] size-4" />
  </Button>
  <span
    v-else-if="
      status.downloadState.status === 'queued' ||
      status.downloadState.status === 'starting'
    "
    role="status"
    class="shrink-0 text-xs text-muted-foreground"
  >
    {{ getPassiveDownloadLabel(status.downloadState) }}
  </span>
  <span
    v-else-if="status.downloadState.status === 'downloading'"
    class="flex shrink-0 items-center gap-2"
  >
    <span
      role="progressbar"
      :aria-label="
        namedLabel(
          status.downloadState.activity === 'paused'
            ? 'templateWorkflows.detail.downloadPausedModel'
            : 'templateWorkflows.detail.downloadingModel'
        )
      "
      aria-valuemin="0"
      aria-valuemax="100"
      :aria-valuenow="getProgressPercent(status.downloadState)"
      :aria-valuetext="getProgressText(status.downloadState)"
      class="block h-1 w-24 overflow-hidden rounded-full bg-secondary-background"
    >
      <span
        :class="
          cn(
            'block h-full rounded-full bg-primary-background',
            status.downloadState.fraction === null && 'w-1/3',
            status.downloadState.fraction === null &&
              status.downloadState.activity === 'active' &&
              'animate-pulse'
          )
        "
        :style="
          getProgressPercent(status.downloadState) === undefined
            ? undefined
            : {
                width: `${getProgressPercent(status.downloadState)}%`
              }
        "
      />
    </span>
    <span class="text-xs text-muted-foreground">
      {{ getProgressText(status.downloadState) }}
    </span>
  </span>
  <Badge
    v-else-if="status.downloadState.status === 'done'"
    role="status"
    :aria-label="t('templateWorkflows.detail.downloaded')"
    variant="badge"
    severity="success"
    class="h-5 bg-success-background/20 px-2 py-0.5 text-xs font-medium text-success-background normal-case"
  >
    {{ t('templateWorkflows.detail.downloaded') }}
  </Badge>
  <WorkflowTemplateDownloadFailure
    v-else
    :state="status.downloadState"
    :row-name="rowName"
    @retry="emit('download')"
  />
</template>
