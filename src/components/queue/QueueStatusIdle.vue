<template>
  <Popover v-model:open="open">
    <PopoverTrigger as-child>
      <button
        type="button"
        data-testid="queue-status-idle"
        :aria-expanded="open"
        class="group pointer-events-auto flex cursor-pointer items-center gap-1 rounded-lg border border-solid border-base-foreground/9 bg-base-background/80 px-2 py-1 text-sm/5 text-base-foreground backdrop-blur-xl transition-colors hover:bg-secondary-background/80 data-[state=open]:bg-secondary-background/80"
      >
        {{ label }}
        <i
          class="icon-[lucide--chevron-down] size-3.5 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180"
          aria-hidden
        />
      </button>
    </PopoverTrigger>
    <PopoverContent
      :align="align"
      side="bottom"
      :side-offset="8"
      :collision-padding="8"
      data-testid="queue-status-idle-panel"
      class="z-1300 flex w-80 flex-col gap-2 rounded-lg border border-base-foreground/9 bg-base-background/80 p-2 shadow-interface backdrop-blur-xl"
    >
      <QueueStatusRecents
        :results="results"
        @view="emit('view', $event)"
        @history="emit('history')"
      />
    </PopoverContent>
  </Popover>
</template>

<script setup lang="ts">
import { PopoverTrigger } from 'reka-ui'

import Popover from '@/components/ui/popover/Popover.vue'
import PopoverContent from '@/components/ui/popover/PopoverContent.vue'
import type { JobListItem } from '@/composables/queue/useJobList'

import QueueStatusRecents from './QueueStatusRecents.vue'
import type { RecentResult } from './queueStatusTypes'

const { align = 'end' } = defineProps<{
  label: string
  results: RecentResult[]
  align?: 'start' | 'end'
}>()

const open = defineModel<boolean>('open', { required: true })

const emit = defineEmits<{
  view: [job: JobListItem]
  history: []
}>()
</script>
