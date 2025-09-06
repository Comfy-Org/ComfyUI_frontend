<template>
  <!-- Load splitter overlay only after comfyApp is ready. -->
  <!-- If load immediately, the top-level splitter stateKey won't be correctly
  synced with the stateStorage (localStorage). -->
  <LiteGraphCanvasSplitterOverlay v-if="comfyAppReady && betaMenuEnabled">
    <template v-if="!workspaceStore.focusMode" #side-bar-panel>
      <SideToolbar />
    </template>
    <template v-if="!workspaceStore.focusMode" #bottom-panel>
      <BottomPanel />
    </template>
    <template #graph-canvas-panel>
      <div class="absolute top-0 left-0 w-auto max-w-full pointer-events-auto">
        <SecondRowWorkflowTabs
          v-if="workflowTabsPosition === 'Topbar (2nd-row)'"
        />
      </div>
      <GraphCanvasMenu v-if="canvasMenuEnabled" class="pointer-events-auto" />

      <MiniMap
        v-if="comfyAppReady && minimapEnabled"
        class="pointer-events-auto"
      />
    </template>
  </LiteGraphCanvasSplitterOverlay>
  <GraphCanvasMenu v-if="!betaMenuEnabled && canvasMenuEnabled" />
  <canvas
    id="graph-canvas"
    ref="canvasRef"
    tabindex="1"
    class="w-full h-full touch-none"
  />

  <!-- TransformPane for Vue node rendering -->
  <TransformPane
    v-if="isVueNodesEnabled && canvasStore.canvas && comfyAppReady"
    :canvas="canvasStore.canvas as LGraphCanvas"
    @transform-update="handleTransformUpdate"
  >
    <!-- Vue nodes rendered based on graph nodes -->
    <VueGraphNode
      v-for="nodeData in nodesToRender"
      :key="nodeData.id"
      :node-data="nodeData"
      :position="nodePositions.get(nodeData.id)"
      :size="nodeSizes.get(nodeData.id)"
      :selected="nodeData.selected"
      :readonly="false"
      :executing="executionStore.executingNodeId === nodeData.id"
      :error="
        executionStore.lastExecutionError?.node_id === nodeData.id
          ? 'Execution error'
          : null
      "
      :zoom-level="canvasStore.canvas?.ds?.scale || 1"
      :data-node-id="nodeData.id"
      @node-click="handleNodeSelect"
      @update:collapsed="handleNodeCollapse"
      @update:title="handleNodeTitleUpdate"
    />
  </TransformPane>

  <NodeTooltip v-if="tooltipEnabled" />
  <NodeSearchboxPopover ref="nodeSearchboxPopoverRef" />

  <!-- Initialize components after comfyApp is ready. useAbsolutePosition requires
  canvasStore.canvas to be initialized. -->
  <template v-if="comfyAppReady">
    <TitleEditor />
    <SelectionToolbox v-if="selectionToolboxEnabled" />
    <!-- Render legacy DOM widgets only when Vue nodes are disabled -->
    <DomWidgets v-if="!shouldRenderVueNodes" />
  </template>
</template>

<script setup lang="ts">
import { useEventListener, whenever } from '@vueuse/core'
import {
  computed,
  onMounted,
  onUnmounted,
  ref,
  shallowRef,
  watch,
  watchEffect
} from 'vue'

import LiteGraphCanvasSplitterOverlay from '@/components/LiteGraphCanvasSplitterOverlay.vue'
import BottomPanel from '@/components/bottomPanel/BottomPanel.vue'
import DomWidgets from '@/components/graph/DomWidgets.vue'
import GraphCanvasMenu from '@/components/graph/GraphCanvasMenu.vue'
import NodeTooltip from '@/components/graph/NodeTooltip.vue'
import SelectionToolbox from '@/components/graph/SelectionToolbox.vue'
import TitleEditor from '@/components/graph/TitleEditor.vue'
import NodeSearchboxPopover from '@/components/searchbox/NodeSearchBoxPopover.vue'
import SideToolbar from '@/components/sidebar/SideToolbar.vue'
import SecondRowWorkflowTabs from '@/components/topbar/SecondRowWorkflowTabs.vue'
import { useChainCallback } from '@/composables/functional/useChainCallback'
import { useGraphNodeManager } from '@/composables/graph/useGraphNodeManager'
import type {
  NodeState,
  VueNodeData
} from '@/composables/graph/useGraphNodeManager'
import { useNodeBadge } from '@/composables/node/useNodeBadge'
import { useCanvasDrop } from '@/composables/useCanvasDrop'
import { useContextMenuTranslation } from '@/composables/useContextMenuTranslation'
import { useCopy } from '@/composables/useCopy'
import { useGlobalLitegraph } from '@/composables/useGlobalLitegraph'
import { useLitegraphSettings } from '@/composables/useLitegraphSettings'
import { usePaste } from '@/composables/usePaste'
import { useVueFeatureFlags } from '@/composables/useVueFeatureFlags'
import { useWorkflowAutoSave } from '@/composables/useWorkflowAutoSave'
import { useWorkflowPersistence } from '@/composables/useWorkflowPersistence'
import { CORE_SETTINGS } from '@/constants/coreSettings'
import { i18n, t } from '@/i18n'
import type { LGraphCanvas, LGraphNode } from '@/lib/litegraph/src/litegraph'
import TransformPane from '@/renderer/core/layout/TransformPane.vue'
import { useLayoutMutations } from '@/renderer/core/layout/operations/layoutMutations'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { useLayoutSync } from '@/renderer/core/layout/sync/useLayoutSync'
import { useLinkLayoutSync } from '@/renderer/core/layout/sync/useLinkLayoutSync'
import { useSlotLayoutSync } from '@/renderer/core/layout/sync/useSlotLayoutSync'
import { LayoutSource } from '@/renderer/core/layout/types'
import { useTransformState } from '@/renderer/core/layout/useTransformState'
import MiniMap from '@/renderer/extensions/minimap/MiniMap.vue'
import VueGraphNode from '@/renderer/extensions/vueNodes/components/LGraphNode.vue'
import { UnauthorizedError, api } from '@/scripts/api'
import { app as comfyApp } from '@/scripts/app'
import { ChangeTracker } from '@/scripts/changeTracker'
import { IS_CONTROL_WIDGET, updateControlWidgetLabel } from '@/scripts/widgets'
import { useColorPaletteService } from '@/services/colorPaletteService'
import { newUserService } from '@/services/newUserService'
import { useWorkflowService } from '@/services/workflowService'
import { useCommandStore } from '@/stores/commandStore'
import { useExecutionStore } from '@/stores/executionStore'
import { useCanvasStore } from '@/stores/graphStore'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import { useSettingStore } from '@/stores/settingStore'
import { useToastStore } from '@/stores/toastStore'
import { useWorkflowStore } from '@/stores/workflowStore'
import { useColorPaletteStore } from '@/stores/workspace/colorPaletteStore'
import { useSearchBoxStore } from '@/stores/workspace/searchBoxStore'
import { useWorkspaceStore } from '@/stores/workspaceStore'

const emit = defineEmits<{
  ready: []
}>()
const canvasRef = ref<HTMLCanvasElement | null>(null)
const nodeSearchboxPopoverRef = shallowRef<InstanceType<
  typeof NodeSearchboxPopover
> | null>(null)
const settingStore = useSettingStore()
const nodeDefStore = useNodeDefStore()
const workspaceStore = useWorkspaceStore()
const canvasStore = useCanvasStore()
const executionStore = useExecutionStore()
const toastStore = useToastStore()
const layoutMutations = useLayoutMutations()
const betaMenuEnabled = computed(
  () => settingStore.get('Comfy.UseNewMenu') !== 'Disabled'
)
const workflowTabsPosition = computed(() =>
  settingStore.get('Comfy.Workflow.WorkflowTabsPosition')
)
const canvasMenuEnabled = computed(() =>
  settingStore.get('Comfy.Graph.CanvasMenu')
)
const tooltipEnabled = computed(() => settingStore.get('Comfy.EnableTooltips'))
const selectionToolboxEnabled = computed(() =>
  settingStore.get('Comfy.Canvas.SelectionToolbox')
)

const minimapEnabled = computed(() => settingStore.get('Comfy.Minimap.Visible'))

// Feature flags (Vue-related)
const { shouldRenderVueNodes } = useVueFeatureFlags()

const isVueNodesEnabled = computed(() => shouldRenderVueNodes.value)

// Vue node lifecycle management - initialize after graph is ready
let nodeManager: ReturnType<typeof useGraphNodeManager> | null = null
let cleanupNodeManager: (() => void) | null = null

// Slot layout sync management
let slotSync: ReturnType<typeof useSlotLayoutSync> | null = null
let slotSyncStarted = false
let linkSync: ReturnType<typeof useLinkLayoutSync> | null = null
const vueNodeData = ref<ReadonlyMap<string, VueNodeData>>(new Map())
const nodeState = ref<ReadonlyMap<string, NodeState>>(new Map())
const nodePositions = ref<ReadonlyMap<string, { x: number; y: number }>>(
  new Map()
)
const nodeSizes = ref<ReadonlyMap<string, { width: number; height: number }>>(
  new Map()
)
let detectChangesInRAF = () => {}

// Initialize node manager when graph becomes available
// Add a reactivity trigger to force computed re-evaluation
const nodeDataTrigger = ref(0)

const initializeNodeManager = () => {
  if (!comfyApp.graph || nodeManager) return
  nodeManager = useGraphNodeManager(comfyApp.graph)
  cleanupNodeManager = nodeManager.cleanup
  // Use the manager's reactive maps directly
  vueNodeData.value = nodeManager.vueNodeData
  nodeState.value = nodeManager.nodeState
  nodePositions.value = nodeManager.nodePositions
  nodeSizes.value = nodeManager.nodeSizes
  detectChangesInRAF = nodeManager.detectChangesInRAF

  // Initialize layout system with existing nodes
  const nodes = comfyApp.graph._nodes.map((node: any) => ({
    id: node.id.toString(),
    pos: node.pos,
    size: node.size
  }))
  layoutStore.initializeFromLiteGraph(nodes)

  // Seed reroutes into the Layout Store so hit-testing uses the new path
  for (const reroute of comfyApp.graph.reroutes.values()) {
    const [x, y] = reroute.pos
    const parent = reroute.parentId ?? undefined
    const linkIds = Array.from(reroute.linkIds)
    layoutMutations.createReroute(reroute.id, { x, y }, parent, linkIds)
  }

  // Seed existing links into the Layout Store (topology only)
  for (const link of comfyApp.graph._links.values()) {
    layoutMutations.createLink(
      link.id,
      link.origin_id,
      link.origin_slot,
      link.target_id,
      link.target_slot
    )
  }

  // Initialize layout sync (one-way: Layout Store → LiteGraph)
  const { startSync } = useLayoutSync()
  startSync(canvasStore.canvas)

  // Initialize link layout sync for event-driven updates
  linkSync = useLinkLayoutSync()
  if (canvasStore.canvas) {
    linkSync.start(canvasStore.canvas as LGraphCanvas)
  }

  // Force computed properties to re-evaluate
  nodeDataTrigger.value++
}

const disposeNodeManagerAndSyncs = () => {
  if (!nodeManager) return
  try {
    cleanupNodeManager?.()
  } catch {
    /* empty */
  }
  nodeManager = null
  cleanupNodeManager = null

  // Clean up link layout sync
  if (linkSync) {
    linkSync.stop()
    linkSync = null
  }

  // Reset reactive maps to inert defaults
  vueNodeData.value = new Map()
  nodeState.value = new Map()
  nodePositions.value = new Map()
  nodeSizes.value = new Map()
}

// Watch for transformPaneEnabled to gate the node manager lifecycle
watch(
  () => isVueNodesEnabled.value && Boolean(comfyApp.graph),
  (enabled) => {
    if (enabled) {
      initializeNodeManager()
    } else {
      disposeNodeManagerAndSyncs()
    }
  },
  { immediate: true }
)

// Consolidated watch for slot layout sync management
watch(
  [() => canvasStore.canvas, () => isVueNodesEnabled.value],
  ([canvas, vueMode], [, oldVueMode]) => {
    const modeChanged = vueMode !== oldVueMode

    // Clear stale slot layouts when switching modes
    if (modeChanged) {
      layoutStore.clearAllSlotLayouts()
    }

    // Switching to Vue
    if (vueMode && slotSyncStarted) {
      slotSync?.stop()
      slotSyncStarted = false
    }

    // Switching to LG
    const shouldRun = Boolean(canvas?.graph) && !vueMode
    if (shouldRun && !slotSyncStarted && canvas) {
      // Initialize slot sync if not already created
      if (!slotSync) {
        slotSync = useSlotLayoutSync()
      }
      const started = slotSync.attemptStart(canvas as LGraphCanvas)
      slotSyncStarted = started
    }
  },
  { immediate: true }
)

// Transform state for viewport culling
const { syncWithCanvas } = useTransformState()

const nodesToRender = computed(() => {
  // Early return for zero overhead when Vue nodes are disabled
  if (!isVueNodesEnabled.value) {
    return []
  }

  // Access trigger to force re-evaluation after nodeManager initialization
  void nodeDataTrigger.value

  if (!comfyApp.graph) {
    return []
  }

  const allNodes = Array.from(vueNodeData.value.values())

  // Apply viewport culling - check if node bounds intersect with viewport
  if (nodeManager && canvasStore.canvas && comfyApp.canvas) {
    const canvas = canvasStore.canvas
    const manager = nodeManager

    // Ensure transform is synced before checking visibility
    syncWithCanvas(comfyApp.canvas)

    const ds = canvas.ds

    // Work in screen space - viewport is simply the canvas element size
    const viewport_width = canvas.canvas.width
    const viewport_height = canvas.canvas.height

    // Add margin that represents a constant distance in canvas space
    // Convert canvas units to screen pixels by multiplying by scale
    const canvasMarginDistance = 200 // Fixed margin in canvas units
    const margin_x = canvasMarginDistance * ds.scale
    const margin_y = canvasMarginDistance * ds.scale

    const filtered = allNodes.filter((nodeData) => {
      const node = manager.getNode(nodeData.id)
      if (!node) return false

      // Transform node position to screen space (same as DOM widgets)
      const screen_x = (node.pos[0] + ds.offset[0]) * ds.scale
      const screen_y = (node.pos[1] + ds.offset[1]) * ds.scale
      const screen_width = node.size[0] * ds.scale
      const screen_height = node.size[1] * ds.scale

      // Check if node bounds intersect with expanded viewport (in screen space)
      const isVisible = !(
        screen_x + screen_width < -margin_x ||
        screen_x > viewport_width + margin_x ||
        screen_y + screen_height < -margin_y ||
        screen_y > viewport_height + margin_y
      )

      return isVisible
    })

    return filtered
  }

  return allNodes
})

let lastScale = 1
let lastOffsetX = 0
let lastOffsetY = 0

const handleTransformUpdate = () => {
  // Skip all work if Vue nodes are disabled
  if (!isVueNodesEnabled.value) {
    return
  }

  // Sync transform state only when it changes (avoids reflows)
  if (comfyApp.canvas?.ds) {
    const currentScale = comfyApp.canvas.ds.scale
    const currentOffsetX = comfyApp.canvas.ds.offset[0]
    const currentOffsetY = comfyApp.canvas.ds.offset[1]

    if (
      currentScale !== lastScale ||
      currentOffsetX !== lastOffsetX ||
      currentOffsetY !== lastOffsetY
    ) {
      syncWithCanvas(comfyApp.canvas)
      lastScale = currentScale
      lastOffsetX = currentOffsetX
      lastOffsetY = currentOffsetY
    }
  }

  // Detect node changes during transform updates
  detectChangesInRAF()

  // Trigger reactivity for nodesToRender
  void nodesToRender.value.length
}

// Node event handlers
const handleNodeSelect = (event: PointerEvent, nodeData: VueNodeData) => {
  if (!canvasStore.canvas || !nodeManager) return

  const node = nodeManager.getNode(nodeData.id)
  if (!node) return

  if (!event.ctrlKey && !event.metaKey) {
    canvasStore.canvas.deselectAllNodes()
  }

  canvasStore.canvas.selectNode(node)

  // Bring node to front when clicked (similar to LiteGraph behavior)
  // Skip if node is pinned
  if (!node.flags?.pinned) {
    layoutMutations.setSource(LayoutSource.Vue)
    layoutMutations.bringNodeToFront(nodeData.id)
  }
  node.selected = true

  canvasStore.updateSelectedItems()
}

// Handle node collapse state changes
const handleNodeCollapse = (nodeId: string, collapsed: boolean) => {
  if (!nodeManager) return

  const node = nodeManager.getNode(nodeId)
  if (!node) return

  // Use LiteGraph's collapse method if the state needs to change
  const currentCollapsed = node.flags?.collapsed ?? false
  if (currentCollapsed !== collapsed) {
    node.collapse()
  }
}

// Handle node title updates
const handleNodeTitleUpdate = (nodeId: string, newTitle: string) => {
  if (!nodeManager) return

  const node = nodeManager.getNode(nodeId)
  if (!node) return

  // Update the node title in LiteGraph for persistence
  node.title = newTitle
}

watchEffect(() => {
  nodeDefStore.showDeprecated = settingStore.get('Comfy.Node.ShowDeprecated')
})

watchEffect(() => {
  nodeDefStore.showExperimental = settingStore.get(
    'Comfy.Node.ShowExperimental'
  )
})

watchEffect(() => {
  const spellcheckEnabled = settingStore.get('Comfy.TextareaWidget.Spellcheck')
  const textareas = document.querySelectorAll<HTMLTextAreaElement>(
    'textarea.comfy-multiline-input'
  )

  textareas.forEach((textarea: HTMLTextAreaElement) => {
    textarea.spellcheck = spellcheckEnabled
    // Force recheck to ensure visual update
    textarea.focus()
    textarea.blur()
  })
})

watch(
  () => settingStore.get('Comfy.WidgetControlMode'),
  () => {
    if (!canvasStore.canvas) return

    for (const n of comfyApp.graph.nodes) {
      if (!n.widgets) continue
      for (const w of n.widgets) {
        // @ts-expect-error fixme ts strict error
        if (w[IS_CONTROL_WIDGET]) {
          updateControlWidgetLabel(w)
          if (w.linkedWidgets) {
            for (const l of w.linkedWidgets) {
              updateControlWidgetLabel(l)
            }
          }
        }
      }
    }
    comfyApp.graph.setDirtyCanvas(true)
  }
)

const colorPaletteService = useColorPaletteService()
const colorPaletteStore = useColorPaletteStore()
watch(
  [() => canvasStore.canvas, () => settingStore.get('Comfy.ColorPalette')],
  async ([canvas, currentPaletteId]) => {
    if (!canvas) return

    await colorPaletteService.loadColorPalette(currentPaletteId)
  }
)

watch(
  () => settingStore.get('Comfy.Canvas.BackgroundImage'),
  async () => {
    if (!canvasStore.canvas) return
    const currentPaletteId = colorPaletteStore.activePaletteId
    if (!currentPaletteId) return

    // Reload color palette to apply background image
    await colorPaletteService.loadColorPalette(currentPaletteId)
    // Mark background canvas as dirty
    canvasStore.canvas.setDirty(false, true)
  }
)
watch(
  () => colorPaletteStore.activePaletteId,
  async (newValue) => {
    await settingStore.set('Comfy.ColorPalette', newValue)
  }
)

// Update the progress of executing nodes
watch(
  () =>
    [executionStore.nodeLocationProgressStates, canvasStore.canvas] as const,
  ([nodeLocationProgressStates, canvas]) => {
    if (!canvas?.graph) return
    for (const node of canvas.graph.nodes) {
      const nodeLocatorId = useWorkflowStore().nodeIdToNodeLocatorId(node.id)
      const progressState = nodeLocationProgressStates[nodeLocatorId]
      if (progressState && progressState.state === 'running') {
        node.progress = progressState.value / progressState.max
      } else {
        node.progress = undefined
      }
    }

    // Force canvas redraw to ensure progress updates are visible
    canvas.graph.setDirtyCanvas(true, false)
  },
  { deep: true }
)

// Update node slot errors
watch(
  () => executionStore.lastNodeErrors,
  (lastNodeErrors) => {
    const removeSlotError = (node: LGraphNode) => {
      for (const slot of node.inputs) {
        delete slot.hasErrors
      }
      for (const slot of node.outputs) {
        delete slot.hasErrors
      }
    }

    for (const node of comfyApp.graph.nodes) {
      removeSlotError(node)
      const nodeErrors = lastNodeErrors?.[node.id]
      if (!nodeErrors) continue
      for (const error of nodeErrors.errors) {
        if (error.extra_info && error.extra_info.input_name) {
          const inputIndex = node.findInputSlot(error.extra_info.input_name)
          if (inputIndex !== -1) {
            node.inputs[inputIndex].hasErrors = true
          }
        }
      }
    }

    comfyApp.canvas.draw(true, true)
  }
)

useEventListener(
  canvasRef,
  'litegraph:no-items-selected',
  () => {
    toastStore.add({
      severity: 'warn',
      summary: t('toastMessages.nothingSelected'),
      life: 2000
    })
  },
  { passive: true }
)

const loadCustomNodesI18n = async () => {
  try {
    const i18nData = await api.getCustomNodesI18n()
    Object.entries(i18nData).forEach(([locale, message]) => {
      i18n.global.mergeLocaleMessage(locale, message)
    })
  } catch (error) {
    console.error('Failed to load custom nodes i18n', error)
  }
}

const comfyAppReady = ref(false)
const workflowPersistence = useWorkflowPersistence()
// @ts-expect-error fixme ts strict error
useCanvasDrop(canvasRef)
useLitegraphSettings()
useNodeBadge()

onMounted(async () => {
  useGlobalLitegraph()
  useContextMenuTranslation()
  useCopy()
  usePaste()
  useWorkflowAutoSave()
  useVueFeatureFlags()

  comfyApp.vueAppReady = true

  workspaceStore.spinner = true
  // ChangeTracker needs to be initialized before setup, as it will overwrite
  // some listeners of litegraph canvas.
  ChangeTracker.init()
  await loadCustomNodesI18n()
  try {
    await settingStore.loadSettingValues()
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      localStorage.removeItem('Comfy.userId')
      localStorage.removeItem('Comfy.userName')
      window.location.reload()
    } else {
      throw error
    }
  }
  CORE_SETTINGS.forEach((setting) => {
    settingStore.addSetting(setting)
  })

  await newUserService().initializeIfNewUser(settingStore)

  // @ts-expect-error fixme ts strict error
  await comfyApp.setup(canvasRef.value)
  canvasStore.canvas = comfyApp.canvas
  canvasStore.canvas.render_canvas_border = false
  workspaceStore.spinner = false
  useSearchBoxStore().setPopoverRef(nodeSearchboxPopoverRef.value)

  window.app = comfyApp
  window.graph = comfyApp.graph

  comfyAppReady.value = true

  // Set up Vue node initialization only when enabled
  if (isVueNodesEnabled.value) {
    // Set up a one-time listener for when the first node is added
    // This handles the case where Vue nodes are enabled but the graph starts empty
    // TODO: Replace this with a reactive graph mutations observer when available
    if (comfyApp.graph && !nodeManager && comfyApp.graph._nodes.length === 0) {
      const originalOnNodeAdded = comfyApp.graph.onNodeAdded
      comfyApp.graph.onNodeAdded = function (node: any) {
        // Restore original handler
        comfyApp.graph.onNodeAdded = originalOnNodeAdded

        // Initialize node manager if needed
        if (isVueNodesEnabled.value && !nodeManager) {
          initializeNodeManager()
        }

        // Call original handler
        if (originalOnNodeAdded) {
          originalOnNodeAdded.call(this, node)
        }
      }
    }
  }

  comfyApp.canvas.onSelectionChange = useChainCallback(
    comfyApp.canvas.onSelectionChange,
    () => canvasStore.updateSelectedItems()
  )

  // Load color palette
  colorPaletteStore.customPalettes = settingStore.get(
    'Comfy.CustomColorPalettes'
  )

  // Restore workflow and workflow tabs state from storage
  await workflowPersistence.restorePreviousWorkflow()
  workflowPersistence.restoreWorkflowTabsState()

  // Initialize release store to fetch releases from comfy-api (fire-and-forget)
  const { useReleaseStore } = await import('@/stores/releaseStore')
  const releaseStore = useReleaseStore()
  void releaseStore.initialize()

  // Start watching for locale change after the initial value is loaded.
  watch(
    () => settingStore.get('Comfy.Locale'),
    async () => {
      await useCommandStore().execute('Comfy.RefreshNodeDefinitions')
      await useWorkflowService().reloadCurrentWorkflow()
    }
  )

  whenever(
    () => useCanvasStore().canvas,
    (canvas) => {
      useEventListener(canvas.canvas, 'litegraph:set-graph', () => {
        useWorkflowStore().updateActiveGraph()
      })
    },
    { immediate: true }
  )

  emit('ready')
})

onUnmounted(() => {
  if (nodeManager) {
    nodeManager.cleanup()
    nodeManager = null
  }
  if (slotSyncStarted) {
    slotSync?.stop()
    slotSyncStarted = false
  }
  slotSync = null
  if (linkSync) {
    linkSync.stop()
    linkSync = null
  }
})
</script>
