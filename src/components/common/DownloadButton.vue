<template>
  <div class="download-button-container">
    <Button
      v-if="download.downloadState.value == DownloadState.Idle"
      @click="triggerDownload"
      :label="props.idleLabel"
      size="small"
      outlined
      class="download-button"
    />
    <div
      v-if="download.downloadState.value == DownloadState.Downloading"
      class="download-progress"
    >
      <span class="progress-text"
        >{{ download.progress.value.toFixed(2) }}%</span
      >
    </div>
    <div
      v-if="download.downloadState.value == DownloadState.Completed"
      class="download-complete"
    >
      <i class="pi pi-check"></i>
    </div>
    <div
      v-if="download.downloadState.value == DownloadState.Error"
      class="download-error"
    >
      <i class="pi pi-times"></i>
    </div>
  </div>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import { useDownload, DownloadState, DownloadTask } from '@/hooks/downloadHooks'

const props = defineProps<{
  downloadTask: DownloadTask
  idleLabel: string
}>()

const download = useDownload()
const triggerDownload = () => {
  download.triggerDownload(props.downloadTask)
}
</script>

<style scoped>
.download-button-container > * {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 80px;
}

.pi.pi-times {
  font-size: 1.2rem;
  color: var(--p-red-600);
}

.pi.pi-check {
  font-size: 1.2rem;
  color: var(--p-green-500);
}

.progress-text {
  font-size: 0.8rem;
  color: var(--text-color);
}
</style>
