<template>
  <div class="flex flex-col">
    <div v-if="['cancelled', 'error'].includes(download.status ?? '')">
      <Chip
        class="mt-2 h-6 bg-red-700 text-sm font-light"
        removable
        @remove="remove"
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
        class="size-[22px] rounded-full"
        variant="secondary"
        size="icon-sm"
        :aria-label="t('electronFileDownload.pause')"
        @click="pause"
      >
        <i class="icon-[lucide--pause] size-3" />
      </Button>

      <Button
        v-if="download.status === 'paused'"
        v-tooltip.top="t('electronFileDownload.resume')"
        class="size-[22px] rounded-full"
        variant="secondary"
        size="icon-sm"
        :aria-label="t('electronFileDownload.resume')"
        @click="resume"
      >
        <i class="icon-[lucide--play] size-3" />
      </Button>

      <Button
        v-if="['in_progress', 'paused'].includes(download.status ?? '')"
        v-tooltip.top="t('electronFileDownload.cancel')"
        class="size-[22px] rounded-full"
        variant="destructive"
        size="icon-sm"
        :aria-label="t('electronFileDownload.cancel')"
        @click="cancel"
      >
        <i class="icon-[lucide--x-circle] size-3" />
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import Chip from 'primevue/chip'
import ProgressBar from 'primevue/progressbar'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import { useElectronDownload } from '@/platform/electronDownload/composables/useElectronDownload'
import type { ElectronDownload } from '@/platform/electronDownload/electronDownloadStore'

const { download } = defineProps<{
  download: ElectronDownload
}>()

const { t } = useI18n()

const { pause, resume, cancel, remove } = useElectronDownload(
  () => download.url
)
</script>
