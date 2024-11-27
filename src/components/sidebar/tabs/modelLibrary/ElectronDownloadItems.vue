<template>
  <div class="mx-6 mb-4" v-if="inProgressDownloads.length > 0">
    <div class="text-lg my-4">
      {{ $t('electronFileDownload.inProgress') }}
    </div>

    <template v-for="download in inProgressDownloads" :key="download.url">
      <DownloadItem :download="download" />
    </template>
  </div>
</template>

<script setup lang="ts">
import DownloadItem from './DownloadItem.vue'
import { useElectronDownloadStore } from '@/stores/electronDownloadStore'
import { storeToRefs } from 'pinia'

const electronDownloadStore = useElectronDownloadStore()
const { inProgressDownloads } = storeToRefs(electronDownloadStore)
</script>
