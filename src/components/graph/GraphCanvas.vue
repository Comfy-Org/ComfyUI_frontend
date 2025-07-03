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
    :show-debug-overlay="showPerformanceOverlay"
    @raf-status-change="rafActive = $event"
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
      :data-node-id="nodeData.id"
      @node-click="handleNodeSelect"
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
          <input v-model="debugOverrideVueNodes" type="checkbox" />
          <span>Enable TransformPane</span>
        </label>
      </div>

      <!-- Canvas Metrics -->
      <div
        class="pt-2 border-t border-surface-200 dark-theme:border-surface-700"
      >
        <h4 class="font-semibold mb-1">Canvas State</h4>
        <p class="text-muted">
          Status: {{ canvasStore.canvas ? 'Ready' : 'Not Ready' }}
        </p>
        <p class="text-muted">
          Viewport: {{ Math.round(canvasViewport.width) }}x{{
            Math.round(canvasViewport.height)
          }}
        </p>
        <template v-if="canvasStore.canvas?.ds">
          <p class="text-muted">
            Offset: ({{ Math.round(canvasStore.canvas.ds.offset[0]) }},
            {{ Math.round(canvasStore.canvas.ds.offset[1]) }})
          </p>
          <p class="text-muted">
            Scale: {{ canvasStore.canvas.ds.scale?.toFixed(3) || 1 }}
          </p>
        </template>
      </div>

      <!-- Node Metrics -->
      <div
        class="pt-2 border-t border-surface-200 dark-theme:border-surface-700"
      >
        <h4 class="font-semibold mb-1">Graph Metrics</h4>
        <p class="text-muted">
          Total Nodes: {{ comfyApp.graph?.nodes?.length || 0 }}
        </p>
        <p class="text-muted">
          Selected Nodes: {{ canvasStore.canvas?.selectedItems?.size || 0 }}
        </p>
        <p class="text-muted">Vue Nodes Rendered: {{ vueNodesCount }}</p>
        <p class="text-muted">Nodes in Viewport: {{ nodesInViewport }}</p>
        <p class="text-muted">
          Culled Nodes: {{ performanceMetrics.culledCount }}
        </p>
        <p class="text-muted">
          Cull Percentage:
          {{
            Math.round(
              ((vueNodesCount - nodesInViewport) / Math.max(vueNodesCount, 1)) *
                100
            )
          }}%
        </p>
      </div>

      <!-- Performance Metrics -->
      <div
        class="pt-2 border-t border-surface-200 dark-theme:border-surface-700"
      >
        <h4 class="font-semibold mb-1">Performance</h4>
        <p v-memo="[currentFPS]" class="text-muted">FPS: {{ currentFPS }}</p>
        <p v-memo="[Math.round(lastTransformTime)]" class="text-muted">
          Transform Update: {{ Math.round(lastTransformTime) }}ms
        </p>
        <p
          v-memo="[Math.round(performanceMetrics.updateTime)]"
          class="text-muted"
        >
          Lifecycle Update: {{ Math.round(performanceMetrics.updateTime) }}ms
        </p>
        <p v-memo="[rafActive]" class="text-muted">
          RAF Active: {{ rafActive ? 'Yes' : 'No' }}
        </p>
        <p v-memo="[performanceMetrics.adaptiveQuality]" class="text-muted">
          Adaptive Quality:
          {{ performanceMetrics.adaptiveQuality ? 'On' : 'Off' }}
        </p>
      </div>

      <!-- Feature Flags Status -->
      <div
        v-if="isDevModeEnabled"
        class="pt-2 border-t border-surface-200 dark-theme:border-surface-700"
      >
        <h4 class="font-semibold mb-1">Feature Flags</h4>
        <p class="text-muted text-xs">
          Vue Nodes: {{ shouldRenderVueNodes ? 'Enabled' : 'Disabled' }}
        </p>
        <p class="text-muted text-xs">
          Viewport Culling:
          {{ isViewportCullingEnabled ? 'Enabled' : 'Disabled' }}
        </p>
        <p class="text-muted text-xs">
          Dev Mode: {{ isDevModeEnabled ? 'Enabled' : 'Disabled' }}
        </p>
      </div>

      <!-- Node Rendering Options -->
      <div
        v-if="transformPaneEnabled"
        class="pt-2 border-t border-surface-200 dark-theme:border-surface-700"
      >
        <h4 class="font-semibold mb-1">Debug Overrides</h4>
        <label class="flex items-center gap-2 mb-1">
          <input v-model="renderAllNodes" type="checkbox" />
          <span>Force Render All Nodes</span>
        </label>
        <label class="flex items-center gap-2 mb-1">
          <input v-model="viewportCullingEnabled" type="checkbox" />
          <span>Debug: Viewport Culling</span>
        </label>
        <div v-if="viewportCullingEnabled" class="ml-4 mb-1">
          <label class="text-xs">
            Culling Margin: {{ (cullingMargin * 100).toFixed(0) }}%
          </label>
          <input
            v-model.number="cullingMargin"
            type="range"
            min="0"
            max="1"
            step="0.05"
            class="w-full"
          />
        </div>
        <label class="flex items-center gap-2">
          <input v-model="showPerformanceOverlay" type="checkbox" />
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
import {
  computed,
  onMounted,
  onUnmounted,
  reactive,
  ref,
  shallowRef,
  watch,
  watchEffect
} from 'vue'

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
import { useTransformState } from '@/composables/element/useTransformState'
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
import { useFeatureFlags } from '@/composables/useFeatureFlags'
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

// Feature flags
const {
  shouldRenderVueNodes,
  isViewportCullingEnabled,
  cullingMargin: featureCullingMargin,
  isDevModeEnabled
} = useFeatureFlags()

// TransformPane enabled when Vue nodes are enabled OR debug override
const debugOverrideVueNodes = ref(true) // Default to true for development
const transformPaneEnabled = computed(
  () => shouldRenderVueNodes.value || debugOverrideVueNodes.value
)
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
    currentFPS.value = Math.round(
      (frameCount * 1000) / (currentTime - lastTime)
    )
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
const vueNodeData = ref<Map<string, any>>(new Map())
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

  // Use the manager's reactive maps directly
  vueNodeData.value = nodeManager.vueNodeData as Map<string, any>
  nodeState.value = nodeManager.nodeState as Map<string, NodeState>
  nodePositions.value = nodeManager.nodePositions as Map<
    string,
    { x: number; y: number }
  >
  nodeSizes.value = nodeManager.nodeSizes as Map<
    string,
    { width: number; height: number }
  >

  detectChangesInRAF = nodeManager.detectChangesInRAF
  Object.assign(performanceMetrics, nodeManager.performanceMetrics)
}

// Watch for graph availability
watch(
  () => comfyApp.graph,
  (graph) => {
    if (graph) {
      initializeNodeManager()
    }
  },
  { immediate: true }
)

// Transform state for viewport culling
const { isNodeInViewport } = useTransformState()

// Viewport culling settings - use feature flags as defaults but allow debug override
const viewportCullingEnabled = ref(false) // Debug override, starts false for testing
const cullingMargin = ref(0.2) // Debug override

// Initialize from feature flags
watch(
  isViewportCullingEnabled,
  (enabled) => {
    viewportCullingEnabled.value = enabled
  },
  { immediate: true }
)

watch(
  featureCullingMargin,
  (margin) => {
    cullingMargin.value = margin
  },
  { immediate: true }
)

// Replace problematic computed property with proper reactive system
const nodesToRender = computed(() => {
  // Access performanceMetrics to trigger on RAF updates
  const updateCount = performanceMetrics.updateTime

  console.log(
    '[GraphCanvas] Computing nodesToRender. renderAllNodes:',
    renderAllNodes.value,
    'vueNodeData size:',
    vueNodeData.value.size,
    'updateCount:',
    updateCount,
    'transformPaneEnabled:',
    transformPaneEnabled.value,
    'shouldRenderVueNodes:',
    shouldRenderVueNodes.value
  )
  if (!renderAllNodes.value || !comfyApp.graph) {
    console.log(
      '[GraphCanvas] Early return - renderAllNodes:',
      renderAllNodes.value,
      'graph:',
      !!comfyApp.graph
    )
    return []
  }

  const allNodes = Array.from(vueNodeData.value.values())

  // Apply viewport culling
  if (viewportCullingEnabled.value && nodeManager) {
    const filtered = allNodes.filter((nodeData) => {
      const originalNode = nodeManager?.getNode(nodeData.id)
      if (!originalNode) return false

      const inViewport = isNodeInViewport(
        originalNode.pos,
        originalNode.size,
        canvasViewport.value,
        cullingMargin.value
      )

      return inViewport
    })
    return filtered
  }

  return allNodes
})

// Remove side effects from computed - use watchers instead
watch(
  () => vueNodeData.value.size,
  (count) => {
    vueNodesCount.value = count
  },
  { immediate: true }
)

watch(
  () => nodesToRender.value.length,
  (count) => {
    nodesInViewport.value = count
  }
)

// Integrate change detection with TransformPane RAF
const handleTransformUpdate = (time: number) => {
  lastTransformTime.value = time
  // Detect node changes during transform updates
  detectChangesInRAF()

  // Update performance metrics
  performanceMetrics.frameTime = time

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
  node.selected = true

  canvasStore.updateSelectedItems()
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
