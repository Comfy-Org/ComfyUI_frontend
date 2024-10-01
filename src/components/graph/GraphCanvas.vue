<template>
  <teleport to=".graph-canvas-container">
    <LiteGraphCanvasSplitterOverlay v-if="betaMenuEnabled">
      <template #side-bar-panel>
        <SideToolbar />
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
  <NodeTooltip />
</template>

<script setup lang="ts">
import TitleEditor from '@/components/graph/TitleEditor.vue'
import SideToolbar from '@/components/sidebar/SideToolbar.vue'
import LiteGraphCanvasSplitterOverlay from '@/components/LiteGraphCanvasSplitterOverlay.vue'
import NodeSearchboxPopover from '@/components/searchbox/NodeSearchBoxPopover.vue'
import NodeTooltip from '@/components/graph/NodeTooltip.vue'
import { ref, computed, onUnmounted, onMounted, watchEffect } from 'vue'
import { app as comfyApp } from '@/scripts/app'
import { useSettingStore } from '@/stores/settingStore'
import { dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter'
import {
  ComfyNodeDefImpl,
  useNodeDefStore,
  useNodeFrequencyStore
} from '@/stores/nodeDefStore'
import { useWorkspaceStore } from '@/stores/workspaceStateStore'
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
import { useNodeBookmarkStore } from '@/stores/nodeBookmarkStore'
import { useCanvasStore } from '@/stores/graphStore'
import { ComfyModelDef } from '@/stores/modelStore'
import { useModelToNodeStore } from '@/stores/modelToNodeStore'
import GraphCanvasMenu from '@/components/graph/GraphCanvasMenu.vue'

const emit = defineEmits(['ready'])
const canvasRef = ref<HTMLCanvasElement | null>(null)
const settingStore = useSettingStore()
const nodeDefStore = useNodeDefStore()
const workspaceStore = useWorkspaceStore()
const canvasStore = useCanvasStore()
const modelToNodeStore = useModelToNodeStore()
const betaMenuEnabled = computed(
  () => settingStore.get('Comfy.UseNewMenu') !== 'Disabled'
)
const canvasMenuEnabled = computed(() =>
  settingStore.get('Comfy.Graph.CanvasMenu')
)

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
  if (!canvasStore.canvas) return

  if (canvasStore.draggingCanvas) {
    canvasStore.canvas.canvas.style.cursor = 'grabbing'
    return
  }

  if (canvasStore.readOnly) {
    canvasStore.canvas.canvas.style.cursor = 'grab'
    return
  }

  canvasStore.canvas.canvas.style.cursor = 'default'
})

let dropTargetCleanup = () => {}

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

  dropTargetCleanup = dropTargetForElements({
    element: canvasRef.value,
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
          const provider = modelToNodeStore.getNodeProvider(model.directory)
          if (provider) {
            const pos = comfyApp.clientPosToCanvasPos([
              loc.clientX - 20,
              loc.clientY
            ])
            const node = comfyApp.addNodeOnGraph(provider.nodeDef, { pos })
            const widget = node.widgets.find(
              (widget) => widget.name === provider.key
            )
            if (widget) {
              widget.value = model.name
            }
          }
        }
      }
    }
  })

  // Migrate legacy bookmarks
  useNodeBookmarkStore().migrateLegacyBookmarks()

  // Explicitly initialize nodeSearchService to avoid indexing delay when
  // node search is triggered
  useNodeDefStore().nodeSearchService.endsWithFilterStartSequence('')

  // Non-blocking load of node frequencies
  useNodeFrequencyStore().loadNodeFrequencies()
  emit('ready')
})

onUnmounted(() => {
  dropTargetCleanup()
})
</script>
