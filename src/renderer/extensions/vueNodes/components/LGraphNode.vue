<template>
  <div v-if="renderError" class="node-error p-2 text-sm text-red-500">
    {{ $t('Node Render Error') }}
  </div>
  <div
    v-else
    ref="nodeContainerRef"
    :data-node-id="nodeData.id"
    :class="
      cn(
        'bg-node-component-surface lg-node absolute',
        'h-min w-min contain-style contain-layout min-h-(--node-height) min-w-(--node-width)',
        'rounded-2xl touch-none flex flex-col',
        'border-1 border-solid border-node-component-border',
        // hover (only when node should handle events)
        shouldHandleNodePointerEvents &&
          'hover:ring-7 ring-node-component-ring',
        'outline-transparent outline-2',
        borderClass,
        outlineClass,
        {
          'before:rounded-2xl before:pointer-events-none before:absolute before:bg-bypass/60 before:inset-0':
            bypassed,
          'before:rounded-2xl before:pointer-events-none before:absolute before:inset-0':
            muted,
          'will-change-transform': isDragging
        },

        shouldHandleNodePointerEvents
          ? 'pointer-events-auto'
          : 'pointer-events-none'
      )
    "
    :style="[
      {
        transform: `translate(${position.x ?? 0}px, ${(position.y ?? 0) - LiteGraph.NODE_TITLE_HEIGHT}px)`,
        zIndex: zIndex,
        opacity: nodeOpacity,
        '--node-component-surface': nodeBodyBackgroundColor
      },
      dragStyle
    ]"
    v-bind="pointerHandlers"
    @wheel="handleWheel"
    @contextmenu="handleContextMenu"
  >
    <div class="flex flex-col justify-center items-center relative">
      <template v-if="isCollapsed">
        <SlotConnectionDot
          v-if="hasInputs"
          multi
          class="absolute left-0 -translate-x-1/2"
        />
        <SlotConnectionDot
          v-if="hasOutputs"
          multi
          class="absolute right-0 translate-x-1/2"
        />
        <NodeSlots :node-data="nodeData" unified />
      </template>
      <NodeHeader
        :node-data="nodeData"
        :collapsed="isCollapsed"
        @collapse="handleCollapse"
        @update:title="handleHeaderTitleUpdate"
        @enter-subgraph="handleEnterSubgraph"
      />
    </div>

    <div
      v-if="isCollapsed && executing && progress !== undefined"
      :class="
        cn(
          'absolute inset-x-4 -bottom-[1px] translate-y-1/2 rounded-full',
          progressClasses
        )
      "
      :style="{ width: `${Math.min(progress * 100, 100)}%` }"
    />

    <template v-if="!isCollapsed">
      <div class="relative mb-4">
        <div :class="separatorClasses" />
        <!-- Progress bar for executing state -->
        <div
          v-if="executing && progress !== undefined"
          :class="
            cn(
              'absolute inset-x-0 top-1/2 -translate-y-1/2',
              !!(progress < 1) && 'rounded-r-full',
              progressClasses
            )
          "
          :style="{ width: `${Math.min(progress * 100, 100)}%` }"
        />
      </div>

      <!-- Node Body - rendered based on LOD level and collapsed state -->
      <div
        class="flex min-h-min min-w-min flex-1 flex-col gap-4 pb-4"
        :data-testid="`node-body-${nodeData.id}`"
      >
        <!-- Slots only rendered at full detail -->
        <NodeSlots :node-data="nodeData" />

        <!-- Widgets rendered at reduced+ detail -->
        <NodeWidgets v-if="nodeData.widgets?.length" :node-data="nodeData" />

        <!-- Custom content at reduced+ detail -->
        <div v-if="hasCustomContent" class="min-h-0 flex-1">
          <NodeContent :node-data="nodeData" :media="nodeMedia" />
        </div>
        <!-- Live mid-execution preview images -->
        <div v-if="shouldShowPreviewImg" class="min-h-0 flex-1 px-4">
          <LivePreview :image-url="latestPreviewUrl || null" />
        </div>
      </div>
    </template>

    <!-- Resize handles -->
    <template v-if="!isCollapsed">
      <div
        v-for="handle in cornerResizeHandles"
        :key="handle.id"
        role="button"
        :aria-label="handle.ariaLabel"
        :class="cn(baseResizeHandleClasses, handle.classes)"
        @pointerdown.stop="handleResizePointerDown(handle.direction)($event)"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { whenever } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { computed, inject, onErrorCaptured, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import type { VueNodeData } from '@/composables/graph/useGraphNodeManager'
import { toggleNodeOptions } from '@/composables/graph/useMoreOptionsMenu'
import { useErrorHandling } from '@/composables/useErrorHandling'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useCanvasInteractions } from '@/renderer/core/canvas/useCanvasInteractions'
import { TransformStateKey } from '@/renderer/core/layout/injectionKeys'
import SlotConnectionDot from '@/renderer/extensions/vueNodes/components/SlotConnectionDot.vue'
import { useNodeEventHandlers } from '@/renderer/extensions/vueNodes/composables/useNodeEventHandlers'
import { useNodePointerInteractions } from '@/renderer/extensions/vueNodes/composables/useNodePointerInteractions'
import { useVueElementTracking } from '@/renderer/extensions/vueNodes/composables/useVueNodeResizeTracking'
import { useNodeExecutionState } from '@/renderer/extensions/vueNodes/execution/useNodeExecutionState'
import { useNodeLayout } from '@/renderer/extensions/vueNodes/layout/useNodeLayout'
import { useNodePreviewState } from '@/renderer/extensions/vueNodes/preview/useNodePreviewState'
import { nonWidgetedInputs } from '@/renderer/extensions/vueNodes/utils/nodeDataUtils'
import { applyLightThemeColor } from '@/renderer/extensions/vueNodes/utils/nodeStyleUtils'
import { app } from '@/scripts/app'
import { useExecutionStore } from '@/stores/executionStore'
import { useNodeOutputStore } from '@/stores/imagePreviewStore'
import { useColorPaletteStore } from '@/stores/workspace/colorPaletteStore'
import {
  getLocatorIdFromNodeData,
  getNodeByLocatorId
} from '@/utils/graphTraversalUtil'
import { cn } from '@/utils/tailwindUtil'

import type { ResizeHandleDirection } from '../interactions/resize/resizeMath'
import { useNodeResize } from '../interactions/resize/useNodeResize'
import LivePreview from './LivePreview.vue'
import NodeContent from './NodeContent.vue'
import NodeHeader from './NodeHeader.vue'
import NodeSlots from './NodeSlots.vue'
import NodeWidgets from './NodeWidgets.vue'

// Extended props for main node component
interface LGraphNodeProps {
  nodeData: VueNodeData
  error?: string | null
  zoomLevel?: number
}

const { nodeData, error = null } = defineProps<LGraphNodeProps>()

const { t } = useI18n()

const {
  handleNodeCollapse,
  handleNodeTitleUpdate,
  handleNodeSelect,
  handleNodeRightClick
} = useNodeEventHandlers()

useVueElementTracking(() => nodeData.id, 'node')

const transformState = inject(TransformStateKey)
if (!transformState) {
  throw new Error(
    'TransformState must be provided for node resize functionality'
  )
}

const { selectedNodeIds } = storeToRefs(useCanvasStore())
const isSelected = computed(() => {
  return selectedNodeIds.value.has(nodeData.id)
})

const nodeLocatorId = computed(() => getLocatorIdFromNodeData(nodeData))
const { executing, progress } = useNodeExecutionState(nodeLocatorId)
const executionStore = useExecutionStore()
const hasExecutionError = computed(
  () => executionStore.lastExecutionErrorNodeId === nodeData.id
)

const hasAnyError = computed((): boolean => {
  return !!(
    hasExecutionError.value ||
    nodeData.hasErrors ||
    error ||
    (executionStore.lastNodeErrors?.[nodeData.id]?.errors.length ?? 0) > 0
  )
})

const isCollapsed = computed(() => nodeData.flags?.collapsed ?? false)
const bypassed = computed((): boolean => nodeData.mode === 4)
const muted = computed((): boolean => nodeData.mode === 2) // NEVER mode

const nodeBodyBackgroundColor = computed(() => {
  const colorPaletteStore = useColorPaletteStore()

  if (!nodeData.bgcolor) {
    return ''
  }

  return applyLightThemeColor(
    nodeData.bgcolor,
    Boolean(colorPaletteStore.completedActivePalette.light_theme)
  )
})

const nodeOpacity = computed(() => {
  const globalOpacity = useSettingStore().get('Comfy.Node.Opacity') ?? 1

  // For muted/bypassed nodes, apply the 0.5 multiplier on top of global opacity
  if (bypassed.value || muted.value) {
    return globalOpacity * 0.5
  }

  return globalOpacity
})

const hasInputs = computed(() => nonWidgetedInputs(nodeData).length > 0)
const hasOutputs = computed((): boolean => !!nodeData.outputs?.length)

// Use canvas interactions for proper wheel event handling and pointer event capture control
const { handleWheel, shouldHandleNodePointerEvents } = useCanvasInteractions()

// Error boundary implementation
const renderError = ref<string | null>(null)
const { toastErrorHandler } = useErrorHandling()

onErrorCaptured((error) => {
  renderError.value = error.message
  toastErrorHandler(error)
  return false // Prevent error propagation
})

const { position, size, zIndex, moveNodeTo } = useNodeLayout(() => nodeData.id)
const { pointerHandlers, isDragging, dragStyle } = useNodePointerInteractions(
  () => nodeData,
  handleNodeSelect
)

// Handle right-click context menu
const handleContextMenu = (event: MouseEvent) => {
  event.preventDefault()
  event.stopPropagation()

  // First handle the standard right-click behavior (selection)
  handleNodeRightClick(event as PointerEvent, nodeData)

  // Show the node options menu at the cursor position
  const targetElement = event.currentTarget as HTMLElement
  if (targetElement) {
    toggleNodeOptions(event, targetElement, false)
  }
}

onMounted(() => {
  // Set initial DOM size from layout store, but respect intrinsic content minimum
  if (size.value && nodeContainerRef.value) {
    nodeContainerRef.value.style.setProperty(
      '--node-width',
      `${size.value.width}px`
    )
    nodeContainerRef.value.style.setProperty(
      '--node-height',
      `${size.value.height}px`
    )
  }
})

const baseResizeHandleClasses =
  'absolute h-3 w-3 opacity-0 pointer-events-auto focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/40'
const POSITION_EPSILON = 0.01

type CornerResizeHandle = {
  id: string
  direction: ResizeHandleDirection
  classes: string
  ariaLabel: string
}

const cornerResizeHandles: CornerResizeHandle[] = [
  {
    id: 'se',
    direction: { horizontal: 'right', vertical: 'bottom' },
    classes: 'right-0 bottom-0 cursor-se-resize',
    ariaLabel: t('g.resizeFromBottomRight')
  },
  {
    id: 'ne',
    direction: { horizontal: 'right', vertical: 'top' },
    classes: 'right-0 top-0 cursor-ne-resize',
    ariaLabel: t('g.resizeFromTopRight')
  },
  {
    id: 'sw',
    direction: { horizontal: 'left', vertical: 'bottom' },
    classes: 'left-0 bottom-0 cursor-sw-resize',
    ariaLabel: t('g.resizeFromBottomLeft')
  },
  {
    id: 'nw',
    direction: { horizontal: 'left', vertical: 'top' },
    classes: 'left-0 top-0 cursor-nw-resize',
    ariaLabel: t('g.resizeFromTopLeft')
  }
]

const { startResize } = useNodeResize(
  (result, element) => {
    if (isCollapsed.value) return

    // Apply size directly to DOM element - ResizeObserver will pick this up
    element.style.setProperty('--node-width', `${result.size.width}px`)
    element.style.setProperty('--node-height', `${result.size.height}px`)

    const currentPosition = position.value
    const deltaX = Math.abs(result.position.x - currentPosition.x)
    const deltaY = Math.abs(result.position.y - currentPosition.y)

    if (deltaX > POSITION_EPSILON || deltaY > POSITION_EPSILON) {
      moveNodeTo(result.position)
    }
  },
  {
    transformState
  }
)

const handleResizePointerDown = (direction: ResizeHandleDirection) => {
  return (event: PointerEvent) => {
    if (nodeData.flags?.pinned) return

    startResize(event, direction, { ...position.value })
  }
}

whenever(isCollapsed, () => {
  const element = nodeContainerRef.value
  if (!element) return
  element.style.setProperty('--node-width', '')
  element.style.setProperty('--node-height', '')
})

// Check if node has custom content (like image/video outputs)
const hasCustomContent = computed(() => {
  // Show custom content if node has media outputs
  return !!nodeMedia.value && nodeMedia.value.urls.length > 0
})

// Computed classes and conditions for better reusability
const separatorClasses = 'bg-node-component-border h-px mx-0 w-full lod-toggle'
const progressClasses = 'h-2 bg-primary-500 transition-all duration-300'

const { latestPreviewUrl, shouldShowPreviewImg } = useNodePreviewState(
  () => nodeData.id,
  {
    isCollapsed
  }
)

const borderClass = computed(() => {
  if (hasAnyError.value) return 'border-node-stroke-error'
  if (executing.value) return 'border-node-stroke-executing'
  return 'border-node-stroke'
})

const outlineClass = computed(() => {
  return cn(
    isSelected.value &&
      ((hasAnyError.value && 'outline-error ') ||
        (executing.value && 'outline-node-executing') ||
        'outline-node-component-outline')
  )
})

// Event handlers
const handleCollapse = () => {
  handleNodeCollapse(nodeData.id, !isCollapsed.value)
}

const handleHeaderTitleUpdate = (newTitle: string) => {
  handleNodeTitleUpdate(nodeData.id, newTitle)
}

const handleEnterSubgraph = () => {
  const graph = app.graph?.rootGraph || app.graph
  if (!graph) {
    console.warn('LGraphNode: No graph available for subgraph navigation')
    return
  }

  const locatorId = getLocatorIdFromNodeData(nodeData)

  const litegraphNode = getNodeByLocatorId(graph, locatorId)

  if (!litegraphNode?.isSubgraphNode() || !('subgraph' in litegraphNode)) {
    console.warn('LGraphNode: Node is not a valid subgraph node', litegraphNode)
    return
  }

  const canvas = app.canvas
  if (!canvas || typeof canvas.openSubgraph !== 'function') {
    console.warn('LGraphNode: Canvas or openSubgraph method not available')
    return
  }

  canvas.openSubgraph(litegraphNode.subgraph, litegraphNode)
}

const nodeOutputs = useNodeOutputStore()

const nodeOutputLocatorId = computed(() =>
  nodeData.subgraphId ? `${nodeData.subgraphId}:${nodeData.id}` : nodeData.id
)

const lgraphNode = computed(() => {
  const locatorId = getLocatorIdFromNodeData(nodeData)
  const rootGraph = app.graph?.rootGraph || app.graph
  if (!rootGraph) return null
  return getNodeByLocatorId(rootGraph, locatorId)
})

const nodeMedia = computed(() => {
  const newOutputs = nodeOutputs.nodeOutputs[nodeOutputLocatorId.value]
  const node = lgraphNode.value

  if (!node || !newOutputs?.images?.length) return undefined

  const urls = nodeOutputs.getNodeImageUrls(node)
  if (!urls?.length) return undefined

  // Determine media type from previewMediaType or fallback to input slot types
  // Note: Despite the field name "images", videos are also included in outputs
  // TODO: fix the backend to return videos using the videos key instead of the images key
  const hasVideoInput = node.inputs?.some((input) => input.type === 'VIDEO')
  const type =
    node.previewMediaType === 'video' ||
    (!node.previewMediaType && hasVideoInput)
      ? 'video'
      : 'image'

  return { type, urls } as const
})

const nodeContainerRef = ref<HTMLDivElement>()
</script>
