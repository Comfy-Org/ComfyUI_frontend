<template>
  <teleport to=".graph-canvas-container">
    <LiteGraphCanvasSplitterOverlay v-if="betaMenuEnabled">
      <template #side-bar-panel>
        <SideToolbar />
      </template>
      <template #bottom-panel>
        <BottomPanel />
      </template>
      <template #graph-canvas-panel>
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
import TitleEditor from '@/components/graph/TitleEditor.vue'
import SideToolbar from '@/components/sidebar/SideToolbar.vue'
import BottomPanel from '@/components/bottomPanel/BottomPanel.vue'
import LiteGraphCanvasSplitterOverlay from '@/components/LiteGraphCanvasSplitterOverlay.vue'
import NodeSearchboxPopover from '@/components/searchbox/NodeSearchBoxPopover.vue'
import NodeTooltip from '@/components/graph/NodeTooltip.vue'
import NodeBadge from '@/components/graph/NodeBadge.vue'
import { ref, computed, onMounted, watchEffect } from 'vue'
import { app as comfyApp } from '@/scripts/app'
import { useSettingStore } from '@/stores/settingStore'
import { ComfyNodeDefImpl, useNodeDefStore } from '@/stores/nodeDefStore'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import {
  LiteGraph,
  LGraph,
  LLink,
  LGraphNode,
  LGraphGroup,
  DragAndScale,
  LGraphCanvas,
  ContextMenu,
  LGraphBadge
} from '@comfyorg/litegraph'
import type { RenderedTreeExplorerNode } from '@/types/treeExplorerTypes'
import { useCanvasStore } from '@/stores/graphStore'
import { ComfyModelDef } from '@/stores/modelStore'
import {
  ModelNodeProvider,
  useModelToNodeStore
} from '@/stores/modelToNodeStore'
import GraphCanvasMenu from '@/components/graph/GraphCanvasMenu.vue'
import { usePragmaticDroppable } from '@/hooks/dndHooks'
import { useWorkflowStore } from '@/stores/workflowStore'
import { setStorageValue } from '@/scripts/utils'

const emit = defineEmits(['ready'])
const canvasRef = ref<HTMLCanvasElement | null>(null)
const settingStore = useSettingStore()
const nodeDefStore = useNodeDefStore()
const workspaceStore = useWorkspaceStore()
const canvasStore = useCanvasStore()
const modelToNodeStore = useModelToNodeStore()
const betaMenuEnabled = computed(
  () =>
    settingStore.get('Comfy.UseNewMenu') !== 'Disabled' &&
    !workspaceStore.focusMode
)
const canvasMenuEnabled = computed(() =>
  settingStore.get('Comfy.Graph.CanvasMenu')
)
const tooltipEnabled = computed(() => settingStore.get('Comfy.EnableTooltips'))

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
  if (!canvasStore.canvas) return

  if (canvasStore.canvas.state.draggingCanvas) {
    canvasStore.canvas.canvas.style.cursor = 'grabbing'
    return
  }

  if (canvasStore.canvas.state.readOnly) {
    canvasStore.canvas.canvas.style.cursor = 'grab'
    return
  }

  canvasStore.canvas.canvas.style.cursor = 'default'
})

const workflowStore = useWorkflowStore()
watchEffect(() => {
  if (workflowStore.activeWorkflow) {
    const workflow = workflowStore.activeWorkflow
    setStorageValue('Comfy.PreviousWorkflow', workflow.path ?? workflow.name)
  }
})

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
        comfyApp.addNodeOnGraph(nodeDef, { pos })
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
            targetGraphNode = comfyApp.addNodeOnGraph(provider.nodeDef, {
              pos
            })
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
  await comfyApp.setup(canvasRef.value)
  canvasStore.canvas = comfyApp.canvas
  workspaceStore.spinner = false

  window['app'] = comfyApp
  window['graph'] = comfyApp.graph

  emit('ready')
})
</script>
