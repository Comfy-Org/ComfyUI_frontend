<template>
  <teleport to=".graph-canvas-container">
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
        <SecondRowWorkflowTabs
          v-if="workflowTabsPosition === 'Topbar (2nd-row)'"
        />
        <GraphCanvasMenu v-if="canvasMenuEnabled" />
      </template>
    </LiteGraphCanvasSplitterOverlay>
    <TitleEditor />
    <GraphCanvasMenu v-if="!betaMenuEnabled && canvasMenuEnabled" />
    <canvas ref="canvasRef" id="graph-canvas" tabindex="1" />
  </teleport>
  <NodeSearchboxPopover />
  <NodeTooltip v-if="tooltipEnabled" />
  <NodeBadge />
</template>

<script setup lang="ts">
import {
  CanvasPointer,
  ContextMenu,
  DragAndScale,
  LGraph,
  LGraphBadge,
  LGraphCanvas,
  LGraphGroup,
  LGraphNode,
  LLink,
  LiteGraph
} from '@comfyorg/litegraph'
import { computed, onMounted, ref, watch, watchEffect } from 'vue'

import LiteGraphCanvasSplitterOverlay from '@/components/LiteGraphCanvasSplitterOverlay.vue'
import BottomPanel from '@/components/bottomPanel/BottomPanel.vue'
import GraphCanvasMenu from '@/components/graph/GraphCanvasMenu.vue'
import NodeBadge from '@/components/graph/NodeBadge.vue'
import NodeTooltip from '@/components/graph/NodeTooltip.vue'
import TitleEditor from '@/components/graph/TitleEditor.vue'
import NodeSearchboxPopover from '@/components/searchbox/NodeSearchBoxPopover.vue'
import SideToolbar from '@/components/sidebar/SideToolbar.vue'
import SecondRowWorkflowTabs from '@/components/topbar/SecondRowWorkflowTabs.vue'
import { CORE_SETTINGS } from '@/constants/coreSettings'
import { usePragmaticDroppable } from '@/hooks/dndHooks'
import { i18n } from '@/i18n'
import { api } from '@/scripts/api'
import { app as comfyApp } from '@/scripts/app'
import { ChangeTracker } from '@/scripts/changeTracker'
import { getStorageValue, setStorageValue } from '@/scripts/utils'
import { IS_CONTROL_WIDGET, updateControlWidgetLabel } from '@/scripts/widgets'
import { useColorPaletteService } from '@/services/colorPaletteService'
import { useLitegraphService } from '@/services/litegraphService'
import { useWorkflowService } from '@/services/workflowService'
import { useCommandStore } from '@/stores/commandStore'
import { useCanvasStore } from '@/stores/graphStore'
import { ComfyModelDef } from '@/stores/modelStore'
import {
  ModelNodeProvider,
  useModelToNodeStore
} from '@/stores/modelToNodeStore'
import { ComfyNodeDefImpl, useNodeDefStore } from '@/stores/nodeDefStore'
import { useSettingStore } from '@/stores/settingStore'
import { useWorkflowStore } from '@/stores/workflowStore'
import { useColorPaletteStore } from '@/stores/workspace/colorPaletteStore'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import type { RenderedTreeExplorerNode } from '@/types/treeExplorerTypes'

const emit = defineEmits(['ready'])
const canvasRef = ref<HTMLCanvasElement | null>(null)
const litegraphService = useLitegraphService()
const settingStore = useSettingStore()
const nodeDefStore = useNodeDefStore()
const workspaceStore = useWorkspaceStore()
const canvasStore = useCanvasStore()
const modelToNodeStore = useModelToNodeStore()
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

const storedWorkflows = JSON.parse(
  getStorageValue('Comfy.OpenWorkflowsPaths') || '[]'
)
const storedActiveIndex = JSON.parse(
  getStorageValue('Comfy.ActiveWorkflowIndex') || '-1'
)
const openWorkflows = computed(() => workspaceStore?.workflow?.openWorkflows)
const activeWorkflow = computed(() => workspaceStore?.workflow?.activeWorkflow)
const restoreState = computed<{ paths: string[]; activeIndex: number }>(() => {
  if (!openWorkflows.value || !activeWorkflow.value) {
    return { paths: [], activeIndex: -1 }
  }

  const paths = openWorkflows.value
    .filter((workflow) => workflow?.isPersisted && !workflow.isModified)
    .map((workflow) => workflow.path)
  const activeIndex = openWorkflows.value.findIndex(
    (workflow) => workflow.path === activeWorkflow.value?.path
  )

  return { paths, activeIndex }
})

watchEffect(() => {
  const canvasInfoEnabled = settingStore.get('Comfy.Graph.CanvasInfo')
  if (canvasStore.canvas) {
    canvasStore.canvas.show_info = canvasInfoEnabled
  }
})

watchEffect(() => {
  const zoomSpeed = settingStore.get('Comfy.Graph.ZoomSpeed')
  if (canvasStore.canvas) {
    canvasStore.canvas.zoom_speed = zoomSpeed
  }
})

watchEffect(() => {
  LiteGraph.snaps_for_comfy = settingStore.get('Comfy.Node.AutoSnapLinkToSlot')
})

watchEffect(() => {
  LiteGraph.snap_highlights_node = settingStore.get(
    'Comfy.Node.SnapHighlightsNode'
  )
})

watchEffect(() => {
  LGraphNode.keepAllLinksOnBypass = settingStore.get(
    'Comfy.Node.BypassAllLinksOnDelete'
  )
})

watchEffect(() => {
  LiteGraph.middle_click_slot_add_default_node = settingStore.get(
    'Comfy.Node.MiddleClickRerouteNode'
  )
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
  const textareas = document.querySelectorAll('textarea.comfy-multiline-input')

  textareas.forEach((textarea: HTMLTextAreaElement) => {
    textarea.spellcheck = spellcheckEnabled
    // Force recheck to ensure visual update
    textarea.focus()
    textarea.blur()
  })
})

watchEffect(() => {
  const linkRenderMode = settingStore.get('Comfy.LinkRenderMode')
  if (canvasStore.canvas) {
    canvasStore.canvas.links_render_mode = linkRenderMode
    canvasStore.canvas.setDirty(/* fg */ false, /* bg */ true)
  }
})

watchEffect(() => {
  const linkMarkerShape = settingStore.get('Comfy.Graph.LinkMarkers')
  const { canvas } = canvasStore
  if (canvas) {
    canvas.linkMarkerShape = linkMarkerShape
    canvas.setDirty(false, true)
  }
})

watchEffect(() => {
  const reroutesEnabled = settingStore.get('Comfy.RerouteBeta')
  const { canvas } = canvasStore
  if (canvas) {
    canvas.reroutesEnabled = reroutesEnabled
    canvas.setDirty(false, true)
  }
})

watchEffect(() => {
  const maximumFps = settingStore.get('LiteGraph.Canvas.MaximumFps')
  const { canvas } = canvasStore
  if (canvas) canvas.maximumFps = maximumFps
})

watchEffect(() => {
  CanvasPointer.doubleClickTime = settingStore.get(
    'Comfy.Pointer.DoubleClickTime'
  )
})

watchEffect(() => {
  CanvasPointer.bufferTime = settingStore.get('Comfy.Pointer.ClickBufferTime')
})

watchEffect(() => {
  CanvasPointer.maxClickDrift = settingStore.get('Comfy.Pointer.ClickDrift')
})

watchEffect(() => {
  LiteGraph.CANVAS_GRID_SIZE = settingStore.get('Comfy.SnapToGrid.GridSize')
})

watchEffect(() => {
  LiteGraph.alwaysSnapToGrid = settingStore.get('pysssss.SnapToGrid')
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

const colorPaletteService = useColorPaletteService()
const colorPaletteStore = useColorPaletteStore()
watch(
  [() => canvasStore.canvas, () => settingStore.get('Comfy.ColorPalette')],
  ([canvas, currentPaletteId]) => {
    if (!canvas) return

    colorPaletteService.loadColorPalette(currentPaletteId)
  }
)
watch(
  () => colorPaletteStore.activePaletteId,
  (newValue) => {
    settingStore.set('Comfy.ColorPalette', newValue)
  }
)

const workflowStore = useWorkflowStore()
const persistCurrentWorkflow = () => {
  const workflow = JSON.stringify(comfyApp.serializeGraph())
  localStorage.setItem('workflow', workflow)
  if (api.clientId) {
    sessionStorage.setItem(`workflow:${api.clientId}`, workflow)
  }
}

watchEffect(() => {
  if (workflowStore.activeWorkflow) {
    const workflow = workflowStore.activeWorkflow
    setStorageValue('Comfy.PreviousWorkflow', workflow.key)
    // When the activeWorkflow changes, the graph has already been loaded.
    // Saving the current state of the graph to the localStorage.
    persistCurrentWorkflow()
  }
})

api.addEventListener('graphChanged', persistCurrentWorkflow)

usePragmaticDroppable(() => canvasRef.value, {
  onDrop: (event) => {
    const loc = event.location.current.input
    const dndData = event.source.data

    if (dndData.type === 'tree-explorer-node') {
      const node = dndData.data as RenderedTreeExplorerNode
      if (node.data instanceof ComfyNodeDefImpl) {
        const nodeDef = node.data
        // Add an offset on x to make sure after adding the node, the cursor
        // is on the node (top left corner)
        const pos = comfyApp.clientPosToCanvasPos([
          loc.clientX - 20,
          loc.clientY
        ])
        litegraphService.addNodeOnGraph(nodeDef, { pos })
      } else if (node.data instanceof ComfyModelDef) {
        const model = node.data
        const pos = comfyApp.clientPosToCanvasPos([loc.clientX, loc.clientY])
        const nodeAtPos = comfyApp.graph.getNodeOnPos(pos[0], pos[1])
        let targetProvider: ModelNodeProvider | null = null
        let targetGraphNode: LGraphNode | null = null
        if (nodeAtPos) {
          const providers = modelToNodeStore.getAllNodeProviders(
            model.directory
          )
          for (const provider of providers) {
            if (provider.nodeDef.name === nodeAtPos.comfyClass) {
              targetGraphNode = nodeAtPos
              targetProvider = provider
            }
          }
        }
        if (!targetGraphNode) {
          const provider = modelToNodeStore.getNodeProvider(model.directory)
          if (provider) {
            targetGraphNode = litegraphService.addNodeOnGraph(
              provider.nodeDef,
              {
                pos
              }
            )
            targetProvider = provider
          }
        }
        if (targetGraphNode) {
          const widget = targetGraphNode.widgets.find(
            (widget) => widget.name === targetProvider.key
          )
          if (widget) {
            widget.value = model.file_name
          }
        }
      }
    }
  }
})

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
onMounted(async () => {
  // Backward compatible
  // Assign all properties of lg to window
  window['LiteGraph'] = LiteGraph
  window['LGraph'] = LGraph
  window['LLink'] = LLink
  window['LGraphNode'] = LGraphNode
  window['LGraphGroup'] = LGraphGroup
  window['DragAndScale'] = DragAndScale
  window['LGraphCanvas'] = LGraphCanvas
  window['ContextMenu'] = ContextMenu
  window['LGraphBadge'] = LGraphBadge

  comfyApp.vueAppReady = true

  workspaceStore.spinner = true
  // ChangeTracker needs to be initialized before setup, as it will overwrite
  // some listeners of litegraph canvas.
  ChangeTracker.init(comfyApp)
  await loadCustomNodesI18n()
  await settingStore.loadSettingValues()
  CORE_SETTINGS.forEach((setting) => {
    settingStore.addSetting(setting)
  })
  await comfyApp.setup(canvasRef.value)
  canvasStore.canvas = comfyApp.canvas
  canvasStore.canvas.render_canvas_border = false
  workspaceStore.spinner = false

  window['app'] = comfyApp
  window['graph'] = comfyApp.graph

  comfyAppReady.value = true

  // Load color palette
  colorPaletteStore.customPalettes = settingStore.get(
    'Comfy.CustomColorPalettes'
  )

  const isRestorable = storedWorkflows?.length > 0 && storedActiveIndex >= 0
  if (isRestorable)
    workflowStore.openWorkflowsInBackground({
      left: storedWorkflows.slice(0, storedActiveIndex),
      right: storedWorkflows.slice(storedActiveIndex)
    })

  watch(restoreState, ({ paths, activeIndex }) => {
    setStorageValue('Comfy.OpenWorkflowsPaths', JSON.stringify(paths))
    setStorageValue('Comfy.ActiveWorkflowIndex', JSON.stringify(activeIndex))
  })

  // Start watching for locale change after the initial value is loaded.
  watch(
    () => settingStore.get('Comfy.Locale'),
    async () => {
      await useCommandStore().execute('Comfy.RefreshNodeDefinitions')
      useWorkflowService().reloadCurrentWorkflow()
    }
  )

  emit('ready')
})
</script>
