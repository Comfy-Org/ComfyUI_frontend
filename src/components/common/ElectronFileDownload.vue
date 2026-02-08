<!-- A Electron-backed download button with a label, size hint and progress bar -->
<template>
  <div class="flex flex-col">
    <div class="flex flex-row items-center gap-2">
      <i v-if="status === 'completed'" class="pi pi-check text-green-500" />
      <div class="file-info">
        <div class="file-details">
          <span class="file-type" :title="displayHint">{{ displayLabel }}</span>
        </div>
        <div v-if="error" class="file-error">
          {{ error }}
        </div>
      </div>

      <div class="file-action flex flex-row items-center gap-2">
        <Button
          v-if="status === null || status === 'error'"
          class="file-action-button"
          variant="secondary"
          size="sm"
          :disabled="!!error"
          @click="triggerDownload"
        >
          <i class="pi pi-download" />
          {{ $t('g.downloadWithSize', { size: fileSize }) }}
        </Button>
        <Button
          v-if="(status === null || status === 'error') && !!url"
          variant="secondary"
          size="sm"
          @click="copyURL"
        >
          {{ $t('g.copyURL') }}
        </Button>
      </div>
    </div>
    <div
      v-if="status === 'in_progress' || status === 'paused'"
      class="flex flex-row items-center gap-2"
    >
      <!-- Temporary fix for issue when % only comes into view only if the progress bar is large enough
           https://comfy-organization.slack.com/archives/C07H3GLKDPF/p1731551013385499
      -->
      <ProgressBar
        class="flex-1"
        :value="downloadProgress"
        :show-value="downloadProgress > 10"
      />

      <Button
        v-if="status === 'in_progress'"
        v-tooltip.top="t('electronFileDownload.pause')"
        class="file-action-button"
        variant="secondary"
        size="sm"
        :disabled="!!error"
        @click="triggerPauseDownload"
      >
        <i class="pi pi-pause-circle" />
      </Button>

      <Button
        v-if="status === 'paused'"
        v-tooltip.top="t('electronFileDownload.resume')"
        class="file-action-button"
        variant="secondary"
        size="sm"
        :aria-label="t('electronFileDownload.resume')"
        :disabled="!!error"
        @click="triggerResumeDownload"
      >
        <i class="pi pi-play-circle" />
      </Button>

      <Button
        v-tooltip.top="t('electronFileDownload.cancel')"
        class="file-action-button"
        variant="destructive"
        size="sm"
        :aria-label="t('electronFileDownload.cancel')"
        :disabled="!!error"
        @click="triggerCancelDownload"
      >
        <i class="pi pi-times-circle" />
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import ProgressBar from 'primevue/progressbar'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import { useCopyToClipboard } from '@/composables/useCopyToClipboard'
import { useDownload } from '@/composables/useDownload'
import { useElectronDownloadStore } from '@/stores/electronDownloadStore'
import { formatSize } from '@/utils/formatUtil'

const { url, hint, label, error } = defineProps<{
  url: string
  hint?: string
  label?: string
  error?: string
}>()

const { t } = useI18n()
const displayLabel = computed(() => label || url.split('/').pop())
const displayHint = computed(() => hint || url)
const download = useDownload(url)
const downloadProgress = ref<number>(0)
const status = ref<string | null>(null)
const fileSize = computed(() =>
  download.fileSize.value ? formatSize(download.fileSize.value) : '?'
)
const { copyToClipboard } = useCopyToClipboard()
const electronDownloadStore = useElectronDownloadStore()
// @ts-expect-error fixme ts strict error
const [savePath, filename] = label.split('/')

electronDownloadStore.$subscribe((_, { downloads }) => {
  const download = downloads.find((download) => url === download.url)

  if (download) {
    // @ts-expect-error fixme ts strict error
    downloadProgress.value = Number((download.progress * 100).toFixed(1))
    // @ts-expect-error fixme ts strict error
    status.value = download.status
  }
})

const triggerDownload = async () => {
  await electronDownloadStore.start({
    url,
    savePath: savePath.trim(),
    filename: filename.trim()
  })
}

const triggerCancelDownload = () => electronDownloadStore.cancel(url)
const triggerPauseDownload = () => electronDownloadStore.pause(url)
const triggerResumeDownload = () => electronDownloadStore.resume(url)

const copyURL = async () => {
  await copyToClipboard(url)
}
</script>
