<template>
  <div
    class="job-toast-row relative w-full overflow-hidden rounded-[10px] border border-base-foreground/9 bg-base-background/75 px-3 py-2 shadow-[0_4px_16px_rgba(0,0,0,0.3)] backdrop-blur-xl transition-colors hover:bg-secondary-background/80"
    :style="{ '--row-delay': `${delayMs}ms` }"
    data-testid="queue-status-row"
  >
    <div class="flex items-center gap-2">
      <span class="flex size-4 shrink-0 items-center justify-center">
        <span
          v-if="job.status === 'running'"
          class="inline-block size-[13px] animate-spin rounded-full border-2 border-base-foreground/20 border-t-base-foreground/80"
          aria-hidden
        />
        <span
          v-else
          class="size-1.5 rounded-full bg-muted-foreground"
          aria-hidden
        />
      </span>

      <div class="flex min-w-0 flex-1 flex-col gap-0.5">
        <span class="truncate text-[13px] leading-none text-base-foreground">
          {{ job.title }}
        </span>
        <span class="truncate text-[11px] leading-none text-muted-foreground">
          {{ subtitle }}
        </span>
      </div>

      <button
        type="button"
        class="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-[6px] border-none bg-transparent p-0 text-muted-foreground transition-colors hover:bg-base-foreground/8 hover:text-base-foreground"
        :aria-label="`${t('queueStatus.cancel')} ${job.title}`"
        data-testid="queue-status-row-cancel"
        @click="emit('cancel')"
      >
        <span class="size-3 rounded-[2px] bg-current" aria-hidden />
      </button>
    </div>

    <div
      v-if="job.status === 'running'"
      class="pointer-events-none absolute bottom-0 left-0 h-px bg-base-foreground/70 transition-[width] duration-200 ease-out"
      :style="{ width: `${job.progress}%` }"
      aria-hidden
    />
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import type { JobView } from './queueStatusTypes'

defineProps<{
  job: JobView
  subtitle: string
  delayMs: number
}>()

const emit = defineEmits<{ cancel: [] }>()

const { t } = useI18n()
</script>
