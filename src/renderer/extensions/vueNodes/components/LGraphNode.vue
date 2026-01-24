<template>
  <div v-if="renderError" class="node-error p-2 text-sm text-red-500">
    {{ st('nodeErrors.render', 'Node Render Error') }}
  </div>
  <div
    v-else
    ref="nodeContainerRef"
    tabindex="0"
    :data-node-id="nodeData.id"
    :class="
      cn(
        'bg-component-node-background lg-node absolute text-sm',
        'contain-style contain-layout min-w-[225px] min-h-(--node-height) w-(--node-width)',
        shapeClass,
        'touch-none flex flex-col',
        'border-1 border-solid border-component-node-border',
        // hover (only when node should handle events)
        shouldHandleNodePointerEvents &&
          'hover:ring-7 ring-node-component-ring',
        'outline-transparent outline-2 focus-visible:outline-node-component-outline',
        borderClass,
        outlineClass,
        cursorClass,
        {
          [`${beforeShapeClass} before:pointer-events-none before:absolute before:bg-bypass/60 before:inset-0`]:
            bypassed,
          [`${beforeShapeClass} before:pointer-events-none before:absolute before:inset-0`]:
            muted,
          'ring-4 ring-primary-500 bg-primary-500/10': isDraggingOver
        },

        shouldHandleNodePointerEvents
          ? 'pointer-events-auto'
          : 'pointer-events-none',
        !isCollapsed && ' pb-1'
      )
    "
    :style="[
      {
        transform: `translate(${position.x ?? 0}px, ${(position.y ?? 0) - LiteGraph.NODE_TITLE_HEIGHT}px)`,
        zIndex: zIndex,
        opacity: nodeOpacity,
        '--component-node-background': applyLightThemeColor(nodeData.bgcolor)
      }
    ]"
    v-bind="remainingPointerHandlers"
    @pointerdown="nodeOnPointerdown"
    @wheel="handleWheel"
    @contextmenu="handleContextMenu"
    @dragover.prevent="handleDragOver"
    @dragleave="handleDragLeave"
    @drop.stop.prevent="handleDrop"
  >
    <div
      v-if="displayHeader"
      class="flex flex-col justify-center items-center relative"
    >
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
      <div class="relative mb-1">
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

      <div
        class="flex flex-1 flex-col gap-1 pb-2"
        :data-testid="`node-body-${nodeData.id}`"
      >
        <NodeSlots :node-data="nodeData" />

        <NodeWidgets v-if="nodeData.widgets?.length" :node-data="nodeData" />

        <div v-if="hasCustomContent" class="min-h-0 flex-1 flex">
          <NodeContent :node-data="nodeData" :media="nodeMedia" />
        </div>
        <!-- Live mid-execution preview images -->
        <div v-if="shouldShowPreviewImg" class="min-h-0 flex-1 px-4">
          <LivePreview :image-url="latestPreviewUrl || null" />
        </div>

        <!-- Show advanced inputs button for subgraph nodes -->
        <div v-if="showAdvancedInputsButton" class="flex justify-center px-3">
          <button
            :class="
              cn(
                WidgetInputBaseClass,
                'w-full h-7 flex justify-center items-center gap-2 text-sm px-3 outline-0 ring-0 truncate',
                'transition-all cursor-pointer hover:bg-accent-background duration-150 active:scale-95'
              )
            "
            @click.stop="showAdvancedState = !showAdvancedState"
          >
            <template v-if="showAdvancedState">
              <i class="icon-[lucide--chevron-up] size-4" />
              <span>{{ t('rightSidePanel.hideAdvancedInputsButton') }}</span>
            </template>
            <template v-else>
              <i class="icon-[lucide--settings-2] size-4" />
              <span>{{ t('rightSidePanel.showAdvancedInputsButton') }} </span>
            </template>
          </button>
        </div>
      </div>
    </template>

    <!-- Resize handle (bottom-right only) -->
    <div
      v-if="!isCollapsed && nodeData.resizable !== false"
      role="button"
      :aria-label="t('g.resizeFromBottomRight')"
      :class="cn(baseResizeHandleClasses, 'right-0 bottom-0 cursor-se-resize')"
      @pointerdown.stop="handleResizePointerDown"
    />
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import {
  computed,
  customRef,
  nextTick,
  onErrorCaptured,
  onMounted,
  ref,
  watch
} from 'vue'
import { useI18n } from 'vue-i18n'

import type { VueNodeData } from '@/composables/graph/useGraphNodeManager'
import { showNodeOptions } from '@/composables/graph/useMoreOptionsMenu'
import { useErrorHandling } from '@/composables/useErrorHandling'
import { st } from '@/i18n'
import {
  LGraphCanvas,
  LGraphEventMode,
  LiteGraph,
  RenderShape
} from '@/lib/litegraph/src/litegraph'
import { SubgraphNode } from '@/lib/litegraph/src/subgraph/SubgraphNode'
import { TitleMode } from '@/lib/litegraph/src/types/globalEnums'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useTelemetry } from '@/platform/telemetry'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useCanvasInteractions } from '@/renderer/core/canvas/useCanvasInteractions'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import SlotConnectionDot from '@/renderer/extensions/vueNodes/components/SlotConnectionDot.vue'
import { useNodeEventHandlers } from '@/renderer/extensions/vueNodes/composables/useNodeEventHandlers'
import { useNodePointerInteractions } from '@/renderer/extensions/vueNodes/composables/useNodePointerInteractions'
import { useNodeZIndex } from '@/renderer/extensions/vueNodes/composables/useNodeZIndex'
import { useVueElementTracking } from '@/renderer/extensions/vueNodes/composables/useVueNodeResizeTracking'
import { useNodeExecutionState } from '@/renderer/extensions/vueNodes/execution/useNodeExecutionState'
import { useNodeDrag } from '@/renderer/extensions/vueNodes/layout/useNodeDrag'
import { useNodeLayout } from '@/renderer/extensions/vueNodes/layout/useNodeLayout'
import { useNodePreviewState } from '@/renderer/extensions/vueNodes/preview/useNodePreviewState'
import { nonWidgetedInputs } from '@/renderer/extensions/vueNodes/utils/nodeDataUtils'
import { applyLightThemeColor } from '@/renderer/extensions/vueNodes/utils/nodeStyleUtils'
import { app } from '@/scripts/app'
import { useExecutionStore } from '@/stores/executionStore'
import { useNodeOutputStore } from '@/stores/imagePreviewStore'
import { useRightSidePanelStore } from '@/stores/workspace/rightSidePanelStore'
import { isTransparent } from '@/utils/colorUtil'
import {
  getLocatorIdFromNodeData,
  getNodeByLocatorId
} from '@/utils/graphTraversalUtil'
import { cn } from '@/utils/tailwindUtil'

import { useNodeResize } from '../interactions/resize/useNodeResize'
import { WidgetInputBaseClass } from '../widgets/components/layout'
import LivePreview from './LivePreview.vue'
import NodeContent from './NodeContent.vue'
import NodeHeader from './NodeHeader.vue'
import NodeSlots from './NodeSlots.vue'
import NodeWidgets from './NodeWidgets.vue'

// Extended props for main node component
interface LGraphNodeProps {
  nodeData: VueNodeData
  error?: string | null
}

const { nodeData, error = null } = defineProps<LGraphNodeProps>()

const { t } = useI18n()

const settingStore = useSettingStore()

const { handleNodeCollapse, handleNodeTitleUpdate, handleNodeRightClick } =
  useNodeEventHandlers()
const { bringNodeToFront } = useNodeZIndex()

useVueElementTracking(() => nodeData.id, 'node')

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

const displayHeader = computed(() => nodeData.titleMode !== TitleMode.NO_TITLE)

const isCollapsed = computed(() => nodeData.flags?.collapsed ?? false)
const bypassed = computed(
  (): boolean => nodeData.mode === LGraphEventMode.BYPASS
)
const muted = computed((): boolean => nodeData.mode === LGraphEventMode.NEVER)

const nodeOpacity = computed(() => {
  const globalOpacity = settingStore.get('Comfy.Node.Opacity') ?? 1

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

const { position, size, zIndex } = useNodeLayout(() => nodeData.id)
const { pointerHandlers } = useNodePointerInteractions(() => nodeData.id)
const { onPointerdown, ...remainingPointerHandlers } = pointerHandlers
const { startDrag } = useNodeDrag()

async function nodeOnPointerdown(event: PointerEvent) {
  if (event.altKey && lgraphNode.value) {
    const result = LGraphCanvas.cloneNodes([lgraphNode.value])
    if (result?.created?.length) {
      const [newNode] = result.created
      startDrag(event, `${newNode.id}`)
      layoutStore.isDraggingVueNodes.value = true
      await nextTick()
      bringNodeToFront(`${newNode.id}`)
      return
    }
  }
  onPointerdown(event)
}

// Handle right-click context menu
const handleContextMenu = (event: MouseEvent) => {
  event.preventDefault()
  event.stopPropagation()

  // First handle the standard right-click behavior (selection)
  handleNodeRightClick(event as PointerEvent, nodeData.id)

  // Show the node options menu at the cursor position
  showNodeOptions(event)
}

onMounted(() => {
  initSizeStyles()
})

/**
 * Set initial DOM size from layout store, but respect intrinsic content minimum.
 * Important: nodes can mount in a collapsed state, and the collapse watcher won't
 * run initially. Match the collapsed runtime behavior by writing to the correct
 * CSS variables on mount.
 */
function initSizeStyles() {
  const el = nodeContainerRef.value
  const { width, height } = size.value
  if (!el) return

  const suffix = isCollapsed.value ? '-x' : ''

  el.style.setProperty(`--node-width${suffix}`, `${width}px`)
  el.style.setProperty(`--node-height${suffix}`, `${height}px`)
}

const baseResizeHandleClasses =
  'absolute h-3 w-3 opacity-0 pointer-events-auto focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/40'

const MIN_NODE_WIDTH = 225

const { startResize } = useNodeResize((result, element) => {
  if (isCollapsed.value) return

  // Clamp width to minimum to avoid conflicts with CSS min-width
  const clampedWidth = Math.max(result.size.width, MIN_NODE_WIDTH)

  // Apply size directly to DOM element - ResizeObserver will pick this up
  element.style.setProperty('--node-width', `${clampedWidth}px`)
  element.style.setProperty('--node-height', `${result.size.height}px`)
})

const handleResizePointerDown = (event: PointerEvent) => {
  if (event.button !== 0) return
  if (!shouldHandleNodePointerEvents.value) return
  if (nodeData.flags?.pinned) return
  if (nodeData.resizable === false) return
  startResize(event)
}

watch(isCollapsed, (collapsed) => {
  const element = nodeContainerRef.value
  if (!element) return
  const [from, to] = collapsed ? ['', '-x'] : ['-x', '']
  const currentWidth = element.style.getPropertyValue(`--node-width${from}`)
  element.style.setProperty(`--node-width${to}`, currentWidth)
  element.style.setProperty(`--node-width${from}`, '')

  const currentHeight = element.style.getPropertyValue(`--node-height${from}`)
  element.style.setProperty(`--node-height${to}`, currentHeight)
  element.style.setProperty(`--node-height${from}`, '')
})

// Check if node has custom content (like image/video outputs)
const hasCustomContent = computed(() => {
  // Show custom content if node has media outputs
  return !!nodeMedia.value && nodeMedia.value.urls.length > 0
})

// Computed classes and conditions for better reusability
const progressClasses = 'h-2 bg-primary-500 transition-all duration-300'

const { latestPreviewUrl, shouldShowPreviewImg } = useNodePreviewState(
  () => nodeData.id,
  {
    isCollapsed
  }
)

const borderClass = computed(() => {
  if (hasAnyError.value) return 'border-node-stroke-error'
  //FIXME need a better way to detecting transparency
  if (
    !displayHeader.value &&
    nodeData.bgcolor &&
    isTransparent(nodeData.bgcolor)
  )
    return 'border-0'
  return ''
})

const outlineClass = computed(() => {
  return cn(
    isSelected.value && 'outline-node-component-outline',
    hasAnyError.value && 'outline-node-stroke-error',
    executing.value && 'outline-node-stroke-executing'
  )
})

const cursorClass = computed(() => {
  return cn(
    nodeData.flags?.pinned
      ? 'cursor-default'
      : layoutStore.isDraggingVueNodes.value
        ? 'cursor-grabbing'
        : 'cursor-grab'
  )
})

const shapeClass = computed(() => {
  switch (nodeData.shape) {
    case RenderShape.BOX:
      return 'rounded-none'
    case RenderShape.CARD:
      return 'rounded-tl-2xl rounded-br-2xl rounded-tr-none rounded-bl-none'
    default:
      return 'rounded-2xl'
  }
})

const beforeShapeClass = computed(() => {
  switch (nodeData.shape) {
    case RenderShape.BOX:
      return 'before:rounded-none'
    case RenderShape.CARD:
      return 'before:rounded-tl-2xl before:rounded-br-2xl before:rounded-tr-none before:rounded-bl-none'
    default:
      return 'before:rounded-2xl'
  }
})

// Event handlers
const handleCollapse = () => {
  handleNodeCollapse(nodeData.id, !isCollapsed.value)
}

const handleHeaderTitleUpdate = (newTitle: string) => {
  handleNodeTitleUpdate(nodeData.id, newTitle)
}

const handleEnterSubgraph = () => {
  useTelemetry()?.trackUiButtonClicked({
    button_id: 'graph_node_open_subgraph_clicked'
  })
  const graph = app.rootGraph
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
  return getNodeByLocatorId(app.rootGraph, locatorId)
})

const showAdvancedInputsButton = computed(() => {
  const node = lgraphNode.value
  if (!node) return false

  // For subgraph nodes: check for unpromoted widgets
  if (node instanceof SubgraphNode) {
    const interiorNodes = node.subgraph.nodes
    const allInteriorWidgets = interiorNodes.flatMap((n) => n.widgets ?? [])
    return allInteriorWidgets.some((w) => !w.computedDisabled && !w.promoted)
  }

  // For regular nodes: show button if there are advanced widgets and they're currently hidden
  const hasAdvancedWidgets = nodeData.widgets?.some((w) => w.options?.advanced)
  const alwaysShowAdvanced = settingStore.get(
    'Comfy.Node.AlwaysShowAdvancedWidgets'
  )
  return hasAdvancedWidgets && !alwaysShowAdvanced
})

const showAdvancedState = customRef((track, trigger) => {
  let internalState = false

  const node = lgraphNode.value
  if (node && !(node instanceof SubgraphNode)) {
    internalState = !!node.showAdvanced
  }

  return {
    get() {
      track()
      return internalState
    },
    set(value: boolean) {
      const node = lgraphNode.value
      if (!node) return

      if (node instanceof SubgraphNode) {
        // Do not modify internalState for subgraph nodes
        const rightSidePanelStore = useRightSidePanelStore()
        if (value) {
          rightSidePanelStore.focusSection('advanced-inputs')
        } else {
          rightSidePanelStore.closePanel()
        }
      } else {
        node.showAdvanced = value
        internalState = value
      }
      trigger()
    }
  }
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

// Drag and drop support
const isDraggingOver = ref(false)

function handleDragOver(event: DragEvent) {
  const node = lgraphNode.value
  if (!node || !node.onDragOver) {
    isDraggingOver.value = false
    return
  }

  // Call the litegraph node's onDragOver callback to check if files are valid
  const canDrop = node.onDragOver(event)
  isDraggingOver.value = canDrop
}

function handleDragLeave() {
  isDraggingOver.value = false
}

async function handleDrop(event: DragEvent) {
  isDraggingOver.value = false

  const node = lgraphNode.value
  if (!node || !node.onDragDrop) {
    return
  }

  // Forward the drop event to the litegraph node's onDragDrop callback
  await node.onDragDrop(event)
}
</script>
