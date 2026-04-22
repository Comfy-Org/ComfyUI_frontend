<template>
  <div class="flex flex-col">
    <div>
      {{ getDownloadLabel(download.savePath ?? '') }}
    </div>
    <ElectronDownloadProgress :download />
  </div>
</template>

<script setup lang="ts">
import ElectronDownloadProgress from '@/platform/electronDownload/components/ElectronDownloadProgress.vue'
import type { ElectronDownload } from '@/platform/electronDownload/electronDownloadStore'

const { download } = defineProps<{
  download: ElectronDownload
}>()

const getDownloadLabel = (savePath: string) => {
  let parts = savePath.split('/')
  parts = parts.length === 1 ? parts[0].split('\\') : parts
  const name = parts.pop()
  const dir = parts.pop()
  return `${dir}/${name}`
}
</script>
