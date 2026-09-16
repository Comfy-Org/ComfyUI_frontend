<template>
  <div
    class="absolute top-full right-0 z-50 -mr-2 flex w-80 flex-col items-end gap-2 px-2 pt-2 pb-3"
    data-testid="queue-status-panel"
  >
    <QueueStatusRow
      v-for="(row, index) in rows"
      :key="row.job.id"
      :job="row.job"
      :subtitle="row.subtitle"
      :delay-ms="index * 45"
      @cancel="emit('cancel', row.job)"
    />

    <div
      v-if="rows.length > 1"
      class="job-toast-row flex items-center gap-0.5 rounded-[10px] border border-base-foreground/10 bg-base-background/60 p-1 shadow-[0_2px_12px_rgba(0,0,0,0.25)] backdrop-blur-2xl"
      :style="{ '--row-delay': `${rows.length * 45}ms` }"
    >
      <button
        v-if="queuedCount > 0"
        type="button"
        class="flex cursor-pointer items-center gap-1.5 rounded-[7px] border-none bg-transparent px-2 py-1.5 text-[11.5px] font-medium text-muted-foreground transition-colors hover:bg-base-foreground/8 hover:text-base-foreground"
        data-testid="queue-status-clear-queue"
        @click="emit('clearQueue')"
      >
        <i class="icon-[lucide--eraser] size-3" aria-hidden />
        {{ t('queueStatus.clearQueue') }}
      </button>
      <button
        type="button"
        class="flex cursor-pointer items-center gap-1.5 rounded-[7px] border-none bg-transparent px-2 py-1.5 text-[11.5px] font-medium text-muted-foreground transition-colors hover:bg-base-foreground/8 hover:text-destructive-background"
        data-testid="queue-status-cancel-all"
        @click="emit('cancelAll')"
      >
        <span class="size-3 rounded-[2px] bg-current" aria-hidden />
        {{ t('queueStatus.cancelAll') }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import QueueStatusRow from './QueueStatusRow.vue'
import type { JobView } from './queueStatusTypes'

defineProps<{
  rows: { job: JobView; subtitle: string }[]
  queuedCount: number
}>()

const emit = defineEmits<{
  cancel: [job: JobView]
  clearQueue: []
  cancelAll: []
}>()

const { t } = useI18n()
</script>
