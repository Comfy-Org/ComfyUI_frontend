<template>
  <teleport to=".graph-canvas-container">
    <LiteGraphCanvasSplitterOverlay v-if="betaMenuEnabled">
      <template #side-bar-panel>
        <SideToolBar />
      </template>
    </LiteGraphCanvasSplitterOverlay>
    <canvas ref="canvasRef" id="graph-canvas" tabindex="1" />
  </teleport>
  <NodeSearchboxPopover v-if="nodeSearchEnabled" />
</template>

<script setup lang="ts">
import SideToolBar from '@/components/sidebar/SideToolBar.vue'
import LiteGraphCanvasSplitterOverlay from '@/components/LiteGraphCanvasSplitterOverlay.vue'
import NodeSearchboxPopover from '@/components/NodeSearchBoxPopover.vue'
import {
  ref,
  computed,
  onUnmounted,
  onBeforeMount,
  watch,
  onMounted
} from 'vue'
import { app as comfyApp } from '@/scripts/app'
import { useSettingStore } from '@/stores/settingStore'
import { dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import { useWorkspaceStore } from '@/stores/workspaceStateStore'

const emit = defineEmits(['ready'])
const canvasRef = ref<HTMLCanvasElement | null>(null)
const settingStore = useSettingStore()
const workspaceStore = useWorkspaceStore()

const betaMenuEnabled = computed(
  () => settingStore.get('Comfy.UseNewMenu') !== 'Disabled'
)
const nodeSearchEnabled = computed<boolean>(
  () => settingStore.get('Comfy.NodeSearchBoxImpl') === 'default'
)
watch(nodeSearchEnabled, (newVal) => {
  comfyApp.canvas.allow_searchbox = !newVal
})

let dropTargetCleanup = () => {}

onMounted(async () => {
  comfyApp.vueAppReady = true

  workspaceStore.spinner = true
  await comfyApp.setup(canvasRef.value)
  comfyApp.canvas.allow_searchbox = !nodeSearchEnabled.value
  workspaceStore.spinner = false

  window['app'] = comfyApp
  window['graph'] = comfyApp.graph

  dropTargetCleanup = dropTargetForElements({
    element: canvasRef.value,
    onDrop: (event) => {
      const loc = event.location.current.input
      // Add an offset on x to make sure after adding the node, the cursor
      // is on the node (top left corner)
      const pos = comfyApp.clientPosToCanvasPos([loc.clientX - 20, loc.clientY])
      const comfyNodeName = event.source.element.getAttribute(
        'data-comfy-node-name'
      )
      const nodeDef = useNodeDefStore().nodeDefsByName[comfyNodeName]
      comfyApp.addNodeOnGraph(nodeDef, { pos })
    }
  })
  emit('ready')
})

onUnmounted(() => {
  dropTargetCleanup()
})
</script>
