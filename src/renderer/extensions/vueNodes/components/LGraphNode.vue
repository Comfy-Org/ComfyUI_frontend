<template>
  <div v-if="renderError" class="node-error p-2 text-red-500 text-sm">
    {{ $t('Node Render Error') }}
  </div>
  <div
    v-else
    :data-node-id="nodeData.id"
    :class="
      cn(
        'bg-white dark-theme:bg-charcoal-100',
        'min-w-[445px]',
        'lg-node absolute border border-solid rounded-2xl',
        'outline-transparent outline-2',
        {
          'outline-black dark-theme:outline-white': isSelected
        },
        {
          'border-blue-500 ring-2 ring-blue-300': isSelected,
          'border-sand-100 dark-theme:border-charcoal-300': !isSelected,
          'animate-pulse': executing,
          'opacity-50': nodeData.mode === 4,
          'border-red-500 bg-red-50': error,
          'will-change-transform': isDragging
        },
        lodCssClass,
        'pointer-events-auto'
      )
    "
    :style="[
      {
        transform: `translate(${layoutPosition.x ?? position?.x ?? 0}px, ${(layoutPosition.y ?? position?.y ?? 0) - LiteGraph.NODE_TITLE_HEIGHT}px)`,
        zIndex: zIndex
      },
      dragStyle
    ]"
    @pointerdown="handlePointerDown"
    @pointermove="handlePointerMove"
    @pointerup="handlePointerUp"
  >
    <div class="flex items-center">
      <template v-if="isCollapsed">
        <SlotConnectionDot multi class="absolute left-0 -translate-x-1/2" />
        <SlotConnectionDot multi class="absolute right-0 translate-x-1/2" />
      </template>
      <!-- Header only updates on title/color changes -->
      <NodeHeader
        v-memo="[nodeData.title, lodLevel, isCollapsed]"
        :node-data="nodeData"
        :readonly="readonly"
        :lod-level="lodLevel"
        :collapsed="isCollapsed"
        @collapse="handleCollapse"
        @update:title="handleTitleUpdate"
      />
    </div>

    <template v-if="!isMinimalLOD && !isCollapsed">
      <div :class="cn(separatorClasses, 'mb-4')" />

      <!-- Node Body - rendered based on LOD level and collapsed state -->
      <div
        class="flex flex-col gap-4 pb-4"
        :data-testid="`node-body-${nodeData.id}`"
      >
        <!-- Slots only rendered at full detail -->
        <NodeSlots
          v-if="shouldRenderSlots"
          v-memo="[nodeData.inputs?.length, nodeData.outputs?.length, lodLevel]"
          :node-data="nodeData"
          :readonly="readonly"
          :lod-level="lodLevel"
          @slot-click="handleSlotClick"
        />

        <div
          v-if="shouldRenderSlots && shouldShowWidgets"
          :class="separatorClasses"
        />

        <!-- Widgets rendered at reduced+ detail -->
        <NodeWidgets
          v-if="shouldShowWidgets"
          v-memo="[nodeData.widgets?.length, lodLevel]"
          :node-data="nodeData"
          :readonly="readonly"
          :lod-level="lodLevel"
        />

        <div
          v-if="(shouldRenderSlots || shouldShowWidgets) && shouldShowContent"
          :class="separatorClasses"
        />

        <!-- Custom content at reduced+ detail -->
        <NodeContent
          v-if="shouldShowContent"
          :node-data="nodeData"
          :readonly="readonly"
          :lod-level="lodLevel"
        />
      </div>
    </template>

    <!-- Progress bar for executing state -->
    <div
      v-if="executing && progress !== undefined"
      class="absolute bottom-0 left-0 h-1 bg-primary-500 transition-all duration-300"
      :style="{ width: `${progress * 100}%` }"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, inject, onErrorCaptured, ref, toRef, watch } from 'vue'

import type { VueNodeData } from '@/composables/graph/useGraphNodeManager'
import { useErrorHandling } from '@/composables/useErrorHandling'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import { SelectedNodeIdsKey } from '@/renderer/core/canvas/injectionKeys'
import { useNodeLayout } from '@/renderer/extensions/vueNodes/layout/useNodeLayout'
import { LODLevel, useLOD } from '@/renderer/extensions/vueNodes/lod/useLOD'
import { cn } from '@/utils/tailwindUtil'

import { useVueElementTracking } from '../composables/useVueNodeResizeTracking'
import NodeContent from './NodeContent.vue'
import NodeHeader from './NodeHeader.vue'
import NodeSlots from './NodeSlots.vue'
import NodeWidgets from './NodeWidgets.vue'
import SlotConnectionDot from './SlotConnectionDot.vue'

// Extended props for main node component
interface LGraphNodeProps {
  nodeData: VueNodeData
  position?: { x: number; y: number }
  size?: { width: number; height: number }
  readonly?: boolean
  executing?: boolean
  progress?: number
  error?: string | null
  zoomLevel?: number
}

const props = defineProps<LGraphNodeProps>()

const emit = defineEmits<{
  'node-click': [event: PointerEvent, nodeData: VueNodeData]
  'slot-click': [
    event: PointerEvent,
    nodeData: VueNodeData,
    slotIndex: number,
    isInput: boolean
  ]
  'update:collapsed': [nodeId: string, collapsed: boolean]
  'update:title': [nodeId: string, newTitle: string]
}>()

useVueElementTracking(props.nodeData.id, 'node')

// Inject selection state from parent
const selectedNodeIds = inject(SelectedNodeIdsKey)
if (!selectedNodeIds) {
  throw new Error(
    'SelectedNodeIds not provided - LGraphNode must be used within a component that provides selection state'
  )
}

// Computed selection state - only this node re-evaluates when its selection changes
const isSelected = computed(() => {
  return selectedNodeIds.value.has(props.nodeData.id)
})

// LOD (Level of Detail) system based on zoom level
const zoomRef = toRef(() => props.zoomLevel ?? 1)
const {
  lodLevel,
  shouldRenderWidgets,
  shouldRenderSlots,
  shouldRenderContent,
  lodCssClass
} = useLOD(zoomRef)

// Computed properties for template usage
const isMinimalLOD = computed(() => lodLevel.value === LODLevel.MINIMAL)

// Error boundary implementation
const renderError = ref<string | null>(null)
const { toastErrorHandler } = useErrorHandling()

onErrorCaptured((error) => {
  renderError.value = error.message
  toastErrorHandler(error)
  return false // Prevent error propagation
})

// Use layout system for node position and dragging
const {
  position: layoutPosition,
  zIndex,
  startDrag,
  handleDrag: handleLayoutDrag,
  endDrag
} = useNodeLayout(props.nodeData.id)

// Drag state for styling
const isDragging = ref(false)
const dragStyle = computed(() => ({
  cursor: isDragging.value ? 'grabbing' : 'grab'
}))

// Track collapsed state
const isCollapsed = ref(props.nodeData.flags?.collapsed ?? false)

// Watch for external changes to the collapsed state
watch(
  () => props.nodeData.flags?.collapsed,
  (newCollapsed: boolean | undefined) => {
    if (newCollapsed !== undefined && newCollapsed !== isCollapsed.value) {
      isCollapsed.value = newCollapsed
    }
  }
)

// Check if node has custom content
const hasCustomContent = computed(() => {
  // Currently all content is handled through widgets
  // This remains false but provides extensibility point
  return false
})

// Computed classes and conditions for better reusability
const separatorClasses =
  'bg-sand-primary dark-theme:bg-charcoal-tertiary h-[1px] mx-0'

// Common condition computations to avoid repetition
const shouldShowWidgets = computed(
  () => shouldRenderWidgets.value && props.nodeData.widgets?.length
)

const shouldShowContent = computed(
  () => shouldRenderContent.value && hasCustomContent.value
)

// Event handlers
const handlePointerDown = (event: PointerEvent) => {
  if (!props.nodeData) {
    console.warn('LGraphNode: nodeData is null/undefined in handlePointerDown')
    return
  }

  // Start drag using layout system
  isDragging.value = true
  startDrag(event)

  // Emit node-click for selection handling in GraphCanvas
  emit('node-click', event, props.nodeData)
}

const handlePointerMove = (event: PointerEvent) => {
  if (isDragging.value) {
    void handleLayoutDrag(event)
  }
}

const handlePointerUp = (event: PointerEvent) => {
  if (isDragging.value) {
    isDragging.value = false
    void endDrag(event)
  }
}

const handleCollapse = () => {
  isCollapsed.value = !isCollapsed.value
  // Emit event so parent can sync with LiteGraph if needed
  emit('update:collapsed', props.nodeData.id, isCollapsed.value)
}

const handleSlotClick = (
  event: PointerEvent,
  slotIndex: number,
  isInput: boolean
) => {
  if (!props.nodeData) {
    console.warn('LGraphNode: nodeData is null/undefined in handleSlotClick')
    return
  }
  emit('slot-click', event, props.nodeData, slotIndex, isInput)
}

const handleTitleUpdate = (newTitle: string) => {
  emit('update:title', props.nodeData.id, newTitle)
}
</script>
