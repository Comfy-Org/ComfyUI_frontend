<template>
  <div
    :class="
      cn(
        'bg-foreground/5 w-full rounded-lg border border-interface-stroke p-2',
        isError &&
          'border-destructive-background/40 bg-destructive-background/10'
      )
    "
    :role="isError ? 'alert' : 'status'"
  >
    <div class="flex items-center gap-2">
      <i
        aria-hidden="true"
        :class="
          cn(
            'size-4 shrink-0',
            isError
              ? 'icon-[lucide--circle-alert] text-destructive-background'
              : 'icon-[lucide--minus] text-muted-foreground'
          )
        "
      />

      <div class="min-w-0 flex-1">
        <div class="truncate text-xs font-medium text-text-primary">
          {{ download.filename }}
        </div>
        <div
          class="mt-0.5 truncate text-2xs"
          :class="
            isError ? 'text-destructive-background' : 'text-muted-foreground'
          "
          :title="download.message"
        >
          {{
            isError
              ? download.message || t('electronFileDownload.failed')
              : t('electronFileDownload.cancelledNotice')
          }}
        </div>
      </div>

      <div class="flex shrink-0 items-center gap-1">
        <Button
          v-if="showRetry"
          v-tooltip.top="t('electronFileDownload.retry')"
          variant="secondary"
          size="icon-sm"
          class="size-7 rounded-md"
          :aria-label="t('electronFileDownload.retry')"
          @click="emit('retry')"
        >
          <i aria-hidden="true" class="icon-[lucide--rotate-ccw] size-3" />
        </Button>

        <Button
          v-tooltip.top="t('electronFileDownload.dismiss')"
          variant="textonly"
          size="icon-sm"
          class="size-7 shrink-0 rounded-md text-muted-foreground hover:text-base-foreground"
          :aria-label="t('electronFileDownload.dismiss')"
          @click="remove"
        >
          <i aria-hidden="true" class="icon-[lucide--x] size-3" />
        </Button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { DownloadStatus } from '@comfyorg/comfyui-electron-types'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import { useElectronDownloadStore } from '@/platform/electronDownload/electronDownloadStore'
import type { ElectronDownload } from '@/platform/electronDownload/electronDownloadStore'
import { cn } from '@comfyorg/tailwind-utils'

const { download, showRetry = true } = defineProps<{
  download: ElectronDownload
  showRetry?: boolean
}>()

const emit = defineEmits<{
  retry: []
}>()

const { t } = useI18n()

const store = useElectronDownloadStore()
const remove = () => store.remove(download.url)

const isError = computed(() => download.status === DownloadStatus.ERROR)
</script>
