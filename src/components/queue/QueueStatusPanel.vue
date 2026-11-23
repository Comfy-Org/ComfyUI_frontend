<template>
  <div
    :class="
      cn(
        'absolute z-50 flex w-80 flex-col rounded-xl border border-foreground/10 bg-background p-1.5 shadow-lg',
        above ? 'bottom-full mb-1.5' : 'top-full mt-1.5',
        alignStart ? 'left-0' : 'right-0'
      )
    "
    role="region"
    :aria-label="t('queueStatus.activeGenerations')"
    data-testid="queue-status-panel"
  >
    <div
      class="flex max-h-[min(60vh,26rem)] flex-col gap-1.5 overflow-y-auto"
      data-testid="queue-status-panel-rows"
    >
      <template v-for="(row, index) in rows" :key="row.job.id">
        <div
          v-if="row.job.id === firstPlanHeldId"
          class="flex min-h-7 w-full shrink-0 items-center justify-between gap-2 pr-1.5 pl-3 text-xs text-muted-foreground"
          data-testid="queue-status-plan-limit-note"
        >
          <span class="min-w-0 truncate">{{ planLimitNote }}</span>
          <Button
            variant="muted-textonly"
            size="sm"
            class="h-7 shrink-0 hover:text-foreground"
            data-testid="queue-status-plan-limit-upgrade"
            @click="emit('upgrade')"
          >
            {{ t('queueStatus.upgrade') }}
          </Button>
        </div>
        <QueueStatusRow
          :job="row.job"
          :subtitle="row.subtitle"
          :delay-ms="index * 35"
          @cancel="emit('cancel', row.job)"
          @details="emit('history')"
        />
      </template>
    </div>

    <div
      class="-mx-1.5 mt-1.5 flex h-10 items-center justify-between gap-2 border-t border-foreground/10 px-2.5 pt-1"
      data-testid="queue-status-panel-footer"
    >
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
          <i
            class="icon-[lucide--x] size-3.5"
            data-testid="queue-status-clear-queue-icon"
            aria-hidden
          />
          {{ t('queueStatus.clearQueue') }}
        </Button>
        <Button
          variant="muted-textonly"
          size="sm"
          :class="footerButtonClass"
          data-testid="queue-status-cancel-all"
          @click="emit('cancelAll')"
        >
          <span
            class="size-2.5 rounded-[2px] bg-current"
            data-testid="queue-status-cancel-all-icon"
            aria-hidden
          />
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
  alignStart = false,
  planRunLimit
} = defineProps<{
  rows: { job: JobView; subtitle: string }[]
  queuedCount: number
  above?: boolean
  alignStart?: boolean
  planRunLimit?: number
}>()

const emit = defineEmits<{
  cancel: [job: JobView]
  clearQueue: []
  cancelAll: []
  history: []
  upgrade: []
}>()

const { t } = useI18n()
/** Failed rows stay visible but are not something "Cancel all" can stop. */
const activeRowCount = computed(
  () => rows.filter((row) => row.job.status !== 'failed').length
)
/** Clear queue and Cancel all only make sense with more than one job. */
const hasBulkActions = computed(() => activeRowCount.value > 1)
const firstPlanHeldId = computed(
  () =>
    rows.find((row) => row.job.status === 'held' && row.job.heldBy === 'plan')
      ?.job.id
)
const planLimitNote = computed(() =>
  planRunLimit === undefined
    ? t('queueStatus.planLimitFull')
    : t('queueStatus.planLimitRuns', { limit: planRunLimit })
)
const footerButtonClass = 'h-7 gap-1.5 hover:text-foreground'
</script>
