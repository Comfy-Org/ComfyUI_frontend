<!-- A Electron-backed download button with a label, size hint and progress bar -->
<template>
  <div class="flex flex-col">
    <div class="flex flex-row items-center gap-2">
      <div class="file-info">
        <div class="file-details">
          <span class="file-type" :title="hint">{{ label }}</span>
        </div>
        <div v-if="props.error" class="file-error">
          {{ props.error }}
        </div>
      </div>

      <div class="file-action">
        <Button
          class="file-action-button"
          :label="$t('download') + ' (' + fileSize + ')'"
          size="small"
          outlined
          :disabled="props.error"
          @click="triggerDownload"
          v-if="status === null || status === 'error'"
          icon="pi pi-download"
        />
      </div>
    </div>
    <div
      class="flex flex-row items-center gap-2"
      v-if="status === 'in_progress' || status === 'paused'"
    >
      <ProgressBar class="flex-1" :value="downloadProgress" />

      <Button
        class="file-action-button"
        size="small"
        outlined
        :disabled="props.error"
        @click="triggerPauseDownload"
        v-if="status === 'in_progress'"
        icon="pi pi-pause-circle"
        v-tooltip.top="t('electronFileDownload.pause')"
      />

      <Button
        class="file-action-button"
        size="small"
        outlined
        :disabled="props.error"
        @click="triggerResumeDownload"
        v-if="status === 'paused'"
        icon="pi pi-play-circle"
        v-tooltip.top="t('electronFileDownload.resume')"
      />

      <Button
        class="file-action-button"
        size="small"
        outlined
        :disabled="props.error"
        @click="triggerCancelDownload"
        icon="pi pi-times-circle"
        v-tooltip.top="t('electronFileDownload.cancel')"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useDownload } from '@/hooks/downloadHooks'
import Button from 'primevue/button'
import ProgressBar from 'primevue/progressbar'
import { ref, computed } from 'vue'
import { formatSize } from '@/utils/formatUtil'
import { useI18n } from 'vue-i18n'
import { electronAPI } from '@/utils/envUtil'

const props = defineProps<{
  url: string
  hint?: string
  label?: string
  error?: string
}>()

interface ModelDownload {
  url: string
  status: 'paused' | 'in_progress' | 'cancelled'
  progress: number
}

const { t } = useI18n()
const { DownloadManager } = electronAPI()
const label = computed(() => props.label || props.url.split('/').pop())
const hint = computed(() => props.hint || props.url)
const download = useDownload(props.url)
const status = ref<ModelDownload | null>(null)
const downloadProgress = ref<number>(0)
const fileSize = computed(() =>
  download.fileSize.value ? formatSize(download.fileSize.value) : '?'
)
const [savePath, filename] = props.label.split('/')

const downloads: ModelDownload[] = await DownloadManager.getAllDownloads()
const modelDownload = downloads.find(({ url }) => url === props.url)

const updateProperties = (download: ModelDownload) => {
  if (download.url === props.url) {
    status.value = download.status
    downloadProgress.value = (download.progress * 100).toFixed(1)
  }
}

DownloadManager.onDownloadProgress((data: ModelDownload) => {
  updateProperties(data)
})

const triggerDownload = async () => {
  await DownloadManager.startDownload(
    props.url,
    filename.trim(),
    savePath.trim()
  )
}

const triggerCancelDownload = async () => {
  await DownloadManager.cancelDownload(props.url)
}

const triggerPauseDownload = async () => {
  await DownloadManager.pauseDownload(props.url)
}

const triggerResumeDownload = async () => {
  await DownloadManager.resumeDownload(props.url)
}
</script>
