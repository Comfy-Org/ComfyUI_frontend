<template>
  <ToastPanel
    v-model:expanded="isExpanded"
    :visible
    :announcement="headline"
    expanded-width="content"
  >
    <template #default>
      <div
        :id="detailsId"
        :inert="!isExpanded"
        class="flex w-max max-w-3xl min-w-full flex-col gap-2 px-4 py-3"
      >
        <p
          v-if="needsAttention"
          role="note"
          class="m-0 flex w-0 min-w-full gap-2 rounded-md border border-warning/30 bg-warning/10 p-2.5 text-xs/relaxed text-warning"
        >
          <i aria-hidden="true" class="mt-0.5 icon-[lucide--triangle-alert]" />
          <span>
            <span class="font-semibold">
              {{ t('missingResourcesToast.needsAttentionLabel') }}
            </span>
            {{ t('missingResourcesToast.needsAttentionHint') }}
          </span>
        </p>
        <ul
          :aria-label="t('missingResourcesToast.missingModels')"
          class="m-0 flex max-h-80 list-none flex-col gap-1 overflow-y-auto p-0"
        >
          <MissingResourcesToastModelRow
            v-for="tracked in trackedModels"
            :key="tracked.key"
            :tracked
          />
          <li
            v-for="model in unavailableModels"
            :key="model.key"
            class="flex min-h-8 items-center gap-3"
          >
            <span class="flex min-w-0 flex-1 flex-col gap-0">
              <span
                class="min-w-0 text-xs/tight wrap-break-word"
                :title="model.name"
              >
                {{ model.name }}
              </span>
              <span class="block text-2xs/tight text-muted-foreground">
                {{
                  model.directory ??
                  t('rightSidePanel.missingModels.unknownCategory')
                }}
              </span>
            </span>
            <span class="shrink-0 text-2xs/tight text-warning">
              {{ unavailableReasonLabels[model.reason] }}
            </span>
          </li>
        </ul>
      </div>
    </template>

    <template #footer="{ toggle }">
      <div class="flex w-full items-center gap-4 px-4 py-2">
        <i
          v-if="headlineIcon"
          aria-hidden="true"
          :class="cn('size-5 shrink-0', headlineIcon)"
        />
        <div class="flex min-w-0 flex-1 flex-col gap-1">
          <span class="text-sm">{{ headline }}</span>
          <span
            v-if="overallProgress"
            class="text-xs text-muted-foreground tabular-nums"
          >
            {{ overallProgress }}
          </span>
          <span
            v-if="state.kind === 'downloading'"
            role="progressbar"
            :aria-label="headline"
            aria-valuemin="0"
            aria-valuemax="100"
            :aria-valuenow="overallPercent"
            :aria-valuetext="overallProgress || undefined"
            class="mt-1 block h-1 w-full min-w-56 overflow-hidden rounded-full bg-secondary"
          >
            <span
              class="block h-full rounded-full bg-primary transition-all duration-200 ease-linear"
              :style="{ width: `${overallPercent}%` }"
            />
          </span>
        </div>

        <div class="flex shrink-0 items-center gap-2">
          <Button
            v-if="primaryLabel"
            variant="primary"
            size="md"
            data-testid="missing-resources-toast-download"
            @click="startDownloads"
          >
            <i aria-hidden="true" class="icon-[lucide--download]" />
            {{ primaryLabel }}
          </Button>
          <Button
            variant="muted-textonly"
            size="icon"
            :aria-label="
              isExpanded
                ? t('missingResourcesToast.hideDetails')
                : t('missingResourcesToast.showDetails')
            "
            :aria-expanded="isExpanded"
            :aria-controls="detailsId"
            @click="toggle"
          >
            <i
              aria-hidden="true"
              :class="
                cn(
                  'icon-[lucide--chevron-up] transition-transform',
                  isExpanded && 'rotate-180'
                )
              "
            />
          </Button>
          <Button
            variant="muted-textonly"
            size="icon"
            :aria-label="t('missingResourcesToast.dismiss')"
            @click="dismiss"
          >
            <i aria-hidden="true" class="icon-[lucide--x]" />
          </Button>
        </div>
      </div>
    </template>
  </ToastPanel>
</template>

<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@comfyorg/design-system/button/Button'
import ToastPanel from '@comfyorg/design-system/toast/ToastPanel'
import { cn } from '@comfyorg/tailwind-utils'

import MissingResourcesToastModelRow from '@/platform/workflowErrors/missingResources/MissingResourcesToastModelRow.vue'
import type { UnavailableModel } from '@/platform/workflowErrors/missingResources/missingResourcesToastState'
import { useMissingResourcesToast } from '@/platform/workflowErrors/missingResources/useMissingResourcesToast'
import { formatSize } from '@/utils/formatUtil'

const { t } = useI18n()
const {
  state,
  visible,
  trackedModels,
  unavailableModels,
  needsAttention,
  startDownloads,
  dismiss
} = useMissingResourcesToast()

const isExpanded = ref(false)

const unavailableReasonLabels = computed<
  Record<UnavailableModel['reason'], string>
>(() => ({
  noUrl: t('missingResourcesToast.noDownloadUrl'),
  unsupportedSource: t('missingResourcesToast.unsupportedSource'),
  unsupportedFile: t('missingResourcesToast.unsupportedFile')
}))
const detailsId = useId()

watch(
  () => visible.value && needsAttention.value,
  (shouldExpand) => {
    if (shouldExpand) isExpanded.value = true
  },
  { immediate: true }
)

watch(visible, (isVisible) => {
  if (!isVisible) isExpanded.value = false
})

const headline = computed(() => {
  const current = state.value
  switch (current.kind) {
    case 'needsDownload':
      return t('missingResourcesToast.needsDownload', current.missing)
    case 'downloading':
      return current.paused
        ? t('missingResourcesToast.paused')
        : t('missingResourcesToast.downloading')
    case 'failed':
      return t('missingResourcesToast.failed', current.failed)
    case 'needsAttention':
      return t('missingResourcesToast.needsAttention', current.count)
    case 'ready':
      return t('missingResourcesToast.ready')
    default:
      return ''
  }
})

const headlineIcon = computed(() => {
  switch (state.value.kind) {
    case 'failed':
      return 'icon-[lucide--circle-x] text-destructive'
    case 'ready':
      return 'icon-[lucide--circle-check] text-success'
    case 'downloading':
      return 'icon-[lucide--download] text-primary'
    case 'needsDownload':
      return ''
    default:
      return 'icon-[lucide--triangle-alert] text-warning'
  }
})

const primaryLabel = computed(() => {
  const current = state.value
  if (current.kind === 'needsDownload')
    return current.sizeBytes === null
      ? t('missingResourcesToast.downloadAll')
      : t('missingResourcesToast.downloadAllWithSize', {
          size: formatSize(current.sizeBytes)
        })
  if (current.kind === 'downloading' && current.startable > 0)
    return current.startableBytes === null
      ? t('missingResourcesToast.downloadMore', current.startable)
      : t(
          'missingResourcesToast.downloadMoreWithSize',
          { size: formatSize(current.startableBytes) },
          current.startable
        )
  if (current.kind === 'failed') return t('missingResourcesToast.retry')
  return ''
})

const overallPercent = computed(() =>
  state.value.kind === 'downloading'
    ? Math.round(state.value.fraction * 100)
    : 0
)

const overallProgress = computed(() => {
  const current = state.value
  if (current.kind !== 'downloading') return ''
  const { bytes, finished, total } = current
  return bytes
    ? t('missingResourcesToast.bytesWithCount', {
        received: formatSize(bytes.received),
        size: formatSize(bytes.total),
        finished,
        total
      })
    : t('missingResourcesToast.progress', { finished, total })
})
</script>
