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
    />

    <div
      v-if="showFooter"
      class="job-toast-row flex w-full items-center justify-between gap-0.5 rounded-lg border border-base-foreground/10 bg-base-background/60 p-1 shadow-interface backdrop-blur-2xl"
      :style="{ '--row-delay': `${rows.length * 35}ms` }"
      data-testid="queue-status-footer"
    >
      <Popover v-if="results.length" v-model:open="recentsOpen">
        <PopoverTrigger as-child>
          <button
            type="button"
            :class="cn(footerButtonClass, 'group hover:bg-base-foreground/8')"
            data-testid="queue-status-recents-trigger"
          >
            <i class="icon-[lucide--images] size-3" aria-hidden />
            {{ t('queueStatus.resultsCount', { count: results.length }) }}
            <i
              class="icon-[lucide--chevron-down] size-3 transition-transform duration-200 group-data-[state=open]:rotate-180"
              aria-hidden
            />
          </button>
        </PopoverTrigger>
        <PopoverContent
          :align="alignStart ? 'start' : 'end'"
          :side="above ? 'top' : 'bottom'"
          :side-offset="8"
          :collision-padding="8"
          data-testid="queue-status-recents-panel"
          class="z-1300 flex w-80 flex-col gap-2 rounded-lg border border-base-foreground/9 bg-base-background/80 p-2 shadow-interface backdrop-blur-xl"
        >
          <QueueStatusRecents
            :results="results"
            @view="emit('view', $event)"
            @history="emit('history')"
          />
        </PopoverContent>
      </Popover>
      <span v-else aria-hidden />

      <div v-if="rows.length > 1" class="flex items-center gap-1">
        <button
          v-if="queuedCount > 0"
          type="button"
          :class="cn(footerButtonClass, 'hover:bg-base-foreground/8')"
          data-testid="queue-status-clear-queue"
          @click="emit('clearQueue')"
        >
          {{ t('queueStatus.clearQueue') }}
        </button>
        <span
          v-if="queuedCount > 0"
          class="mx-0.5 h-4 w-px bg-base-foreground/10"
          aria-hidden
        />
        <button
          type="button"
          :class="
            cn(
              footerButtonClass,
              'hover:bg-destructive-background/12 hover:text-destructive-background'
            )
          "
          data-testid="queue-status-cancel-all"
          @click="emit('cancelAll')"
        >
          <span class="size-3 rounded-xs bg-current" aria-hidden />
          {{ t('queueStatus.cancelAll') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { PopoverTrigger } from 'reka-ui'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import Popover from '@/components/ui/popover/Popover.vue'
import PopoverContent from '@/components/ui/popover/PopoverContent.vue'
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
const showFooter = computed(() => rows.length > 1 || results.length > 0)
const footerButtonClass =
  'flex cursor-pointer items-center gap-1.5 rounded-sm border-none bg-transparent px-1.5 py-1.5 text-xs font-medium whitespace-nowrap text-muted-foreground transition-colors hover:text-base-foreground data-[state=open]:text-base-foreground'
</script>
