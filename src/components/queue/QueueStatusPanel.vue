<template>
  <div
    :class="
      cn(
        'absolute z-50 flex w-80 gap-2 px-2 pt-2 pb-3',
        above ? 'bottom-full flex-col-reverse' : 'top-full flex-col',
        alignStart ? 'left-0 -ml-2 items-start' : 'right-0 -mr-2 items-end'
      )
    "
    data-testid="queue-status-panel"
  >
    <QueueStatusRow
      v-for="(row, index) in rows"
      :key="row.job.id"
      :job="row.job"
      :subtitle="row.subtitle"
      :delay-ms="index * 35"
      @cancel="emit('cancel', row.job)"
      @details="emit('history')"
    />

    <div
      v-if="showFooter"
      class="job-toast-row flex w-full items-center justify-between gap-0.5 rounded-lg border border-foreground/10 bg-background p-1 shadow-md"
      :style="{ '--row-delay': `${rows.length * 35}ms` }"
      data-testid="queue-status-footer"
    >
      <Popover v-if="results.length" v-model:open="recentsOpen">
        <PopoverTrigger as-child>
          <Button
            variant="muted-textonly"
            size="sm"
            :class="cn(footerButtonClass, 'group')"
            data-testid="queue-status-recents-trigger"
          >
            <i class="icon-[lucide--images] size-3" aria-hidden />
            {{ t('queueStatus.resultsCount', { count: results.length }) }}
            <i
              class="icon-[lucide--chevron-down] size-3 transition-transform duration-200 group-data-[state=open]:rotate-180"
              aria-hidden
            />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          :align="alignStart ? 'start' : 'end'"
          :side="above ? 'top' : 'bottom'"
          :side-offset="8"
          :collision-padding="8"
          data-testid="queue-status-recents-panel"
          class="flex w-80 flex-col gap-2 rounded-lg border-foreground/9 p-2"
        >
          <QueueStatusRecents
            :results="results"
            @view="emit('view', $event)"
            @history="emit('history')"
          />
        </PopoverContent>
      </Popover>
      <span v-else aria-hidden />

      <div v-if="activeRowCount > 1" class="flex items-center gap-0.5">
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
        <span
          v-if="queuedCount > 0"
          class="mx-0.5 h-4 w-px bg-foreground/10"
          aria-hidden
        />
        <Button
          variant="muted-textonly"
          size="sm"
          :class="cn(footerButtonClass, 'hover:text-destructive')"
          data-testid="queue-status-cancel-all"
          @click="emit('cancelAll')"
        >
          <span class="size-3 rounded-xs bg-current" aria-hidden />
          {{ t('queueStatus.cancelAll') }}
        </Button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import Button from '@comfyorg/design-system/button/Button'
import { cn } from '@comfyorg/tailwind-utils'
import { PopoverRoot as Popover, PopoverTrigger } from 'reka-ui'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import PopoverContent from '@comfyorg/design-system/popover/PopoverContent'
import type { JobListItem } from '@/composables/queue/useJobList'

import QueueStatusRecents from './QueueStatusRecents.vue'
import QueueStatusRow from './QueueStatusRow.vue'
import type { JobView, RecentResult } from './queueStatusTypes'

const {
  rows,
  results,
  above = false,
  alignStart = false
} = defineProps<{
  rows: { job: JobView; subtitle: string }[]
  queuedCount: number
  results: RecentResult[]
  above?: boolean
  alignStart?: boolean
}>()

const emit = defineEmits<{
  cancel: [job: JobView]
  clearQueue: []
  cancelAll: []
  view: [job: JobListItem]
  history: []
}>()

const { t } = useI18n()
const recentsOpen = ref(false)
/** Failed rows stay visible but are not something "Cancel all" can stop. */
const activeRowCount = computed(
  () => rows.filter((row) => row.job.status !== 'failed').length
)
const showFooter = computed(
  () => activeRowCount.value > 1 || results.length > 0
)
const footerButtonClass =
  'gap-1 px-1.5 font-medium data-[state=open]:text-foreground'
</script>
