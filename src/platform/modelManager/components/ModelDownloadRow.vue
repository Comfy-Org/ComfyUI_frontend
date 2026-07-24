<template>
  <div
    :class="
      cn(
        'relative flex flex-col gap-1 overflow-hidden rounded-lg border border-border-default bg-secondary-background px-3 py-2',
        isCancelled && 'opacity-60'
      )
    "
  >
    <div
      v-if="showProgressBar"
      :class="progressBarContainerClass"
      data-testid="progress-bar"
    >
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
          :title="$t('modelManager.setUpDownloadAccess')"
          @click="emit('openAuth', provider)"
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
          @click="actions.remove(download)"
        >
          <i class="icon-[lucide--x] size-4" />
        </Button>
      </div>
    </div>

    <div
      class="relative flex items-center justify-between gap-2 text-xs text-muted-foreground"
    >
      <span class="flex items-center gap-1">
        <i v-if="isCancelled" class="icon-[lucide--ban] size-3.5" />
        {{ statusLabel }}
      </span>
      <span class="truncate" data-testid="meta-line">{{ metaLine }}</span>
    </div>

    <p
      v-if="isGatedModel"
      class="relative text-xs wrap-break-word text-amber-400"
    >
      {{ $t('modelManager.gatedModelHint') }}
      <a
        v-if="modelPageUrl"
        :href="modelPageUrl"
        target="_blank"
        rel="noopener noreferrer"
        class="underline"
      >
        {{ $t('modelManager.openModelPage') }}
      </a>
    </p>
    <p
      v-else-if="isAuthError"
      class="relative text-xs wrap-break-word text-amber-400"
    >
      {{
        host
          ? $t('modelManager.authErrorHint', { host })
          : $t('modelManager.authErrorHintNoHost')
      }}
    </p>
    <p
      v-else-if="isFailed && download.error"
      class="relative text-xs wrap-break-word text-red-400"
    >
      {{ download.error }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import { useProgressBarBackground } from '@/composables/useProgressBarBackground'
import { formatSize } from '@/utils/formatUtil'

import { useModelDownloadActions } from '../composables/useModelDownloadActions'
import { providerForUrl } from '../downloadAuthProviders'
import { downloadProgressFraction } from '../stores/modelDownloadStore'
import type { DownloadProvider, DownloadStatus } from '../types'
import { directoryOf, filenameOf } from '../utils/modelId'

const { download } = defineProps<{ download: DownloadStatus }>()

const emit = defineEmits<{
  openAuth: [provider: DownloadProvider | undefined]
}>()

const { t } = useI18n()
const actions = useModelDownloadActions()
const {
  progressBarContainerClass,
  progressBarPrimaryClass,
  progressPercentStyle
} = useProgressBarBackground()

const directory = computed(() => directoryOf(download.model_id))
const filename = computed(() => filenameOf(download.model_id))

const host = computed(() => {
  try {
    return new URL(download.url).hostname
  } catch {
    return ''
  }
})

const provider = computed(() => providerForUrl(download.url))

const percent = computed(() => {
  const fraction = downloadProgressFraction(download)
  return fraction == null ? undefined : Math.round(fraction * 100)
})

const barStyle = computed(() => progressPercentStyle(percent.value))

const isTerminal = computed(() =>
  ['completed', 'cancelled'].includes(download.status)
)
const isCancelled = computed(() => download.status === 'cancelled')
const showProgressBar = computed(
  () =>
    download.status !== 'failed' &&
    !isCancelled.value &&
    percent.value !== undefined
)
const canPause = computed(() => ['queued', 'active'].includes(download.status))
const canResume = computed(() => ['paused', 'failed'].includes(download.status))
const canCancel = computed(
  () => !isTerminal.value && download.status !== 'failed'
)
const canRaisePriority = computed(() => download.status === 'queued')

// Matches an explicit statement that the model is gated, not HF's generic
// 404 boilerplate that merely suggests a missing file "might" be private or
// gated ("...If you are trying to access a private or gated repo, make sure
// you are authenticated and your Access Token has the right permissions."),
// which would otherwise mask the real 404 message behind both this hint and
// the auth-error hint below (that boilerplate also mentions "Access Token").
const GATED_MODEL_PATTERN =
  /is a gated (model|repo)|access .* is restricted|must have access|request access to/i
const NOT_FOUND_PATTERN = /\b404\b|not found/i
const AUTH_ERROR_PATTERN =
  /api key|credential|token|unauthor|forbidden|\b401\b|\b403\b/i

const isFailed = computed(() => download.status === 'failed')
const looksLikeNotFound = computed(() =>
  NOT_FOUND_PATTERN.test(download.error ?? '')
)
const isGatedModel = computed(
  () =>
    isFailed.value &&
    !looksLikeNotFound.value &&
    !!download.error?.match(GATED_MODEL_PATTERN)
)
const isAuthError = computed(
  () =>
    isFailed.value &&
    !looksLikeNotFound.value &&
    (isGatedModel.value || !!download.error?.match(AUTH_ERROR_PATTERN))
)

const HF_MODEL_URL_PATTERN =
  /https?:\/\/huggingface\.co\/([^/\s?#]+)\/([^/\s?#]+)/i
const modelPageUrl = computed(() => {
  const match = `${download.url} ${download.error ?? ''}`.match(
    HF_MODEL_URL_PATTERN
  )
  if (!match) return ''
  const [, owner, repo] = match
  return `https://huggingface.co/${owner}/${repo}`
})

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
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const secs = total % 60
  const paddedSecs = secs.toString().padStart(2, '0')
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${paddedSecs}`
  }
  return `${minutes}:${paddedSecs}`
}
</script>
