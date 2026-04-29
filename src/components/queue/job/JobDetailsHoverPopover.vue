<template>
  <Popover :open="isOpen">
    <PopoverAnchor v-if="$slots.anchor" as-child>
      <slot name="anchor" />
    </PopoverAnchor>

    <PopoverContent
      v-if="hasReference"
      :reference="referenceElement ?? undefined"
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
      <JobDetailsPopover :job-id="jobId ?? ''" :workflow-id="workflowId" />
    </PopoverContent>
  </Popover>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import JobDetailsPopover from '@/components/queue/job/JobDetailsPopover.vue'
import PopoverAnchor from '@/components/ui/popover/PopoverAnchor.vue'
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

defineEmits<{
  (e: 'content-enter'): void
  (e: 'content-leave'): void
}>()

const isOpen = computed(() => open && !!jobId)
const hasReference = computed(() => !!jobId && !!referenceElement)
</script>
