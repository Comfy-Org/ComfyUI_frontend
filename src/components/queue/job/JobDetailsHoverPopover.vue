<template>
  <Popover :open="isOpen" @update:open="onOpenChange">
    <PopoverContent
      v-if="hasReference"
      :reference="referenceElement ?? undefined"
      data-testid="queue-job-details-popover"
      side="right"
      align="start"
      :side-offset="8"
      :collision-padding="8"
      :avoid-collisions="true"
      :side-flip="true"
      :hide-when-detached="true"
      position-strategy="fixed"
      sticky="always"
      class="job-details-popover z-1700 max-h-(--reka-popover-content-available-height) w-auto overflow-y-auto border-0 bg-transparent p-0 shadow-none will-change-transform"
      @mouseenter="$emit('content-enter')"
      @mouseleave="$emit('content-leave')"
      @open-auto-focus.prevent
      @close-auto-focus.prevent
    >
      <JobDetailsPopover
        v-if="jobId"
        :job-id="jobId"
        :workflow-id="workflowId"
      />
    </PopoverContent>
  </Popover>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import JobDetailsPopover from '@/components/queue/job/JobDetailsPopover.vue'
import Popover from '@/components/ui/popover/Popover.vue'
import PopoverContent from '@/components/ui/popover/PopoverContent.vue'

const {
  open,
  jobId = null,
  workflowId,
  referenceElement = null
} = defineProps<{
  open: boolean
  jobId?: string | null
  workflowId?: string
  referenceElement?: HTMLElement | null
}>()

const emit = defineEmits<{
  (e: 'content-enter'): void
  (e: 'content-leave'): void
  (e: 'update:open', open: boolean): void
}>()

const isOpen = computed(() => open && !!jobId)
const hasReference = computed(() => !!jobId && !!referenceElement)

function onOpenChange(nextOpen: boolean) {
  emit('update:open', nextOpen)
}
</script>
