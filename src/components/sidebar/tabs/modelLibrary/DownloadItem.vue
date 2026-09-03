<template>
  <div class="flex flex-col">
    <div>
      {{ getDownloadLabel(download.savePath ?? '') }}
    </div>
    <div v-if="['cancelled', 'error'].includes(download.status ?? '')">
      <Chip
        variant="chip"
        class="mt-2 h-6 bg-red-700 text-sm font-light"
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
      <div
        role="progressbar"
        :aria-valuenow="downloadProgressPercent"
        aria-valuemin="0"
        aria-valuemax="100"
        class="flex-1"
      >
        <div class="h-5 overflow-hidden rounded-full bg-secondary-background">
          <div
            class="h-full bg-primary-background transition-[width]"
            :style="{ width: `${downloadProgressPercent}%` }"
          />
        </div>
        <span v-if="(download.progress ?? 0) > 0.1" class="text-xs">
          {{ downloadProgressPercent }}%
        </span>
      </div>

      <Tooltip
        v-if="download.status === 'in_progress'"
        :config="t('electronFileDownload.pause')"
        side="top"
      >
        <Button
          class="size-[22px] rounded-full"
          variant="secondary"
          size="icon-sm"
          :aria-label="t('electronFileDownload.pause')"
          @click="triggerPauseDownload"
        >
          <i class="icon-[lucide--pause] size-3" />
        </Button>
      </Tooltip>

      <Tooltip
        v-if="download.status === 'paused'"
        :config="t('electronFileDownload.resume')"
        side="top"
      >
        <Button
          class="size-[22px] rounded-full"
          variant="secondary"
          size="icon-sm"
          :aria-label="t('electronFileDownload.resume')"
          @click="triggerResumeDownload"
        >
          <i class="icon-[lucide--play] size-3" />
        </Button>
      </Tooltip>

      <Tooltip
        v-if="['in_progress', 'paused'].includes(download.status ?? '')"
        :config="t('electronFileDownload.cancel')"
        side="top"
      >
        <Button
          class="size-[22px] rounded-full"
          variant="destructive"
          size="icon-sm"
          :aria-label="t('electronFileDownload.cancel')"
          @click="triggerCancelDownload"
        >
          <i class="icon-[lucide--x-circle] size-3" />
        </Button>
      </Tooltip>
    </div>
  </div>
</template>

<script setup lang="ts">
import Tooltip from '@/components/ui/tooltip/Tooltip.vue'

import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import Chip from '@/components/ui/badge/Badge.vue'
import { useElectronDownloadStore } from '@/stores/electronDownloadStore'
import type { ElectronDownload } from '@/stores/electronDownloadStore'

const { t } = useI18n()

const electronDownloadStore = useElectronDownloadStore()

const props = defineProps<{
  download: ElectronDownload
}>()

const downloadProgressPercent = computed(() =>
  Number(((props.download.progress ?? 0) * 100).toFixed(1))
)

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
