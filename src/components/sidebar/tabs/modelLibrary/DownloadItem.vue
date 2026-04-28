<template>
  <div class="flex flex-col py-1">
    <ElectronDownloadStoppedNotice
      v-if="isStopped"
      :download
      :show-retry="false"
    />
    <ElectronDownloadProgress v-else :download />
  </div>
</template>

<script setup lang="ts">
import { DownloadStatus } from '@comfyorg/comfyui-electron-types'
import { computed } from 'vue'

import ElectronDownloadProgress from '@/platform/electronDownload/components/ElectronDownloadProgress.vue'
import ElectronDownloadStoppedNotice from '@/platform/electronDownload/components/ElectronDownloadStoppedNotice.vue'
import type { ElectronDownload } from '@/platform/electronDownload/electronDownloadStore'

const { download } = defineProps<{
  download: ElectronDownload
}>()

const isStopped = computed(
  () =>
    download.status === DownloadStatus.ERROR ||
    download.status === DownloadStatus.CANCELLED
)
</script>
