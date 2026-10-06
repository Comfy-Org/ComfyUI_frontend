<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
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

/**
 * The control unmounts on request, dropping focus to the body. Hand it to what
 * replaces it, but only when the user acted here.
 */
const statusRegion = ref<HTMLElement | null>(null)
const restoreFocus = ref(false)

function requestDownload() {
  restoreFocus.value = true
  emit('download')
}

watch(
  () => status.downloadState?.status,
  async () => {
    if (!restoreFocus.value) return
    restoreFocus.value = false
    await nextTick()
    statusRegion.value?.focus()
  }
)

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
    ? t(
        'templateWorkflows.detail.downloadPausedProgress',
        { progress: knownProgress },
        // Byte counts composed with a separator; escaping turns the slash
        // into an entity in both the label and aria-valuetext.
        { escapeParameter: false }
      )
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
    class="col-start-3 row-start-1 size-8 shrink-0 rounded-md p-1.5"
    @click="requestDownload()"
  >
    <i aria-hidden="true" class="icon-[tabler--download] size-4" />
  </Button>
  <span
    v-else-if="
      status.downloadState.status === 'queued' ||
      status.downloadState.status === 'starting'
    "
    ref="statusRegion"
    role="status"
    tabindex="-1"
    class="col-[2/-1] row-start-2 flex min-w-0 items-center gap-3 text-xs text-muted-foreground focus-visible:outline-none"
  >
    <span
      aria-hidden="true"
      class="h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-secondary-background"
    >
      <span
        class="indeterminate-stripe indeterminate-stripe--drifting block h-full w-full rounded-full text-primary-background"
      />
    </span>
    <span class="shrink-0">
      {{ getPassiveDownloadLabel(status.downloadState) }}
    </span>
  </span>
  <span
    v-else-if="status.downloadState.status === 'downloading'"
    ref="statusRegion"
    tabindex="-1"
    class="col-[2/-1] row-start-2 flex min-w-0 items-center gap-3 focus-visible:outline-none"
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
      class="block h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-secondary-background"
    >
      <span
        :class="
          cn(
            'block h-full rounded-full',
            status.downloadState.fraction === null
              ? 'indeterminate-stripe w-full text-primary-background'
              : 'bg-primary-background',
            status.downloadState.fraction === null &&
              status.downloadState.activity === 'active' &&
              'indeterminate-stripe--drifting'
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
    <span class="shrink-0 text-xs text-muted-foreground">
      {{ getProgressText(status.downloadState) }}
    </span>
  </span>
  <Badge
    v-else-if="status.downloadState.status === 'done'"
    role="status"
    :aria-label="t('templateWorkflows.detail.downloaded')"
    variant="compact"
    severity="success"
    class="col-start-3 row-start-1"
  >
    {{ t('templateWorkflows.detail.downloaded') }}
  </Badge>
  <WorkflowTemplateDownloadFailure
    v-else
    :state="status.downloadState"
    :row-name="rowName"
    @retry="requestDownload()"
  />
</template>

<style scoped>
/* Tiled, so one tile of travel loops seamlessly. */
@keyframes template-download-stripe-drift {
  to {
    background-position: 0.75rem 0;
  }
}

.indeterminate-stripe {
  background-image: repeating-linear-gradient(
    135deg,
    currentColor 0 25%,
    transparent 25% 50%
  );
  background-size: 0.75rem 0.75rem;
}

.indeterminate-stripe--drifting {
  animation: template-download-stripe-drift 0.7s linear infinite;
}

/*
 * Switched off by hand, as `agent-shimmer-outline` does: the global rule only
 * collapses duration, which accelerates an infinite animation rather than
 * stopping it. The stripe still reads as indeterminate while held still.
 */
.disable-animations .indeterminate-stripe--drifting {
  animation: none;
}

@media (prefers-reduced-motion: reduce) {
  .indeterminate-stripe--drifting {
    animation: none;
  }
}
</style>
