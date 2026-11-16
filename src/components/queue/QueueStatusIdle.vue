<template>
  <Popover v-model:open="open">
    <PopoverTrigger as-child>
      <Button
        variant="base"
        size="unset"
        data-testid="queue-status-idle"
        :aria-expanded="open"
        class="group pointer-events-auto gap-1 rounded-lg border border-solid border-foreground/9 px-2 py-1 text-sm/5 font-normal data-[state=open]:bg-accent"
      >
        {{ label }}
        <i
          class="icon-[lucide--chevron-down] size-3.5 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180"
          aria-hidden
        />
      </Button>
    </PopoverTrigger>
    <PopoverContent
      :align="align"
      side="bottom"
      :side-offset="8"
      :collision-padding="8"
      data-testid="queue-status-idle-panel"
      class="flex w-80 flex-col gap-2 rounded-lg border-foreground/9 p-2"
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
import Button from '@comfyorg/design-system/button/Button'
import { PopoverRoot as Popover, PopoverTrigger } from 'reka-ui'

import PopoverContent from '@comfyorg/design-system/popover/PopoverContent'
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
