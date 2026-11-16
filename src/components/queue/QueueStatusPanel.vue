<template>
  <div
    :class="
      cn(
        'absolute z-50 flex w-80 flex-col gap-1 rounded-xl bg-background p-2 shadow-lg',
        above ? 'bottom-full mb-1.5' : 'top-full mt-1.5',
        alignStart ? 'left-0' : 'right-0'
      )
    "
    data-testid="queue-status-panel"
  >
    <div class="flex h-8 items-center justify-between gap-2 pr-0.5 pl-3">
      <span
        class="min-w-0 truncate text-[11px] font-medium tracking-wide text-muted-foreground uppercase"
      >
        {{ t('queueStatus.activeGenerations') }}
      </span>
      <div v-if="hasBulkActions" class="flex shrink-0 items-center gap-0.5">
        <Button
          v-if="queuedCount > 0"
          variant="muted-textonly"
          size="sm"
          :class="headerButtonClass"
          data-testid="queue-status-clear-queue"
          @click="emit('clearQueue')"
        >
          {{ t('queueStatus.clearQueue') }}
        </Button>
        <Button
          variant="muted-textonly"
          size="sm"
          :class="headerButtonClass"
          data-testid="queue-status-cancel-all"
          @click="emit('cancelAll')"
        >
          {{ t('queueStatus.cancelAll') }}
        </Button>
      </div>
    </div>

    <QueueStatusRow
      v-for="(row, index) in rows"
      :key="row.job.id"
      :job="row.job"
      :subtitle="row.subtitle"
      :delay-ms="index * 35"
      @cancel="emit('cancel', row.job)"
      @details="emit('history')"
    />
  </div>
</template>

<script setup lang="ts">
import Button from '@comfyorg/design-system/button/Button'
import { cn } from '@comfyorg/tailwind-utils'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import QueueStatusRow from './QueueStatusRow.vue'
import type { JobView } from './queueStatusTypes'

const {
  rows,
  above = false,
  alignStart = false
} = defineProps<{
  rows: { job: JobView; subtitle: string }[]
  queuedCount: number
  above?: boolean
  alignStart?: boolean
}>()

const emit = defineEmits<{
  cancel: [job: JobView]
  clearQueue: []
  cancelAll: []
  history: []
}>()

const { t } = useI18n()
/** Failed rows stay visible but are not something "Cancel all" can stop. */
const activeRowCount = computed(
  () => rows.filter((row) => row.job.status !== 'failed').length
)
/** Clear queue and Cancel all only make sense with more than one job. */
const hasBulkActions = computed(() => activeRowCount.value > 1)
const headerButtonClass = 'h-7 px-1.5 font-medium'
</script>
