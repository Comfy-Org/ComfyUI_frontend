<template>
  <!-- Load splitter overlay only after comfyApp is ready. -->
  <!-- If load immediately, the top-level splitter stateKey won't be correctly
  synced with the stateStorage (localStorage). -->
  <LiteGraphCanvasSplitterOverlay
    v-if="comfyAppReady && betaMenuEnabled && !workspaceStore.focusMode"
  >
    <template #side-bar-panel>
      <SideToolbar />
    </template>
    <template #bottom-panel>
      <BottomPanel />
    </template>
    <template #graph-canvas-panel>
      <div class="absolute top-0 left-0 w-auto max-w-full pointer-events-auto">
        <SecondRowWorkflowTabs
          v-if="workflowTabsPosition === 'Topbar (2nd-row)'"
        />
        <SubgraphBreadcrumb />
      </div>
      <GraphCanvasMenu v-if="canvasMenuEnabled" class="pointer-events-auto" />
    </template>
  </LiteGraphCanvasSplitterOverlay>
  <GraphCanvasMenu v-if="!betaMenuEnabled && canvasMenuEnabled" />
  <canvas
    id="graph-canvas"
    ref="canvasRef"
    tabindex="1"
    class="w-full h-full touch-none"
  />

  <!-- TransformPane for Vue node rendering (development) -->
  <TransformPane
    v-if="transformPaneEnabled && canvasStore.canvas && comfyAppReady"
    :canvas="canvasStore.canvas as any"
    :viewport="canvasViewport"
    @raf-status-change="rafActive = $event"
    @transform-update="handleTransformUpdate"
  >
    <!-- Vue nodes rendered based on graph nodes -->
    <VueGraphNode
      v-for="node in nodesToRender"
      :key="node.id"
      :node="node"
      :position="nodePositions.get(String(node.id))"
      :size="nodeSizes.get(String(node.id))"
      :selected="canvasStore.canvas?.selectedItems?.has(node) || false"
      :readonly="false"
      :executing="executionStore.executingNodeId === node.id"
      :error="executionStore.lastExecutionError?.node_id === String(node.id) ? 'Execution error' : null"
      :data-node-id="node.id"
      @select="handleNodeSelect"
      @widget-change="handleWidgetChange"
    />
  </TransformPane>

  <!-- TransformPane Debug Controls -->
  <div
    class="fixed top-20 right-4 bg-surface-0 dark-theme:bg-surface-800 p-4 rounded-lg shadow-lg border border-surface-300 dark-theme:border-surface-600 z-50 pointer-events-auto w-80"
    style="contain: layout style"
  >
    <h3 class="font-bold mb-2 text-sm">TransformPane Debug</h3>
    <div class="space-y-2 text-xs">
      <div>
        <label class="flex items-center gap-2">
          <input type="checkbox" v-model="transformPaneEnabled" />
          <span>Enable TransformPane</span>
        </label>
      </div>
      
      <!-- Canvas Metrics -->
      <div class="pt-2 border-t border-surface-200 dark-theme:border-surface-700">
        <h4 class="font-semibold mb-1">Canvas State</h4>
        <p class="text-muted">Status: {{ canvasStore.canvas ? 'Ready' : 'Not Ready' }}</p>
        <p class="text-muted">Viewport: {{ Math.round(canvasViewport.width) }}x{{ Math.round(canvasViewport.height) }}</p>
        <template v-if="canvasStore.canvas?.ds">
          <p class="text-muted">Offset: ({{ Math.round(canvasStore.canvas.ds.offset[0]) }}, {{ Math.round(canvasStore.canvas.ds.offset[1]) }})</p>
          <p class="text-muted">Scale: {{ canvasStore.canvas.ds.scale?.toFixed(3) || 1 }}</p>
        </template>
      </div>

      <!-- Node Metrics -->
      <div class="pt-2 border-t border-surface-200 dark-theme:border-surface-700">
        <h4 class="font-semibold mb-1">Graph Metrics</h4>
        <p class="text-muted">Total Nodes: {{ comfyApp.graph?.nodes?.length || 0 }}</p>
        <p class="text-muted">Selected Nodes: {{ canvasStore.canvas?.selectedItems?.size || 0 }}</p>
        <p class="text-muted">Vue Nodes Rendered: {{ vueNodesCount }}</p>
        <p class="text-muted">Nodes in Viewport: {{ nodesInViewport }}</p>
        <p class="text-muted">Culled Nodes: {{ performanceMetrics.culledCount }}</p>
        <p class="text-muted">Cull Percentage: {{ Math.round(((vueNodesCount - nodesInViewport) / Math.max(vueNodesCount, 1)) * 100) }}%</p>
      </div>

      <!-- Performance Metrics -->
      <div class="pt-2 border-t border-surface-200 dark-theme:border-surface-700">
        <h4 class="font-semibold mb-1">Performance</h4>
        <p class="text-muted" v-memo="[currentFPS]">FPS: {{ currentFPS }}</p>
        <p class="text-muted" v-memo="[Math.round(lastTransformTime)]">Transform Update: {{ Math.round(lastTransformTime) }}ms</p>
        <p class="text-muted" v-memo="[Math.round(performanceMetrics.updateTime)]">Lifecycle Update: {{ Math.round(performanceMetrics.updateTime) }}ms</p>
        <p class="text-muted" v-memo="[rafActive]">RAF Active: {{ rafActive ? 'Yes' : 'No' }}</p>
        <p class="text-muted" v-memo="[performanceMetrics.adaptiveQuality]">Adaptive Quality: {{ performanceMetrics.adaptiveQuality ? 'On' : 'Off' }}</p>
      </div>

      <!-- Node Rendering Options -->
      <div class="pt-2 border-t border-surface-200 dark-theme:border-surface-700" v-if="transformPaneEnabled">
        <h4 class="font-semibold mb-1">Rendering Options</h4>
        <label class="flex items-center gap-2 mb-1">
          <input type="checkbox" v-model="renderAllNodes" />
          <span>Render All Nodes as Vue</span>
        </label>
        <label class="flex items-center gap-2 mb-1">
          <input type="checkbox" v-model="viewportCullingEnabled" />
          <span>Viewport Culling</span>
        </label>
        <div class="ml-4 mb-1" v-if="viewportCullingEnabled">
          <label class="text-xs">
            Culling Margin: {{ (cullingMargin * 100).toFixed(0) }}%
          </label>
          <input 
            type="range" 
            v-model.number="cullingMargin" 
            min="0" 
            max="1" 
            step="0.05"
            class="w-full"
          />
        </div>
        <label class="flex items-center gap-2">
          <input type="checkbox" v-model="showPerformanceOverlay" />
          <span>Show Performance Overlay</span>
        </label>
      </div>
    </div>
  </div>

  <NodeTooltip v-if="tooltipEnabled" />
  <NodeSearchboxPopover />

  <!-- Initialize components after comfyApp is ready. useAbsolutePosition requires
  canvasStore.canvas to be initialized. -->
  <template v-if="comfyAppReady">
    <TitleEditor />
    <SelectionOverlay v-if="selectionToolboxEnabled">
      <SelectionToolbox />
    </SelectionOverlay>
    <DomWidgets />
  </template>
</template>

<script setup lang="ts">
import type { LGraphNode } from '@comfyorg/litegraph'
import { useEventListener, whenever } from '@vueuse/core'
import { computed, onMounted, onUnmounted, reactive, ref, shallowRef, watch, watchEffect } from 'vue'

import LiteGraphCanvasSplitterOverlay from '@/components/LiteGraphCanvasSplitterOverlay.vue'
import BottomPanel from '@/components/bottomPanel/BottomPanel.vue'
import SubgraphBreadcrumb from '@/components/breadcrumb/SubgraphBreadcrumb.vue'
import DomWidgets from '@/components/graph/DomWidgets.vue'
import GraphCanvasMenu from '@/components/graph/GraphCanvasMenu.vue'
import NodeTooltip from '@/components/graph/NodeTooltip.vue'
import SelectionOverlay from '@/components/graph/SelectionOverlay.vue'
import SelectionToolbox from '@/components/graph/SelectionToolbox.vue'
import TitleEditor from '@/components/graph/TitleEditor.vue'
import TransformPane from '@/components/graph/TransformPane.vue'
import VueGraphNode from '@/components/graph/vueNodes/LGraphNode.vue'
import NodeSearchboxPopover from '@/components/searchbox/NodeSearchBoxPopover.vue'
import SideToolbar from '@/components/sidebar/SideToolbar.vue'
import SecondRowWorkflowTabs from '@/components/topbar/SecondRowWorkflowTabs.vue'
import { useChainCallback } from '@/composables/functional/useChainCallback'
import { useNodeBadge } from '@/composables/node/useNodeBadge'
import { useCanvasDrop } from '@/composables/useCanvasDrop'
import { useContextMenuTranslation } from '@/composables/useContextMenuTranslation'
import { useCopy } from '@/composables/useCopy'
import { useGlobalLitegraph } from '@/composables/useGlobalLitegraph'
import { useLitegraphSettings } from '@/composables/useLitegraphSettings'
import { usePaste } from '@/composables/usePaste'
import { useWorkflowAutoSave } from '@/composables/useWorkflowAutoSave'
import { useWorkflowPersistence } from '@/composables/useWorkflowPersistence'
import { CORE_SETTINGS } from '@/constants/coreSettings'
import { i18n, t } from '@/i18n'
import type { NodeId } from '@/schemas/comfyWorkflowSchema'
import { UnauthorizedError, api } from '@/scripts/api'
import { app as comfyApp } from '@/scripts/app'
import { ChangeTracker } from '@/scripts/changeTracker'
import { IS_CONTROL_WIDGET, updateControlWidgetLabel } from '@/scripts/widgets'
import { useColorPaletteService } from '@/services/colorPaletteService'
import { useWorkflowService } from '@/services/workflowService'
import { useCommandStore } from '@/stores/commandStore'
import { useExecutionStore } from '@/stores/executionStore'
import { useCanvasStore } from '@/stores/graphStore'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import { useSettingStore } from '@/stores/settingStore'
import { useToastStore } from '@/stores/toastStore'
import { useWorkflowStore } from '@/stores/workflowStore'
import { useColorPaletteStore } from '@/stores/workspace/colorPaletteStore'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { useGraphNodeManager } from '@/composables/graph/useGraphNodeManager'
import { useTransformState } from '@/composables/element/useTransformState'
import type { NodeState } from '@/composables/graph/useGraphNodeManager'

const emit = defineEmits<{
  ready: []
}>()
const canvasRef = ref<HTMLCanvasElement | null>(null)
const settingStore = useSettingStore()
const nodeDefStore = useNodeDefStore()
const workspaceStore = useWorkspaceStore()
const canvasStore = useCanvasStore()
const executionStore = useExecutionStore()
const toastStore = useToastStore()
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

// TransformPane development feature flag
const transformPaneEnabled = ref(true) // Default to true
// Account for browser zoom/DPI scaling
const getActualViewport = () => {
  // Get the actual canvas element dimensions which account for zoom
  const canvas = canvasRef.value
  if (canvas) {
    return {
      width: canvas.clientWidth,
      height: canvas.clientHeight
    }
  }
  // Fallback to window dimensions
  return {
    width: window.innerWidth,
    height: window.innerHeight
  }
}

const canvasViewport = ref(getActualViewport())


// Debug metrics - use shallowRef for frequently updating values
const vueNodesCount = shallowRef(0)
const nodesInViewport = shallowRef(0)
const currentFPS = shallowRef(0)
const lastTransformTime = shallowRef(0)
const rafActive = shallowRef(false)

// Rendering options
const renderAllNodes = ref(true) // Default to true
const showPerformanceOverlay = ref(false)

// FPS tracking
let lastTime = performance.now()
let frameCount = 0
let fpsRafId: number | null = null

const updateFPS = () => {
  frameCount++
  const currentTime = performance.now()
  if (currentTime >= lastTime + 1000) {
    currentFPS.value = Math.round((frameCount * 1000) / (currentTime - lastTime))
    frameCount = 0
    lastTime = currentTime
  }
  if (transformPaneEnabled.value) {
    fpsRafId = requestAnimationFrame(updateFPS)
  }
}

// Start FPS tracking when TransformPane is enabled
watch(transformPaneEnabled, (enabled) => {
  if (enabled) {
    fpsRafId = requestAnimationFrame(updateFPS)
  } else {
    // Stop FPS tracking
    if (fpsRafId !== null) {
      cancelAnimationFrame(fpsRafId)
      fpsRafId = null
    }
  }
})

// Update viewport on resize
useEventListener(window, 'resize', () => {
  canvasViewport.value = getActualViewport()
})

// Also update when canvas is ready
watch(canvasRef, () => {
  if (canvasRef.value) {
    canvasViewport.value = getActualViewport()
  }
})

// Vue node lifecycle management - initialize after graph is ready
let nodeManager: ReturnType<typeof useGraphNodeManager> | null = null
const reactiveNodes = ref<Map<string, LGraphNode>>(new Map())
const nodeState = ref<Map<string, NodeState>>(new Map())
const nodePositions = ref<Map<string, { x: number; y: number }>>(new Map())
const nodeSizes = ref<Map<string, { width: number; height: number }>>(new Map())
let detectChangesInRAF = () => {}
const performanceMetrics = reactive({
  frameTime: 0,
  updateTime: 0,
  nodeCount: 0,
  culledCount: 0,
  adaptiveQuality: false
})

// Initialize node manager when graph becomes available
const initializeNodeManager = () => {
  if (!comfyApp.graph || nodeManager) {
      return
  }
  
  
  nodeManager = useGraphNodeManager(comfyApp.graph)
  
  // Instead of copying, just use the manager's reactive maps directly
  reactiveNodes.value = nodeManager.reactiveNodes as Map<string, LGraphNode>
  nodeState.value = nodeManager.nodeState as Map<string, NodeState>
  nodePositions.value = nodeManager.nodePositions as Map<string, { x: number; y: number }>
  nodeSizes.value = nodeManager.nodeSizes as Map<string, { width: number; height: number }>
  
  detectChangesInRAF = nodeManager.detectChangesInRAF
  Object.assign(performanceMetrics, nodeManager.performanceMetrics)
  
}

// Watch for graph availability
watch(() => comfyApp.graph, (graph) => {
  if (graph) {
    initializeNodeManager()
  }
}, { immediate: true })

// Transform state for viewport culling
const { isNodeInViewport } = useTransformState()

// Viewport culling settings
const viewportCullingEnabled = ref(false) // Default to false for testing
const cullingMargin = ref(0.2)

// Replace problematic computed property with proper reactive system
const nodesToRender = computed(() => {
  // Access performanceMetrics to trigger on RAF updates
  const updateCount = performanceMetrics.updateTime
  
  console.log('[GraphCanvas] Computing nodesToRender. renderAllNodes:', renderAllNodes.value, 'reactiveNodes size:', reactiveNodes.value.size, 'updateCount:', updateCount)
  if (!renderAllNodes.value || !comfyApp.graph) {
    return []
  }
  
  const allNodes = Array.from(reactiveNodes.value.values())
  
  // Apply viewport culling
  if (viewportCullingEnabled.value) {
    const filtered = allNodes.filter(node => {
      const inViewport = isNodeInViewport(
        node.pos,
        node.size,
        canvasViewport.value,
        cullingMargin.value
      )
      
      // Don't update the readonly state directly
      // The culling state is just for metrics, not needed for rendering
      
      return inViewport
    })
    return filtered
  }
  
  return allNodes
})

// Remove side effects from computed - use watchers instead
watch(() => reactiveNodes.value.size, (count) => {
  vueNodesCount.value = count
}, { immediate: true })

watch(() => nodesToRender.value.length, (count) => {
  nodesInViewport.value = count
})

// Integrate change detection with TransformPane RAF
const handleTransformUpdate = (time: number) => {
  lastTransformTime.value = time
  // Detect node changes during transform updates
  detectChangesInRAF()
  
  // Update performance metrics
  performanceMetrics.frameTime = time
  
  // Force update of nodesToRender to trigger reactivity
  nodesToRender.value.length // Access to trigger computed
}

// This watcher was removed - no need to hack canvas rendering for Vue nodes

// Node event handlers
const handleNodeSelect = (node: LGraphNode) => {
  if (!canvasStore.canvas) return
  canvasStore.canvas.selectNode(node)
}

const handleWidgetChange = ({ node, widget, value }: { node: LGraphNode, widget: any, value: any }) => {
  // Update widget value
  widget.value = value
  // Trigger node update
  node.onWidgetChanged?.(widget.name, value, null, widget)
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

// Update the progress of the executing node
watch(
  () =>
    [
      executionStore.executingNodeId,
      executionStore.executingNodeProgress
    ] satisfies [NodeId | null, number | null],
  ([executingNodeId, executingNodeProgress]) => {
    for (const node of comfyApp.graph.nodes) {
      if (node.id == executingNodeId) {
        node.progress = executingNodeProgress ?? undefined
      } else {
        node.progress = undefined
      }
    }
  }
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
      console.log(
        'Failed loading user settings, user unauthorized, cleaning local Comfy.userId'
      )
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
  // @ts-expect-error fixme ts strict error
  await comfyApp.setup(canvasRef.value)
  canvasStore.canvas = comfyApp.canvas
  canvasStore.canvas.render_canvas_border = false
  workspaceStore.spinner = false

  window.app = comfyApp
  window.graph = comfyApp.graph

  comfyAppReady.value = true
  
  // Initialize node manager after setup is complete
  if (comfyApp.graph) {
    initializeNodeManager()
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
  // Clean up FPS tracking
  if (fpsRafId !== null) {
    cancelAnimationFrame(fpsRafId)
    fpsRafId = null
  }
})
</script>
