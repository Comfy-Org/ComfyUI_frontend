<template>
  <div class="flex w-full flex-col gap-1">
    <span
      class="px-1.5 pt-0.5 pb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase"
    >
      {{ t('queueStatus.recentResults') }}
    </span>

    <template v-if="results.length">
      <button
        v-for="result in results"
        :key="result.id"
        type="button"
        class="relative flex cursor-pointer items-center gap-2.5 overflow-hidden rounded-lg border-none bg-transparent px-1.5 py-2 text-left transition-colors hover:bg-secondary-background"
        data-testid="queue-status-recent-job"
        @click="emit('view', result.job)"
      >
        <span
          v-if="result.thumbSrc"
          class="relative flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-sm bg-base-background outline-1 outline-base-foreground/10"
        >
          <img
            :src="result.thumbSrc"
            alt=""
            loading="lazy"
            class="size-full object-cover"
          />
          <i
            v-if="result.isVideo"
            class="absolute right-0.5 bottom-0.5 icon-[lucide--play] size-2.5 text-base-foreground drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]"
            aria-hidden
          />
        </span>
        <span class="flex min-w-0 flex-1 flex-col gap-0.5">
          <span class="truncate text-sm/5 text-base-foreground">
            {{ result.name }}
          </span>
          <span class="truncate text-xs/4 text-muted-foreground">
            {{ result.meta }}
          </span>
        </span>
      </button>
    </template>
    <p v-else class="px-1.5 py-3 text-center text-xs text-muted-foreground">
      {{ t('queueStatus.nothingRunning') }}
    </p>
  </div>

  <div
    class="flex w-full items-center justify-center border-t border-base-foreground/6 pt-1.5"
  >
    <button
      type="button"
      class="flex cursor-pointer items-center gap-1.5 rounded-sm border-none bg-transparent px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-base-foreground/6 hover:text-base-foreground"
      data-testid="queue-status-go-history"
      @click="emit('history')"
    >
      <i class="icon-[lucide--history] size-3" aria-hidden />
      {{ t('queueStatus.goToHistoryShort') }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import type { JobListItem } from '@/composables/queue/useJobList'

import type { RecentResult } from './queueStatusTypes'

defineProps<{ results: RecentResult[] }>()

const emit = defineEmits<{
  view: [job: JobListItem]
  history: []
}>()

const { t } = useI18n()
</script>
