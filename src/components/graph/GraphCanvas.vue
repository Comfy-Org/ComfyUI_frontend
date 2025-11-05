<template>
  <!-- Load splitter overlay only after comfyApp is ready. -->
  <!-- If load immediately, the top-level splitter stateKey won't be correctly
  synced with the stateStorage (localStorage). -->
  <LiteGraphCanvasSplitterOverlay v-if="comfyAppReady">
    <template v-if="showUI" #workflow-tabs>
      <TryVueNodeBanner />
      <div
        v-if="workflowTabsPosition === 'Topbar'"
        class="workflow-tabs-container pointer-events-auto relative h-9.5 w-full"
      >
        <!-- Native drag area for Electron -->
        <div
          v-if="isNativeWindow() && workflowTabsPosition !== 'Topbar'"
          class="app-drag fixed top-0 left-0 z-10 h-[var(--comfy-topbar-height)] w-full"
        />
        <div class="flex h-full items-center">
          <WorkflowTabs />
          <TopbarBadges />
        </div>
      </div>
    </template>
    <template v-if="showUI" #side-toolbar>
      <SideToolbar />
    </template>
    <template v-if="showUI" #side-bar-panel>
      <div
        class="sidebar-content-container h-full w-full overflow-x-hidden overflow-y-auto"
      >
        <ExtensionSlot v-if="activeSidebarTab" :extension="activeSidebarTab" />
      </div>
    </template>
    <template v-if="showUI" #topmenu>
      <TopMenuSection />
    </template>
    <template v-if="showUI" #bottom-panel>
      <BottomPanel />
    </template>
    <template #graph-canvas-panel>
      <GraphCanvasMenu v-if="canvasMenuEnabled" class="pointer-events-auto" />
      <MiniMap
        v-if="comfyAppReady && minimapEnabled && showUI"
        class="pointer-events-auto"
      />
    </template>
  </LiteGraphCanvasSplitterOverlay>
  <canvas
    id="graph-canvas"
    ref="canvasRef"
    tabindex="1"
    class="absolute inset-0 size-full touch-none"
  />

  <!-- TransformPane for Vue node rendering -->
  <TransformPane
    v-if="shouldRenderVueNodes && comfyApp.canvas && comfyAppReady"
    :canvas="comfyApp.canvas"
    @transform-update="handleTransformUpdate"
    @wheel.capture="canvasInteractions.forwardEventToCanvas"
  >
    <!-- Vue nodes rendered based on graph nodes -->
    <LGraphNode
      v-for="nodeData in allNodes"
      :key="nodeData.id"
      :node-data="nodeData"
      :error="
        executionStore.lastExecutionError?.node_id === nodeData.id
          ? 'Execution error'
          : null
      "
      :zoom-level="canvasStore.canvas?.ds?.scale || 1"
      :data-node-id="nodeData.id"
    />
  </TransformPane>

  <NodeTooltip v-if="tooltipEnabled" />
  <NodeSearchboxPopover ref="nodeSearchboxPopoverRef" />

  <!-- Initialize components after comfyApp is ready. useAbsolutePosition requires
  canvasStore.canvas to be initialized. -->
  <template v-if="comfyAppReady">
    <TitleEditor />
    <SelectionToolbox v-if="selectionToolboxEnabled" />
    <NodeOptions />
    <!-- Render legacy DOM widgets only when Vue nodes are disabled -->
    <DomWidgets v-if="!shouldRenderVueNodes" />
  </template>
</template>

<script setup lang="ts">
import { useEventListener, whenever } from '@vueuse/core'
import {
  computed,
  nextTick,
  onMounted,
  onUnmounted,
  ref,
  shallowRef,
  watch,
  watchEffect
} from 'vue'

import LiteGraphCanvasSplitterOverlay from '@/components/LiteGraphCanvasSplitterOverlay.vue'
import TopMenuSection from '@/components/TopMenuSection.vue'
import BottomPanel from '@/components/bottomPanel/BottomPanel.vue'
import ExtensionSlot from '@/components/common/ExtensionSlot.vue'
import DomWidgets from '@/components/graph/DomWidgets.vue'
import GraphCanvasMenu from '@/components/graph/GraphCanvasMenu.vue'
import NodeTooltip from '@/components/graph/NodeTooltip.vue'
import SelectionToolbox from '@/components/graph/SelectionToolbox.vue'
import TitleEditor from '@/components/graph/TitleEditor.vue'
import NodeOptions from '@/components/graph/selectionToolbox/NodeOptions.vue'
import NodeSearchboxPopover from '@/components/searchbox/NodeSearchBoxPopover.vue'
import SideToolbar from '@/components/sidebar/SideToolbar.vue'
import TopbarBadges from '@/components/topbar/TopbarBadges.vue'
import WorkflowTabs from '@/components/topbar/WorkflowTabs.vue'
import { useChainCallback } from '@/composables/functional/useChainCallback'
import type { VueNodeData } from '@/composables/graph/useGraphNodeManager'
import { useViewportCulling } from '@/composables/graph/useViewportCulling'
import { useVueNodeLifecycle } from '@/composables/graph/useVueNodeLifecycle'
import { useNodeBadge } from '@/composables/node/useNodeBadge'
import { useCanvasDrop } from '@/composables/useCanvasDrop'
import { useContextMenuTranslation } from '@/composables/useContextMenuTranslation'
import { useCopy } from '@/composables/useCopy'
import { useGlobalLitegraph } from '@/composables/useGlobalLitegraph'
import { usePaste } from '@/composables/usePaste'
import { useVueFeatureFlags } from '@/composables/useVueFeatureFlags'
import { i18n, t } from '@/i18n'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import { useLitegraphSettings } from '@/platform/settings/composables/useLitegraphSettings'
import { CORE_SETTINGS } from '@/platform/settings/constants/coreSettings'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { useWorkflowService } from '@/platform/workflow/core/services/workflowService'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useWorkflowAutoSave } from '@/platform/workflow/persistence/composables/useWorkflowAutoSave'
import { useWorkflowPersistence } from '@/platform/workflow/persistence/composables/useWorkflowPersistence'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useCanvasInteractions } from '@/renderer/core/canvas/useCanvasInteractions'
import TransformPane from '@/renderer/core/layout/transform/TransformPane.vue'
import MiniMap from '@/renderer/extensions/minimap/MiniMap.vue'
import LGraphNode from '@/renderer/extensions/vueNodes/components/LGraphNode.vue'
import { UnauthorizedError, api } from '@/scripts/api'
import { app as comfyApp } from '@/scripts/app'
import { ChangeTracker } from '@/scripts/changeTracker'
import { IS_CONTROL_WIDGET, updateControlWidgetLabel } from '@/scripts/widgets'
import { useColorPaletteService } from '@/services/colorPaletteService'
import { newUserService } from '@/services/newUserService'
import { useCommandStore } from '@/stores/commandStore'
import { useExecutionStore } from '@/stores/executionStore'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import { useColorPaletteStore } from '@/stores/workspace/colorPaletteStore'
import { useSearchBoxStore } from '@/stores/workspace/searchBoxStore'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { isNativeWindow } from '@/utils/envUtil'

import TryVueNodeBanner from '../topbar/TryVueNodeBanner.vue'

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
const colorPaletteStore = useColorPaletteStore()
const colorPaletteService = useColorPaletteService()
const canvasInteractions = useCanvasInteractions()

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
const activeSidebarTab = computed(() => {
  return workspaceStore.sidebarTab.activeSidebarTab
})
const showUI = computed(
  () => !workspaceStore.focusMode && betaMenuEnabled.value
)

const minimapEnabled = computed(() => settingStore.get('Comfy.Minimap.Visible'))

// Feature flags
const { shouldRenderVueNodes } = useVueFeatureFlags()

// Vue node system
const vueNodeLifecycle = useVueNodeLifecycle()
const { handleTransformUpdate } = useViewportCulling()

const handleVueNodeLifecycleReset = async () => {
  if (shouldRenderVueNodes.value) {
    vueNodeLifecycle.disposeNodeManagerAndSyncs()
    await nextTick()
    vueNodeLifecycle.initializeNodeManager()
  }
}

watch(() => canvasStore.currentGraph, handleVueNodeLifecycleReset)

watch(
  () => canvasStore.isInSubgraph,
  async (newValue, oldValue) => {
    if (oldValue && !newValue) {
      useWorkflowStore().updateActiveGraph()
    }
    await handleVueNodeLifecycleReset()
  }
)

const allNodes = computed((): VueNodeData[] =>
  Array.from(vueNodeLifecycle.nodeManager.value?.vueNodeData?.values() ?? [])
)

watchEffect(() => {
  LiteGraph.nodeOpacity = settingStore.get('Comfy.Node.Opacity')
})
watchEffect(() => {
  LiteGraph.nodeLightness = colorPaletteStore.completedActivePalette.light_theme
    ? 0.5
    : undefined
})

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

// Update node slot errors for LiteGraph nodes
// (Vue nodes read from store directly)
watch(
  () => executionStore.lastNodeErrors,
  (lastNodeErrors) => {
    if (!comfyApp.graph) return

    for (const node of comfyApp.graph.nodes) {
      // Clear existing errors
      for (const slot of node.inputs) {
        delete slot.hasErrors
      }
      for (const slot of node.outputs) {
        delete slot.hasErrors
      }

      const nodeErrors = lastNodeErrors?.[node.id]
      if (!nodeErrors) continue

      const validErrors = nodeErrors.errors.filter(
        (error) => error.extra_info?.input_name !== undefined
      )

      validErrors.forEach((error) => {
        const inputName = error.extra_info!.input_name!
        const inputIndex = node.findInputSlot(inputName)
        if (inputIndex !== -1) {
          node.inputs[inputIndex].hasErrors = true
        }
      })
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
  CORE_SETTINGS.forEach(settingStore.addSetting)

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

  vueNodeLifecycle.setupEmptyGraphListener()

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
  const { useReleaseStore } = await import(
    '@/platform/updates/common/releaseStore'
  )
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
  vueNodeLifecycle.cleanup()
})
</script>
