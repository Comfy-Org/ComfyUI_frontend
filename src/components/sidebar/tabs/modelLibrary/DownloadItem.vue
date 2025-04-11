<template>
  <div class="flex flex-col">
    <div>
      {{ getDownloadLabel(download.savePath ?? '') }}
    </div>
    <div v-if="['cancelled', 'error'].includes(download.status ?? '')">
      <Chip
        class="h-6 text-sm font-light bg-red-700 mt-2"
        removable
        @remove="handleRemoveDownload"
      >
        {{ t('electronFileDownload.cancelled') }}
      </Chip>
    </div>
    <div
      v-if="
        ['in_progress', 'paused', 'completed'].includes(download.status ?? '')
      "
      class="mt-2 flex flex-row items-center gap-2"
    >
      <!-- Temporary fix for issue when % only comes into view only if the progress bar is large enough
           https://comfy-organization.slack.com/archives/C07H3GLKDPF/p1731551013385499
      -->
      <ProgressBar
        class="flex-1"
        :value="Number(((download.progress ?? 0) * 100).toFixed(1))"
        :show-value="(download.progress ?? 0) > 0.1"
      />

      <Button
        v-if="download.status === 'in_progress'"
        v-tooltip.top="t('electronFileDownload.pause')"
        class="file-action-button w-[22px] h-[22px]"
        size="small"
        rounded
        icon="pi pi-pause"
        @click="triggerPauseDownload"
      />

      <Button
        v-if="download.status === 'paused'"
        v-tooltip.top="t('electronFileDownload.resume')"
        class="file-action-button w-[22px] h-[22px]"
        size="small"
        rounded
        icon="pi pi-play"
        @click="triggerResumeDownload"
      />

      <Button
        v-if="['in_progress', 'paused'].includes(download.status ?? '')"
        v-tooltip.top="t('electronFileDownload.cancel')"
        class="file-action-button w-[22px] h-[22px] p-red"
        size="small"
        rounded
        severity="danger"
        icon="pi pi-times-circle"
        @click="triggerCancelDownload"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import Chip from 'primevue/chip'
import ProgressBar from 'primevue/progressbar'
import { useI18n } from 'vue-i18n'

import {
  type ElectronDownload,
  useElectronDownloadStore
} from '@/stores/electronDownloadStore'

const { t } = useI18n()

const electronDownloadStore = useElectronDownloadStore()

const props = defineProps<{
  download: ElectronDownload
}>()

const getDownloadLabel = (savePath: string) => {
  let parts = savePath.split('/')
  parts = parts.length === 1 ? parts[0].split('\\') : parts
  const name = parts.pop()
  const dir = parts.pop()
  return `${dir}/${name}`
}

const triggerCancelDownload = () =>
  electronDownloadStore.cancel(props.download.url)
const triggerPauseDownload = () =>
  electronDownloadStore.pause(props.download.url)
const triggerResumeDownload = () =>
  electronDownloadStore.resume(props.download.url)

const handleRemoveDownload = () => {
  electronDownloadStore.$patch((state) => {
    state.downloads = state.downloads.filter(
      ({ url }) => url !== props.download.url
    )
  })
}
</script>
