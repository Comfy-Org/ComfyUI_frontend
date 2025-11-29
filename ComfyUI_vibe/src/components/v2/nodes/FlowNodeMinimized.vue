<script setup lang="ts">
import { computed } from 'vue'
import { Handle, Position } from '@vue-flow/core'
import type { SlotDefinition } from '@/types/node'
import { getSlotColor } from '@/types/node'

interface Props {
  title: string
  selected?: boolean
  isExecuting?: boolean
  hasError?: boolean
  isBypassed?: boolean
  isMuted?: boolean
  nodeOpacity?: number
  headerStyle?: Record<string, string>
  bodyStyle?: Record<string, string>
  inputs: SlotDefinition[]
  outputs: SlotDefinition[]
}

const props = withDefaults(defineProps<Props>(), {
  selected: false,
  isExecuting: false,
  hasError: false,
  isBypassed: false,
  isMuted: false,
  nodeOpacity: 1,
  headerStyle: () => ({}),
  bodyStyle: () => ({}),
})

const emit = defineEmits<{
  expand: []
}>()

const borderClass = computed(() => {
  if (props.hasError) return 'border-red-500'
  if (props.isExecuting) return 'border-blue-500'
  return 'border-zinc-700'
})

const outlineClass = computed(() => {
  if (!props.selected) return ''
  if (props.hasError) return 'outline outline-2 outline-red-500/50'
  if (props.isExecuting) return 'outline outline-2 outline-blue-500/50'
  return 'outline outline-2 outline-blue-500/50'
})

const visibleInputs = computed(() => props.inputs.filter(s => !s.hidden))
const visibleOutputs = computed(() => props.outputs.filter(s => !s.hidden))
const hasInputs = computed(() => props.inputs.length > 0)
const hasOutputs = computed(() => props.outputs.length > 0)
</script>

<template>
  <div
    :class="[
      'flow-node-minimized relative rounded-lg',
      'border transition-all duration-150',
      borderClass,
      outlineClass,
      {
        'ring-2 ring-blue-500/30': selected && !hasError && !isExecuting,
      }
    ]"
    :style="[bodyStyle, { opacity: nodeOpacity }]"
  >
    <div
      v-if="isBypassed || isMuted"
      class="pointer-events-none absolute inset-0 rounded-lg"
      :class="isBypassed ? 'bg-amber-500/20' : 'bg-zinc-500/30'"
    />

    <!-- Compact header -->
    <div class="node-header-minimized py-1 px-2 text-zinc-100 rounded-t-lg">
      <div class="flex items-center justify-between gap-1.5 min-w-0">
        <div class="flex items-center gap-1 min-w-0 flex-1">
          <button
            class="flex h-4 w-4 shrink-0 items-center justify-center text-zinc-500 transition-colors hover:text-zinc-300"
            @click.stop="emit('expand')"
          >
            <i class="pi pi-chevron-down -rotate-90 text-[10px]" />
          </button>
          <span class="truncate font-medium text-xs">{{ title }}</span>
        </div>

        <div v-if="isExecuting || hasError" class="flex shrink-0 items-center gap-1">
          <i
            v-if="isExecuting"
            class="pi pi-spin pi-spinner text-[9px] text-blue-400"
          />
          <i
            v-if="hasError"
            class="pi pi-exclamation-triangle text-[9px] text-red-400"
          />
        </div>
      </div>
    </div>

    <!-- Compact slots row -->
    <div class="flex items-center justify-between px-1 py-0.5 rounded-b-lg">
      <!-- Input dots -->
      <div class="flex items-center gap-0.5">
        <div
          v-for="(input, index) in visibleInputs"
          :key="`input-${index}`"
          class="h-2 w-2 rounded-full"
          :style="{ backgroundColor: getSlotColor(input.type) }"
          :title="input.label || input.name"
        />
        <div v-if="!hasInputs" class="w-2" />
      </div>

      <!-- Output dots -->
      <div class="flex items-center gap-0.5">
        <div
          v-for="(output, index) in visibleOutputs"
          :key="`output-${index}`"
          class="h-2 w-2 rounded-full"
          :style="{ backgroundColor: getSlotColor(output.type) }"
          :title="output.label || output.name"
        />
        <div v-if="!hasOutputs" class="w-2" />
      </div>
    </div>

    <!-- Vue Flow Handles (invisible, centered vertically) -->
    <Handle
      v-if="hasInputs"
      id="input-minimized"
      type="target"
      :position="Position.Left"
      class="vue-flow-handle"
      :style="{ top: '50%' }"
    />
    <Handle
      v-if="hasOutputs"
      id="output-minimized"
      type="source"
      :position="Position.Right"
      class="vue-flow-handle"
      :style="{ top: '50%' }"
    />
  </div>
</template>

<style scoped>
.flow-node-minimized {
  --node-body-bg: #1a1a1e;
  background-color: var(--node-body-bg);
  min-width: 90px;
  max-width: 150px;
}

.vue-flow-handle {
  width: 14px !important;
  height: 14px !important;
  background: transparent !important;
  border: none !important;
  opacity: 0 !important;
}
</style>
