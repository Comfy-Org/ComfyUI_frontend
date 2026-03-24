<template>
  <!-- Load splitter overlay only after comfyApp is ready. -->
  <!-- If load immediately, the top-level splitter stateKey won't be correctly
  synced with the stateStorage (localStorage). -->
  <LiteGraphCanvasSplitterOverlay v-if="comfyAppReady">
    <template v-if="showUI" #workflow-tabs>
      <div
        v-if="workflowTabsPosition === 'Topbar'"
        class="workflow-tabs-container pointer-events-auto relative h-(--workflow-tabs-height) w-full"
      >
        <!-- Native drag area for Electron -->
        <div
          v-if="isNativeWindow() && workflowTabsPosition !== 'Topbar'"
          class="app-drag fixed top-0 left-0 z-10 h-(--comfy-topbar-height) w-full"
        />
        <div
          class="flex h-full items-center border-b border-interface-stroke bg-comfy-menu-bg shadow-interface"
        >
          <WorkflowTabs />
          <TopbarBadges />
          <TopbarSubscribeButton />
        </div>
      </div>
    </template>
    <template v-if="showUI && !isBuilderMode" #side-toolbar>
      <SideToolbar />
    </template>
    <template v-if="showUI" #side-bar-panel>
      <div
        class="sidebar-content-container size-full overflow-x-hidden overflow-y-auto"
      >
        <ExtensionSlot v-if="activeSidebarTab" :extension="activeSidebarTab" />
      </div>
    </template>
    <template v-if="showUI && !isBuilderMode" #topmenu>
      <TopMenuSection />
    </template>
    <template v-if="showUI" #bottom-panel>
      <BottomPanel />
    </template>
    <template v-if="showUI" #right-side-panel>
      <AppBuilder v-if="isBuilderMode" />
      <NodePropertiesPanel v-else />
    </template>
    <template #graph-canvas-panel>
      <GraphCanvasMenu
        v-if="canvasMenuEnabled && !isBuilderMode"
        class="pointer-events-auto"
      />
      <MiniMap
        v-if="
          comfyAppReady && minimapEnabled && betaMenuEnabled && !isBuilderMode
        "
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
    @wheel.capture="canvasInteractions.forwardEventToCanvas"
    @pointerdown.capture="forwardPanEvent"
    @pointerup.capture="forwardPanEvent"
    @pointermove.capture="forwardPanEvent"
  >
    <!-- Vue nodes rendered based on graph nodes -->
    <LGraphNode
      v-for="nodeData in allNodes"
      :key="nodeData.id"
      :node-data="nodeData"
      :error="
        executionErrorStore.lastExecutionError?.node_id === nodeData.id
          ? 'Execution error'
          : null
      "
      :data-node-id="nodeData.id"
    />
  </TransformPane>

  <LinkOverlayCanvas
    v-if="shouldRenderVueNodes && comfyApp.canvas && comfyAppReady"
    :canvas="comfyApp.canvas"
    @ready="onLinkOverlayReady"
    @dispose="onLinkOverlayDispose"
  />

  <!-- Selection rectangle overlay - rendered in DOM layer to appear above DOM widgets -->
  <SelectionRectangle v-if="comfyAppReady" />

  <NodeTooltip v-if="tooltipEnabled" />
  <NodeSearchboxPopover ref="nodeSearchboxPopoverRef" />

  <!-- Initialize components after comfyApp is ready. useAbsolutePosition requires
  canvasStore.canvas to be initialized. -->
  <template v-if="comfyAppReady">
    <TitleEditor />
    <SelectionToolbox v-if="selectionToolboxEnabled" />
    <NodeContextMenu />
    <!-- Render legacy DOM widgets only when Vue nodes are disabled -->
    <DomWidgets v-if="!shouldRenderVueNodes" />
  </template>
</template>

<script setup lang="ts">
import { until, useEventListener } from '@vueuse/core'
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
import { useI18n } from 'vue-i18n'

import { isMiddlePointerInput } from '@/base/pointerUtils'
import LiteGraphCanvasSplitterOverlay from '@/components/LiteGraphCanvasSplitterOverlay.vue'
import TopMenuSection from '@/components/TopMenuSection.vue'
import BottomPanel from '@/components/bottomPanel/BottomPanel.vue'
import AppBuilder from '@/components/builder/AppBuilder.vue'
import ExtensionSlot from '@/components/common/ExtensionSlot.vue'
import DomWidgets from '@/components/graph/DomWidgets.vue'
import GraphCanvasMenu from '@/components/graph/GraphCanvasMenu.vue'
import LinkOverlayCanvas from '@/components/graph/LinkOverlayCanvas.vue'
import NodeTooltip from '@/components/graph/NodeTooltip.vue'
import NodeContextMenu from '@/components/graph/NodeContextMenu.vue'
import SelectionToolbox from '@/components/graph/SelectionToolbox.vue'
import TitleEditor from '@/components/graph/TitleEditor.vue'
import NodePropertiesPanel from '@/components/rightSidePanel/RightSidePanel.vue'
import NodeSearchboxPopover from '@/components/searchbox/NodeSearchBoxPopover.vue'
import SideToolbar from '@/components/sidebar/SideToolbar.vue'
import TopbarBadges from '@/components/topbar/TopbarBadges.vue'
import TopbarSubscribeButton from '@/components/topbar/TopbarSubscribeButton.vue'
import WorkflowTabs from '@/components/topbar/WorkflowTabs.vue'
import { useChainCallback } from '@/composables/functional/useChainCallback'
import { installErrorClearingHooks } from '@/composables/graph/useErrorClearingHooks'
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
import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import { useLitegraphSettings } from '@/platform/settings/composables/useLitegraphSettings'
import { CORE_SETTINGS } from '@/platform/settings/constants/coreSettings'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { useWorkflowService } from '@/platform/workflow/core/services/workflowService'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useWorkflowAutoSave } from '@/platform/workflow/persistence/composables/useWorkflowAutoSave'
import { useWorkflowPersistenceV2 as useWorkflowPersistence } from '@/platform/workflow/persistence/composables/useWorkflowPersistenceV2'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useCanvasInteractions } from '@/renderer/core/canvas/useCanvasInteractions'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { useTransformSettling } from '@/renderer/core/layout/transform/useTransformSettling'
import TransformPane from '@/renderer/core/layout/transform/TransformPane.vue'
import MiniMap from '@/renderer/extensions/minimap/MiniMap.vue'
import LGraphNode from '@/renderer/extensions/vueNodes/components/LGraphNode.vue'
import { UnauthorizedError } from '@/scripts/api'
import { app as comfyApp } from '@/scripts/app'
import { ChangeTracker } from '@/scripts/changeTracker'
import { IS_CONTROL_WIDGET, updateControlWidgetLabel } from '@/scripts/widgets'
import { useColorPaletteService } from '@/services/colorPaletteService'
import { useNewUserService } from '@/services/useNewUserService'
import { shouldIgnoreCopyPaste } from '@/workbench/eventHelpers'
import { storeToRefs } from 'pinia'

import { useBootstrapStore } from '@/stores/bootstrapStore'
import { useCommandStore } from '@/stores/commandStore'
import { useExecutionStore } from '@/stores/executionStore'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import { useColorPaletteStore } from '@/stores/workspace/colorPaletteStore'
import { useSearchBoxStore } from '@/stores/workspace/searchBoxStore'
import { useAppMode } from '@/composables/useAppMode'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { isNativeWindow } from '@/utils/envUtil'
import { forEachNode } from '@/utils/graphTraversalUtil'

import SelectionRectangle from './SelectionRectangle.vue'
import { isCloud } from '@/platform/distribution/types'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { useInviteUrlLoader } from '@/platform/workspace/composables/useInviteUrlLoader'

const { t } = useI18n()
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
const { isBuilderMode } = useAppMode()
const canvasStore = useCanvasStore()
const workflowStore = useWorkflowStore()
const executionStore = useExecutionStore()
const executionErrorStore = useExecutionErrorStore()
const toastStore = useToastStore()
const colorPaletteStore = useColorPaletteStore()
const colorPaletteService = useColorPaletteService()
const canvasInteractions = useCanvasInteractions()
const bootstrapStore = useBootstrapStore()
const { isI18nReady, i18nError } = storeToRefs(bootstrapStore)
const { isReady: isSettingsReady, error: settingsError } =
  storeToRefs(settingStore)

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

// Error-clearing hooks run regardless of rendering mode (Vue or legacy canvas).
let cleanupErrorHooks: (() => void) | null = null
watch(
  () => canvasStore.currentGraph,
  (graph) => {
    cleanupErrorHooks?.()
    cleanupErrorHooks = graph ? installErrorClearingHooks(graph) : null
  }
)

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

const rawNodes = computed((): VueNodeData[] =>
  Array.from(vueNodeLifecycle.nodeManager.value?.vueNodeData?.values() ?? [])
)

const canvasElement = computed(() => canvasStore.canvas?.canvas)
const { isTransforming } = useTransformSettling(canvasElement, {
  settleDelay: 256
})

const nodeLayouts = layoutStore.getAllNodes()

const { mountedNodeIds } = useViewportCulling({
  rawNodes,
  nodeLayouts,
  getViewportSize: () => {
    const rect = canvasStore.canvas?.canvas?.getBoundingClientRect()
    return { width: rect?.width ?? 0, height: rect?.height ?? 0 }
  },
  isTransforming
})

const allNodes = computed(() =>
  rawNodes.value.filter((node) => mountedNodeIds.value.has(node.id))
)

function onLinkOverlayReady(el: HTMLCanvasElement) {
  if (!canvasStore.canvas) return
  canvasStore.canvas.overlayCanvas = el
  canvasStore.canvas.overlayCtx = el.getContext('2d')
}

function onLinkOverlayDispose() {
  if (!canvasStore.canvas) return
  canvasStore.canvas.overlayCanvas = null
  canvasStore.canvas.overlayCtx = null
}

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

    forEachNode(comfyApp.rootGraph, (n) => {
      if (!n.widgets) return
      for (const w of n.widgets) {
        if (!w[IS_CONTROL_WIDGET]) continue
        updateControlWidgetLabel(w)
        if (!w.linkedWidgets) continue
        for (const l of w.linkedWidgets) {
          updateControlWidgetLabel(l)
        }
      }
    })
    canvasStore.canvas.setDirty(true)
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

/**
 * Propagates execution progress from the store to LiteGraph node objects
 * and triggers a canvas redraw.
 *
 * No `deep: true` needed — `nodeLocationProgressStates` is a computed that
 * returns a new `Record` object on every progress event (the underlying
 * `nodeProgressStates` ref is replaced wholesale by the WebSocket handler).
 *
 * `currentGraph` triggers this watcher on subgraph navigation so stale
 * progress bars are cleared when returning to the root graph.
 */
watch(
  () =>
    [
      executionStore.nodeLocationProgressStates,
      canvasStore.canvas,
      canvasStore.currentGraph
    ] as const,
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
    canvas.setDirty(true, false)
  }
)

// Repaint canvas when node errors change.
// Slot error flags are reconciled by reconcileNodeErrorFlags in executionErrorStore.
watch(
  () => executionErrorStore.lastNodeErrors,
  () => {
    comfyApp.canvas?.setDirty(true, true)
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

const comfyAppReady = ref(false)
const workflowPersistence = useWorkflowPersistence()
const { flags } = useFeatureFlags()
// Set up invite loader during setup phase so useRoute/useRouter work correctly
const inviteUrlLoader = isCloud ? useInviteUrlLoader() : null
useCanvasDrop(canvasRef)
useLitegraphSettings()
useNodeBadge()

useGlobalLitegraph()
useContextMenuTranslation()
useCopy()
usePaste()
useWorkflowAutoSave()

// Start watching for locale change after the initial value is loaded.
watch(
  () => settingStore.get('Comfy.Locale'),
  async (_newLocale, oldLocale) => {
    if (!oldLocale) return
    await Promise.all([
      until(() => isSettingsReady.value || !!settingsError.value).toBe(true),
      until(() => isI18nReady.value || !!i18nError.value).toBe(true)
    ])
    if (settingsError.value || i18nError.value) {
      console.warn(
        'Somehow the Locale setting was changed while the settings or i18n had a setup error'
      )
    }
    await useCommandStore().execute('Comfy.RefreshNodeDefinitions')
    await useWorkflowService().reloadCurrentWorkflow()
  }
)
useEventListener(
  () => canvasStore.canvas?.canvas,
  'litegraph:set-graph',
  () => {
    workflowStore.updateActiveGraph()
  }
)

onMounted(async () => {
  comfyApp.vueAppReady = true
  workspaceStore.spinner = true
  try {
    // ChangeTracker needs to be initialized before setup, as it will overwrite
    // some listeners of litegraph canvas.
    ChangeTracker.init()

    await until(() => isSettingsReady.value || !!settingsError.value).toBe(true)

    if (settingsError.value) {
      if (settingsError.value instanceof UnauthorizedError) {
        localStorage.removeItem('Comfy.userId')
        localStorage.removeItem('Comfy.userName')
        window.location.reload()
        return
      }
      throw settingsError.value
    }

    // Register core settings immediately after settings are ready
    CORE_SETTINGS.forEach(settingStore.addSetting)

    await Promise.all([
      until(() => isI18nReady.value || !!i18nError.value).toBe(true),
      useNewUserService().initializeIfNewUser()
    ])
    if (i18nError.value) {
      console.warn(
        '[GraphCanvas] Failed to load custom nodes i18n:',
        i18nError.value
      )
    }

    // @ts-expect-error fixme ts strict error
    await comfyApp.setup(canvasRef.value)
    canvasStore.canvas = comfyApp.canvas
    canvasStore.canvas.render_canvas_border = false
    useSearchBoxStore().setPopoverRef(nodeSearchboxPopoverRef.value)

    window.app = comfyApp
    window.graph = comfyApp.graph

    comfyAppReady.value = true

    // Install error-clearing hooks on the initial graph
    if (comfyApp.canvas?.graph) {
      cleanupErrorHooks = installErrorClearingHooks(comfyApp.canvas.graph)
    }

    vueNodeLifecycle.setupEmptyGraphListener()
  } finally {
    workspaceStore.spinner = false
  }

  comfyApp.canvas.onSelectionChange = useChainCallback(
    comfyApp.canvas.onSelectionChange,
    () => canvasStore.updateSelectedItems()
  )

  // Load color palette
  colorPaletteStore.customPalettes = settingStore.get(
    'Comfy.CustomColorPalettes'
  )

  // Restore saved workflow and workflow tabs state
  await workflowPersistence.initializeWorkflow()
  await workflowPersistence.restoreWorkflowTabsState()

  const sharedWorkflowLoadStatus =
    await workflowPersistence.loadSharedWorkflowFromUrlIfPresent()

  // Load template from URL if present
  if (sharedWorkflowLoadStatus === 'not-present') {
    await workflowPersistence.loadTemplateFromUrlIfPresent()
  }

  // Accept workspace invite from URL if present (e.g., ?invite=TOKEN)
  // WorkspaceAuthGate ensures flag state is resolved before GraphCanvas mounts
  if (inviteUrlLoader && flags.teamWorkspacesEnabled) {
    await inviteUrlLoader.loadInviteFromUrl()
  }

  // Initialize release store to fetch releases from comfy-api (fire-and-forget)
  const { useReleaseStore } =
    await import('@/platform/updates/common/releaseStore')
  const releaseStore = useReleaseStore()
  void releaseStore.initialize()

  emit('ready')
})

onUnmounted(() => {
  cleanupErrorHooks?.()
  cleanupErrorHooks = null
  vueNodeLifecycle.cleanup()
})
function forwardPanEvent(e: PointerEvent) {
  if (!isMiddlePointerInput(e)) return
  if (shouldIgnoreCopyPaste(e.target) && document.activeElement === e.target)
    return

  canvasInteractions.forwardEventToCanvas(e)
}
</script>
