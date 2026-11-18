<template>
  <li
    data-testid="missing-resources-toast-model"
    class="flex w-full flex-col gap-0.5"
  >
    <div class="flex min-h-8 items-center gap-1">
      <span class="flex min-w-0 flex-1 flex-col gap-0">
        <span class="min-w-0 text-xs/tight wrap-break-word" :title="model.name">
          {{ model.name }}
        </span>
        <span class="block text-2xs/tight text-muted-foreground tabular-nums">
          {{ metadataLabel }}
        </span>
      </span>

      <Button
        v-if="accessRepoUrl"
        variant="muted-textonly"
        size="icon-sm"
        class="size-8 shrink-0 text-warning hover:text-warning focus-visible:ring-inset"
        :aria-label="
          t(
            'rightSidePanel.missingModels.openHuggingFaceRepoDesktop',
            { model: model.name },
            { escapeParameter: false }
          )
        "
        :title="t('rightSidePanel.missingModels.gatedModelTooltip')"
        @click="requestAccess"
      >
        <i aria-hidden="true" class="icon-[lucide--lock]" />
      </Button>
      <Button
        v-if="canStart"
        variant="muted-textonly"
        size="icon-sm"
        :class="
          cn(
            'size-8 shrink-0 hover:text-foreground focus-visible:ring-inset',
            phase === 'failed' && 'text-destructive'
          )
        "
        :aria-label="
          t(
            phase === 'failed'
              ? 'rightSidePanel.missingModels.retryDownloadModel'
              : 'rightSidePanel.missingModels.downloadModel',
            { model: model.name },
            { escapeParameter: false }
          )
        "
        :title="
          phase === 'failed'
            ? t('rightSidePanel.missingModels.downloadFailedHint')
            : undefined
        "
        @click="start"
      >
        <i
          aria-hidden="true"
          :class="
            phase === 'failed'
              ? 'icon-[lucide--rotate-ccw]'
              : 'icon-[lucide--download]'
          "
        />
      </Button>
      <template v-else-if="phase === 'active'">
        <Button
          v-if="canTogglePause"
          variant="muted-textonly"
          size="icon-sm"
          class="size-8 shrink-0 hover:text-foreground focus-visible:ring-inset"
          :aria-label="
            t(
              isPaused
                ? 'rightSidePanel.missingModels.resumeDownloadModel'
                : 'rightSidePanel.missingModels.pauseDownloadModel',
              { model: model.name },
              { escapeParameter: false }
            )
          "
          @click="togglePause"
        >
          <i
            aria-hidden="true"
            :class="isPaused ? 'icon-[lucide--play]' : 'icon-[lucide--pause]'"
          />
        </Button>
        <Button
          v-if="canCancel"
          variant="muted-textonly"
          size="icon-sm"
          class="size-8 shrink-0 hover:text-foreground focus-visible:ring-inset"
          :aria-label="
            t(
              'rightSidePanel.missingModels.cancelDownloadModel',
              { model: model.name },
              { escapeParameter: false }
            )
          "
          @click="cancel"
        >
          <i aria-hidden="true" class="icon-[lucide--x]" />
        </Button>
      </template>
      <Badge v-else role="status" variant="compact" severity="success">
        {{ t('rightSidePanel.missingModels.downloaded') }}
      </Badge>
    </div>

    <MissingModelDownloadProgress
      v-if="activeDownload"
      :state="activeDownload"
      :model-name="model.name"
    />
  </li>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import Badge from '@comfyorg/design-system/badge/Badge'
import Button from '@comfyorg/design-system/button/Button'
import { cn } from '@comfyorg/tailwind-utils'

import MissingModelDownloadProgress from '@/platform/workflowErrors/missingModel/components/MissingModelDownloadProgress.vue'
import { trackedModelBytes } from '@/platform/workflowErrors/missingResources/missingResourcesToastState'
import type { TrackedModel } from '@/platform/workflowErrors/missingResources/missingResourcesToastState'
import { useTrackedModelActions } from '@/platform/workflowErrors/missingResources/useTrackedModelActions'
import { formatSize } from '@/utils/formatUtil'

const { tracked } = defineProps<{ tracked: TrackedModel }>()

const { t } = useI18n()
const {
  model,
  phase,
  activeDownload,
  isPaused,
  canStart,
  accessRepoUrl,
  canTogglePause,
  canCancel,
  start,
  togglePause,
  cancel,
  requestAccess
} = useTrackedModelActions(() => tracked)

const sizeLabel = computed(() => {
  const bytes = trackedModelBytes(tracked)
  if (!bytes) return ''
  if (phase.value !== 'active') return formatSize(bytes.total)
  return t('missingResourcesToast.bytes', {
    received: formatSize(bytes.received),
    total: formatSize(bytes.total)
  })
})

const metadataLabel = computed(() =>
  [model.value.directory, sizeLabel.value].filter(Boolean).join(' · ')
)
</script>
