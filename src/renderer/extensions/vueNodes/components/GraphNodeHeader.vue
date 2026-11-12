<script setup lang="ts">
import type { NodeState } from '@comfyorg/graph-model/nodeState'
import { cn } from '@comfyorg/tailwind-utils'
import type { ClassValue } from '@comfyorg/tailwind-utils'
import NodeHeader from './NodeHeader.vue'
import NodeSlots from './NodeSlots.vue'
import SlotConnectionDot from './SlotConnectionDot.vue'
defineProps<{
  nodeData: NodeState
  showHeader: boolean
  collapsed: boolean
  hasInputs: boolean
  showMissingWarning: boolean
  progress?: number
  progressClasses: ClassValue
}>()
const emit = defineEmits<{ collapse: []; 'update:title': [value: string] }>()
</script>

<template>
  <div
    v-if="showHeader"
    class="relative flex flex-col items-center justify-center"
  >
    <template v-if="collapsed">
      <SlotConnectionDot
        v-if="hasInputs"
        multi
        class="absolute left-0 -translate-x-1/2"
      />
      <SlotConnectionDot
        v-if="nodeData.outputs.length"
        multi
        class="absolute right-0 translate-x-1/2"
      />
      <NodeSlots :node-data unified />
    </template>
    <NodeHeader
      :node-data
      :collapsed="collapsed"
      :show-missing-warning="showMissingWarning"
      @collapse="emit('collapse')"
      @update:title="emit('update:title', $event)"
    />
  </div>

  <div
    v-if="collapsed && progress !== undefined"
    role="progressbar"
    :aria-label="nodeData.title"
    :aria-valuenow="Math.min(progress * 100, 100)"
    :aria-valuemin="0"
    :aria-valuemax="100"
    :class="
      cn(
        'absolute inset-x-4 -bottom-px translate-y-1/2 rounded-full',
        progressClasses
      )
    "
    :style="{ width: `${Math.min(progress * 100, 100)}%` }"
  />
</template>
