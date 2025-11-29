<script setup lang="ts">
import { computed } from 'vue'
import { Handle, Position } from '@vue-flow/core'
import type { FlowNodeData } from '@/types/node'
import NodeHeader from './NodeHeader.vue'
import NodeSlots from './NodeSlots.vue'
import NodeWidgets from './NodeWidgets.vue'
import FlowNodeMinimized from './FlowNodeMinimized.vue'

interface Props {
  id: string
  data: FlowNodeData
  selected?: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:data': [data: Partial<FlowNodeData>]
  collapse: [collapsed: boolean]
  minimize: [minimized: boolean]
  'update:title': [title: string]
}>()

const isCollapsed = computed(() => props.data.flags.collapsed ?? false)
const isMinimized = computed(() => props.data.flags.minimized ?? false)
const isBypassed = computed(() => props.data.state === 'bypassed')
const isMuted = computed(() => props.data.state === 'muted')
const isExecuting = computed(() => props.data.state === 'executing')
const hasError = computed(() => props.data.state === 'error')

const nodeOpacity = computed(() => {
  if (isBypassed.value || isMuted.value) return 0.5
  return 1
})

const displayTitle = computed(() => {
  return props.data.title || props.data.definition.displayName
})

const progressPercent = computed(() => {
  if (props.data.progress === undefined) return 0
  return Math.min(props.data.progress * 100, 100)
})

const borderClass = computed(() => {
  if (hasError.value) return 'border-red-500'
  if (isExecuting.value) return 'border-blue-500'
  return 'border-zinc-700'
})

const outlineClass = computed(() => {
  if (!props.selected) return ''
  if (hasError.value) return 'outline outline-2 outline-red-500/50'
  if (isExecuting.value) return 'outline outline-2 outline-blue-500/50'
  return 'outline outline-2 outline-blue-500/50'
})

// Header color is no longer used in the new compact design
const headerStyle = computed(() => ({}))

const bodyStyle = computed(() => {
  const color = props.data.bodyColor || props.data.definition.bodyColor
  return color ? { '--node-body-bg': color } : {}
})

function handleCollapse(): void {
  emit('update:data', {
    flags: { ...props.data.flags, collapsed: !isCollapsed.value }
  })
  emit('collapse', !isCollapsed.value)
}

function handleTitleUpdate(newTitle: string): void {
  emit('update:data', { title: newTitle })
  emit('update:title', newTitle)
}

function handleWidgetUpdate(name: string, value: unknown): void {
  emit('update:data', {
    widgetValues: { ...props.data.widgetValues, [name]: value }
  })
}

function handleMinimize(): void {
  emit('update:data', {
    flags: { ...props.data.flags, minimized: !isMinimized.value }
  })
  emit('minimize', !isMinimized.value)
}

const hasInputs = computed(() => props.data.definition.inputs.length > 0)
const hasOutputs = computed(() => props.data.definition.outputs.length > 0)

// Handle positioning constants
const HEADER_HEIGHT = 28
const SLOT_HEIGHT = 22
const PROGRESS_BAR_HEIGHT = 3

const handleTopOffset = computed(() => {
  const hasProgressBar = isExecuting.value && props.data.progress !== undefined
  return HEADER_HEIGHT + (hasProgressBar ? PROGRESS_BAR_HEIGHT : 0) + (SLOT_HEIGHT / 2)
})

function getHandleTop(index: number): string {
  return `${handleTopOffset.value + index * SLOT_HEIGHT}px`
}
</script>

<template>
  <!-- Minimized View -->
  <FlowNodeMinimized
    v-if="isMinimized"
    :title="displayTitle"
    :selected="selected"
    :is-executing="isExecuting"
    :has-error="hasError"
    :is-bypassed="isBypassed"
    :is-muted="isMuted"
    :node-opacity="nodeOpacity"
    :header-style="headerStyle"
    :body-style="bodyStyle"
    :inputs="data.definition.inputs"
    :outputs="data.definition.outputs"
    @expand="handleMinimize"
  />

  <!-- Full View -->
  <div
    v-else
    :class="[
      'flow-node relative min-w-[280px] rounded-lg',
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

    <NodeHeader
      :title="displayTitle"
      :collapsed="isCollapsed"
      :pinned="data.flags.pinned"
      :badges="data.badges"
      :state="data.state"
      @collapse="handleCollapse"
      @update:title="handleTitleUpdate"
    />

    <div
      v-if="isExecuting && data.progress !== undefined"
      class="relative h-[3px] mx-2"
      :class="isCollapsed ? 'absolute bottom-0 left-0 right-0 mx-0' : ''"
    >
      <div class="absolute inset-0 bg-blue-500/30 rounded-full" />
      <div
        class="absolute left-0 top-0 bottom-0 bg-blue-500 rounded-full transition-all duration-300"
        :style="{ width: `${progressPercent}%` }"
      />
    </div>

    <template v-if="isCollapsed">
      <div class="flex items-center justify-between px-2 py-1">
        <div
          v-if="hasInputs"
          class="h-2.5 w-2.5 rounded-full bg-zinc-600 border-2 border-zinc-800"
        />
        <div v-else class="w-2.5" />
        <div
          v-if="hasOutputs"
          class="h-2.5 w-2.5 rounded-full bg-zinc-600 border-2 border-zinc-800"
        />
        <div v-else class="w-2.5" />
      </div>
    </template>

    <template v-else>
      <div class="flex flex-col pb-2">
        <NodeSlots
          :inputs="data.definition.inputs"
          :outputs="data.definition.outputs"
        />

        <NodeWidgets
          v-if="data.definition.widgets.length > 0"
          :widgets="data.definition.widgets"
          :values="data.widgetValues"
          @update:value="handleWidgetUpdate"
        />

        <div v-if="data.previewUrl" class="px-2 pt-2">
          <img
            :src="data.previewUrl"
            alt="Preview"
            class="w-full rounded object-cover"
          />
          <div v-if="data.previewSize" class="text-center text-[10px] text-zinc-500 mt-1">
            {{ data.previewSize }}
          </div>
        </div>
      </div>
    </template>

    <!-- Vue Flow Handles (invisible, aligned with SlotDots) -->
    <template v-if="!isCollapsed">
      <Handle
        v-for="(input, index) in data.definition.inputs"
        :key="`input-${index}`"
        :id="`input-${index}`"
        type="target"
        :position="Position.Left"
        class="vue-flow-handle"
        :style="{ top: getHandleTop(index) }"
      />
      <Handle
        v-for="(output, index) in data.definition.outputs"
        :key="`output-${index}`"
        :id="`output-${index}`"
        type="source"
        :position="Position.Right"
        class="vue-flow-handle"
        :style="{ top: getHandleTop(index) }"
      />
    </template>

    <template v-else>
      <Handle
        v-if="hasInputs"
        id="input-collapsed"
        type="target"
        :position="Position.Left"
        class="vue-flow-handle"
        :style="{ top: '50%' }"
      />
      <Handle
        v-if="hasOutputs"
        id="output-collapsed"
        type="source"
        :position="Position.Right"
        class="vue-flow-handle"
        :style="{ top: '50%' }"
      />
    </template>
  </div>
</template>

<style scoped>
.flow-node {
  --node-body-bg: #1a1a1e;
  background-color: var(--node-body-bg);
}

.vue-flow-handle {
  width: 14px !important;
  height: 14px !important;
  background: transparent !important;
  border: none !important;
  opacity: 0 !important;
}
</style>
