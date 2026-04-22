<template>
  <div
    :class="
      cn(
        'mt-2 flex w-full items-center gap-2 rounded-lg border px-2 py-1.5',
        isError
          ? 'border-red-700/40 bg-red-700/10'
          : 'border-border bg-muted/20'
      )
    "
    role="alert"
  >
    <i
      aria-hidden="true"
      :class="
        cn(
          'size-4 shrink-0',
          isError
            ? 'icon-[lucide--alert-circle] text-red-500'
            : 'icon-[lucide--x-circle] text-muted-foreground'
        )
      "
    />

    <div class="flex min-w-0 flex-1 flex-col">
      <span class="text-foreground truncate text-sm font-medium">
        {{
          isError
            ? t('electronFileDownload.failed')
            : t('electronFileDownload.cancelledNotice')
        }}
      </span>
      <span
        v-if="isError && download.message"
        class="truncate text-xs text-muted-foreground"
        :title="download.message"
      >
        {{ download.message }}
      </span>
    </div>

    <Button
      v-tooltip.top="t('electronFileDownload.retry')"
      variant="secondary"
      size="sm"
      class="h-7 shrink-0 rounded-md"
      :aria-label="t('electronFileDownload.retry')"
      @click="emit('retry')"
    >
      <i
        aria-hidden="true"
        class="text-foreground mr-1 icon-[lucide--rotate-ccw] size-3"
      />
      <span class="text-xs">{{ t('electronFileDownload.retry') }}</span>
    </Button>

    <Button
      v-tooltip.top="t('electronFileDownload.dismiss')"
      variant="textonly"
      size="icon-sm"
      class="size-7 shrink-0 rounded-full text-muted-foreground hover:text-base-foreground"
      :aria-label="t('electronFileDownload.dismiss')"
      @click="remove"
    >
      <i aria-hidden="true" class="icon-[lucide--x] size-3" />
    </Button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import { useElectronDownload } from '@/platform/electronDownload/composables/useElectronDownload'
import type { ElectronDownload } from '@/stores/electronDownloadStore'
import { cn } from '@/utils/tailwindUtil'

const { download } = defineProps<{
  download: ElectronDownload
}>()

const emit = defineEmits<{
  retry: []
}>()

const { t } = useI18n()

const { remove } = useElectronDownload(() => download.url)

const isError = computed(() => download.status === 'error')
</script>
