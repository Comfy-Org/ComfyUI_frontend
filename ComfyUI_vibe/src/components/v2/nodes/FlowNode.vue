<script setup lang="ts">
import { computed } from 'vue'
import { Handle, Position } from '@vue-flow/core'
import type { FlowNodeData } from '@/types/node'
import { getSlotColor } from '@/types/node'
import NodeHeader from './NodeHeader.vue'
import NodeSlots from './NodeSlots.vue'
import NodeWidgets from './NodeWidgets.vue'

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

const headerStyle = computed(() => {
  const color = props.data.headerColor || props.data.definition.headerColor
  return color ? { backgroundColor: color } : {}
})

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

const hasInputs = computed(() => props.data.definition.inputs.length > 0)
const hasOutputs = computed(() => props.data.definition.outputs.length > 0)

const visibleInputs = computed(() =>
  props.data.definition.inputs.filter(s => !s.hidden)
)
const visibleOutputs = computed(() =>
  props.data.definition.outputs.filter(s => !s.hidden)
)

function handleMinimize(): void {
  emit('update:data', {
    flags: { ...props.data.flags, minimized: !isMinimized.value }
  })
  emit('minimize', !isMinimized.value)
}

// Handle positioning: header (36px) + optional progress bar (4px) + half slot height (12px)
const HEADER_HEIGHT = 36
const SLOT_HEIGHT = 24
const PROGRESS_BAR_HEIGHT = 4

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
  <div
    v-if="isMinimized"
    :class="[
      'flow-node-minimized relative rounded-lg',
      'border transition-all duration-150',
      'bg-zinc-900',
      borderClass,
      outlineClass,
      {
        'ring-4 ring-blue-500/30': selected && !hasError && !isExecuting,
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
    <div
      :class="[
        'node-header-minimized py-1.5 px-2 text-xs',
        'bg-zinc-800 text-zinc-100 rounded-t-lg',
      ]"
      :style="headerStyle"
    >
      <div class="flex items-center justify-between gap-2 min-w-0">
        <div class="flex items-center gap-1.5 min-w-0 flex-1">
          <button
            class="flex h-4 w-4 shrink-0 items-center justify-center rounded text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-zinc-200"
            @click.stop="handleMinimize"
          >
            <i class="pi pi-chevron-down -rotate-90 text-[10px]" />
          </button>
          <span class="truncate font-medium text-[11px]">{{ displayTitle }}</span>
        </div>

        <div class="flex shrink-0 items-center gap-1">
          <i
            v-if="isExecuting"
            class="pi pi-spin pi-spinner text-[10px] text-blue-400"
          />
          <i
            v-if="hasError"
            class="pi pi-exclamation-triangle text-[10px] text-red-400"
          />
        </div>
      </div>
    </div>

    <!-- Compact slots row -->
    <div class="flex items-center justify-between px-1 py-1 rounded-b-lg">
      <!-- Input dots -->
      <div class="flex items-center gap-0.5">
        <div
          v-for="(input, index) in visibleInputs"
          :key="`input-${index}`"
          class="h-2 w-2 rounded-full border border-zinc-900"
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
          class="h-2 w-2 rounded-full border border-zinc-900"
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

  <!-- Full View -->
  <div
    v-else
    :class="[
      'flow-node relative min-w-[225px] rounded-lg',
      'border transition-all duration-150',
      'bg-zinc-900',
      borderClass,
      outlineClass,
      {
        'ring-4 ring-blue-500/30': selected && !hasError && !isExecuting,
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
      :style="headerStyle"
      @collapse="handleCollapse"
      @update:title="handleTitleUpdate"
    />

    <div
      v-if="isExecuting && data.progress !== undefined"
      class="relative h-1 mx-4"
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
          class="h-3 w-3 rounded-full bg-zinc-600 border-2 border-zinc-800"
        />
        <div v-else class="w-3" />
        <div
          v-if="hasOutputs"
          class="h-3 w-3 rounded-full bg-zinc-600 border-2 border-zinc-800"
        />
        <div v-else class="w-3" />
      </div>
    </template>

    <template v-else>
      <div class="flex flex-col gap-1 pb-2">
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

        <div v-if="data.previewUrl" class="px-4 pt-2">
          <img
            :src="data.previewUrl"
            alt="Preview"
            class="w-full rounded-lg object-cover max-h-40"
          />
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
  --node-body-bg: #18181b;
  background-color: var(--node-body-bg);
}

.flow-node-minimized {
  --node-body-bg: #18181b;
  background-color: var(--node-body-bg);
  min-width: 100px;
  max-width: 160px;
}

.vue-flow-handle {
  width: 16px !important;
  height: 16px !important;
  background: transparent !important;
  border: none !important;
  opacity: 0 !important;
}
</style>
