<template>
  <div
    class="relative flex flex-col gap-1 overflow-hidden rounded-lg border border-border-default bg-secondary-background px-3 py-2"
  >
    <div v-if="showProgressBar" :class="progressBarContainerClass">
      <div :class="progressBarPrimaryClass" :style="barStyle" />
    </div>

    <div class="relative flex items-center gap-2">
      <div class="flex min-w-0 flex-1 flex-col">
        <span class="truncate text-sm font-medium text-base-foreground">
          {{ filename }}
        </span>
        <span class="truncate text-xs text-muted-foreground">
          {{ directory }}
        </span>
      </div>

      <div class="flex shrink-0 items-center gap-0.5">
        <template v-if="canRaisePriority">
          <Button
            variant="textonly"
            size="icon"
            :title="$t('modelManager.raisePriority')"
            @click="actions.raisePriority(download, 1)"
          >
            <i class="icon-[lucide--chevron-up] size-4" />
          </Button>
        </template>
        <Button
          v-if="canPause"
          variant="textonly"
          size="icon"
          :title="$t('g.pause')"
          @click="actions.pause(download)"
        >
          <i class="icon-[lucide--pause] size-4" />
        </Button>
        <Button
          v-if="isAuthError"
          variant="textonly"
          size="icon"
          :title="$t('modelManager.addCredentials')"
          @click="emit('openCredentials', host)"
        >
          <i class="icon-[lucide--key-round] size-4" />
        </Button>
        <Button
          v-if="canResume"
          variant="textonly"
          size="icon"
          :title="$t('modelManager.resume')"
          @click="actions.resume(download)"
        >
          <i class="icon-[lucide--play] size-4" />
        </Button>
        <Button
          v-if="canCancel"
          variant="textonly"
          size="icon"
          :title="$t('g.cancel')"
          @click="actions.cancel(download)"
        >
          <i class="icon-[lucide--x] size-4 text-red-400" />
        </Button>
        <Button
          v-if="isTerminal"
          variant="textonly"
          size="icon"
          :title="$t('modelManager.removeFromList')"
          @click="store.removeFromView(download.download_id)"
        >
          <i class="icon-[lucide--x] size-4" />
        </Button>
      </div>
    </div>

    <div
      class="relative flex items-center justify-between gap-2 text-xs text-muted-foreground"
    >
      <span>{{ statusLabel }}</span>
      <span class="truncate" data-testid="meta-line">{{ metaLine }}</span>
    </div>

    <p
      v-if="isAuthError"
      class="relative text-xs wrap-break-word text-amber-400"
    >
      {{
        host
          ? $t('modelManager.authErrorHint', { host })
          : $t('modelManager.authErrorHintNoHost')
      }}
    </p>
    <p
      v-else-if="download.error"
      class="relative text-xs wrap-break-word text-red-400"
    >
      {{ download.error }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import { useProgressBarBackground } from '@/composables/useProgressBarBackground'
import { formatSize } from '@/utils/formatUtil'

import { useModelDownloadActions } from '../composables/useModelDownloadActions'
import {
  downloadProgressFraction,
  useModelDownloadStore
} from '../stores/modelDownloadStore'
import type { DownloadStatus } from '../types'

const { download } = defineProps<{ download: DownloadStatus }>()

const emit = defineEmits<{ openCredentials: [host: string] }>()

const { t } = useI18n()
const store = useModelDownloadStore()
const actions = useModelDownloadActions()
const {
  progressBarContainerClass,
  progressBarPrimaryClass,
  progressPercentStyle
} = useProgressBarBackground()

const directory = computed(() => {
  const slash = download.model_id.indexOf('/')
  return slash === -1 ? '' : download.model_id.slice(0, slash)
})
const filename = computed(() => {
  const slash = download.model_id.indexOf('/')
  return slash === -1 ? download.model_id : download.model_id.slice(slash + 1)
})

const host = computed(() => {
  try {
    return new URL(download.url).hostname
  } catch {
    return ''
  }
})

const percent = computed(() => {
  const fraction = downloadProgressFraction(download)
  return fraction == null ? undefined : Math.round(fraction * 100)
})

const barStyle = computed(() => progressPercentStyle(percent.value))

const isTerminal = computed(() =>
  ['completed', 'cancelled'].includes(download.status)
)
const showProgressBar = computed(
  () => download.status !== 'failed' && percent.value !== undefined
)
const canPause = computed(() => ['queued', 'active'].includes(download.status))
const canResume = computed(() => ['paused', 'failed'].includes(download.status))
const canCancel = computed(
  () => !isTerminal.value && download.status !== 'failed'
)
const canRaisePriority = computed(() => download.status === 'queued')

const AUTH_ERROR_PATTERN =
  /api key|credential|token|unauthor|forbidden|\b401\b|\b403\b/i
const isAuthError = computed(
  () =>
    download.status === 'failed' && !!download.error?.match(AUTH_ERROR_PATTERN)
)

const statusLabel = computed(() => t(`modelManager.status.${download.status}`))

const metaLine = computed(() => {
  const parts: string[] = []
  if (percent.value !== undefined) parts.push(`${percent.value}%`)
  if (download.total_bytes != null) {
    parts.push(
      `${formatSize(download.bytes_done)} / ${formatSize(download.total_bytes)}`
    )
  }
  if (download.speed_bps) parts.push(`${formatSize(download.speed_bps)}/s`)
  if (download.eta_seconds != null && download.status === 'active') {
    parts.push(formatEta(download.eta_seconds))
  }
  return parts.join(' · ')
})

function formatEta(seconds: number): string {
  const total = Math.max(0, Math.round(seconds))
  const minutes = Math.floor(total / 60)
  const secs = total % 60
  return `${minutes}:${secs.toString().padStart(2, '0')}`
}
</script>
