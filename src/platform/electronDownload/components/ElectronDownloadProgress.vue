<template>
  <div
    class="bg-foreground/5 w-full rounded-lg border border-interface-stroke p-2"
    :aria-busy="isBusy"
  >
    <div class="flex items-center gap-2">
      <i aria-hidden="true" :class="cn('size-4 shrink-0', statusIconClass)" />

      <div class="min-w-0 flex-1">
        <div class="flex min-w-0 items-center gap-1.5">
          <div class="truncate text-xs font-medium text-text-primary">
            {{ download.filename }}
          </div>
          <span
            v-if="formattedFileSize"
            class="shrink-0 rounded-md bg-secondary-background-selected px-1.5 py-0.5 text-2xs font-medium text-muted-foreground"
          >
            {{ formattedFileSize }}
          </span>
        </div>
        <div
          v-if="download.savePath"
          class="mt-0.5 truncate text-2xs text-muted-foreground"
          :title="download.savePath"
        >
          {{ downloadLabel }}
        </div>
      </div>

      <div class="flex shrink-0 items-center gap-1">
        <Button
          v-if="download.status === DownloadStatus.IN_PROGRESS"
          v-tooltip.top="t('electronFileDownload.pause')"
          class="size-7 rounded-md"
          variant="secondary"
          size="icon-sm"
          :aria-label="t('electronFileDownload.pause')"
          @click="pause"
        >
          <i aria-hidden="true" class="icon-[lucide--pause] size-3" />
        </Button>

        <Button
          v-if="download.status === DownloadStatus.PAUSED"
          v-tooltip.top="t('electronFileDownload.resume')"
          class="size-7 rounded-md"
          variant="secondary"
          size="icon-sm"
          :aria-label="t('electronFileDownload.resume')"
          @click="resume"
        >
          <i aria-hidden="true" class="icon-[lucide--play] size-3" />
        </Button>

        <Button
          v-if="isCancellable"
          v-tooltip.top="t('electronFileDownload.cancel')"
          class="size-7 rounded-md"
          variant="destructive"
          size="icon-sm"
          :aria-label="t('electronFileDownload.cancel')"
          @click="cancel"
        >
          <i aria-hidden="true" class="icon-[lucide--x] size-3" />
        </Button>
      </div>
    </div>

    <div
      class="mt-2 h-1 overflow-hidden rounded-full bg-muted-foreground/20"
      role="progressbar"
      :aria-label="progressAriaLabel"
      aria-valuemin="0"
      aria-valuemax="100"
      :aria-valuenow="progressAriaNow"
    >
      <div
        :class="
          cn(
            'h-full rounded-full transition-[width] duration-300 ease-linear',
            progressFillClass,
            download.status === DownloadStatus.PENDING && 'animate-pulse'
          )
        "
        :style="{ width: progressWidth }"
      />
    </div>

    <div
      class="mt-1 truncate text-2xs"
      :class="statusTextClass"
      aria-live="polite"
      aria-atomic="true"
    >
      {{ statusLabel }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { DownloadStatus } from '@comfyorg/comfyui-electron-types'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { cn } from '@comfyorg/tailwind-utils'

import Button from '@/components/ui/button/Button.vue'
import { useElectronDownloadStore } from '@/platform/electronDownload/electronDownloadStore'
import type { ElectronDownload } from '@/platform/electronDownload/electronDownloadStore'
import { formatSize } from '@/utils/formatUtil'

const { download, fileSize = null } = defineProps<{
  download: ElectronDownload
  fileSize?: number | null
}>()

const { t } = useI18n()
const store = useElectronDownloadStore()

const pause = () => store.pause(download.url)
const resume = () => store.resume(download.url)
const cancel = () => store.cancel(download.url)

const progressPercent = computed(() =>
  Math.round((download.progress ?? 0) * 100)
)

const clampedProgressPercent = computed(() =>
  Math.min(100, Math.max(0, progressPercent.value))
)

const progressWidth = computed(() => {
  if (download.status === DownloadStatus.PENDING) return '0%'
  if (download.status === DownloadStatus.COMPLETED) return '100%'
  return `${clampedProgressPercent.value}%`
})

const progressAriaNow = computed(() =>
  download.status === DownloadStatus.PENDING
    ? undefined
    : download.status === DownloadStatus.COMPLETED
      ? 100
      : clampedProgressPercent.value
)

const progressAriaLabel = computed(() => {
  switch (download.status) {
    case DownloadStatus.COMPLETED:
      return t('electronFileDownload.completed')
    case DownloadStatus.PAUSED:
      return t('electronFileDownload.paused')
    case DownloadStatus.PENDING:
      return t('electronFileDownload.pending')
    case DownloadStatus.IN_PROGRESS:
    default:
      return t('electronFileDownload.inProgress')
  }
})

const isCancellable = computed(
  () =>
    download.status === DownloadStatus.PENDING ||
    download.status === DownloadStatus.IN_PROGRESS ||
    download.status === DownloadStatus.PAUSED
)

const isBusy = computed(
  () =>
    download.status === DownloadStatus.PENDING ||
    download.status === DownloadStatus.IN_PROGRESS
)

const downloadLabel = computed(() => {
  const savePath = download.savePath
  if (!savePath) return ''

  const parts = savePath.split(/[\\/]/).filter(Boolean)
  const name = parts.pop()
  const dir = parts.pop()
  return dir && name ? `${dir}/${name}` : (name ?? savePath)
})

const formattedFileSize = computed(() =>
  fileSize != null && fileSize > 0 ? formatSize(fileSize) : ''
)

const statusLabel = computed(() => {
  switch (download.status) {
    case DownloadStatus.PENDING:
      return t('electronFileDownload.pending')
    case DownloadStatus.PAUSED:
      return `${t('electronFileDownload.paused')} · ${progressPercent.value}%`
    case DownloadStatus.COMPLETED:
      return t('electronFileDownload.completed')
    case DownloadStatus.ERROR:
      return download.message || t('electronFileDownload.failed')
    case DownloadStatus.CANCELLED:
      return t('electronFileDownload.cancelledNotice')
    case DownloadStatus.IN_PROGRESS:
    default:
      return `${t('electronFileDownload.inProgress')} · ${progressPercent.value}%`
  }
})

const statusIconClass = computed(() => {
  switch (download.status) {
    case DownloadStatus.PAUSED:
      return 'icon-[lucide--pause] text-warning-background'
    case DownloadStatus.COMPLETED:
      return 'icon-[lucide--check] text-success-background'
    case DownloadStatus.ERROR:
      return 'icon-[lucide--x] text-destructive-background'
    case DownloadStatus.CANCELLED:
      return 'icon-[lucide--minus] text-muted-foreground'
    case DownloadStatus.PENDING:
    case DownloadStatus.IN_PROGRESS:
    default:
      return 'icon-[lucide--download] text-primary-background'
  }
})

const progressFillClass = computed(() => {
  switch (download.status) {
    case DownloadStatus.PAUSED:
      return 'bg-warning-background'
    case DownloadStatus.COMPLETED:
      return 'bg-success-background'
    case DownloadStatus.ERROR:
      return 'bg-destructive-background'
    case DownloadStatus.CANCELLED:
      return 'bg-muted-foreground'
    case DownloadStatus.PENDING:
    case DownloadStatus.IN_PROGRESS:
    default:
      return 'bg-primary-background'
  }
})

const statusTextClass = computed(() => {
  switch (download.status) {
    case DownloadStatus.PAUSED:
      return 'text-warning-background'
    case DownloadStatus.COMPLETED:
      return 'text-success-background'
    case DownloadStatus.ERROR:
      return 'text-destructive-background'
    case DownloadStatus.CANCELLED:
      return 'text-muted-foreground'
    case DownloadStatus.PENDING:
    case DownloadStatus.IN_PROGRESS:
    default:
      return 'text-muted-foreground'
  }
})
</script>
