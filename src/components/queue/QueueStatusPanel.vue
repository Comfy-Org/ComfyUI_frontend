<template>
  <div
    :class="
      cn(
        'absolute z-50 flex w-80 flex-col rounded-xl bg-background p-1.5 shadow-lg',
        above ? 'bottom-full mb-1.5' : 'top-full mt-1.5',
        alignStart ? 'left-0' : 'right-0'
      )
    "
    data-testid="queue-status-panel"
  >
    <span
      class="flex h-8 items-center px-3 text-[11px] font-medium tracking-wider text-muted-foreground uppercase"
    >
      {{ t('queueStatus.activeGenerations') }}
    </span>

    <div class="flex flex-col gap-0.5">
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

    <div class="mt-1 flex h-9 items-center justify-between gap-2 px-1">
      <Button
        variant="muted-textonly"
        size="sm"
        :class="footerButtonClass"
        data-testid="queue-status-panel-history"
        @click="emit('history')"
      >
        <i class="icon-[lucide--history] size-3.5" aria-hidden />
        {{ t('queueStatus.goToHistoryShort') }}
      </Button>
      <div v-if="hasBulkActions" class="flex shrink-0 items-center gap-0.5">
        <Button
          v-if="queuedCount > 0"
          variant="muted-textonly"
          size="sm"
          :class="footerButtonClass"
          data-testid="queue-status-clear-queue"
          @click="emit('clearQueue')"
        >
          {{ t('queueStatus.clearQueue') }}
        </Button>
        <Button
          variant="muted-textonly"
          size="sm"
          :class="footerButtonClass"
          data-testid="queue-status-cancel-all"
          @click="emit('cancelAll')"
        >
          {{ t('queueStatus.cancelAll') }}
        </Button>
      </div>
    </div>
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
const footerButtonClass = 'h-7 gap-1.5 hover:text-foreground'
</script>
