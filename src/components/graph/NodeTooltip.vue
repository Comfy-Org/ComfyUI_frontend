<template>
  <div
    v-if="tooltipText"
    ref="tooltipRef"
    class="node-tooltip"
    :style="{ left, top }"
  >
    {{ tooltipText }}
  </div>
</template>

<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { LiteGraph } from '@comfyorg/litegraph'
import { app as comfyApp } from '@/scripts/app'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import { useHoveredItemStore } from '@/stores/graphStore'
import { useEventListener } from '@vueuse/core'

let idleTimeout: number
const nodeDefStore = useNodeDefStore()
const hoveredItemStore = useHoveredItemStore()
const tooltipRef = ref<HTMLDivElement>()
const tooltipText = ref('')
const left = ref<string>()
const top = ref<string>()

const hideTooltip = () => (tooltipText.value = null)
const clearHovered = () => (hoveredItemStore.value = null)

const showTooltip = async (tooltip: string | null | undefined) => {
  if (!tooltip) return

  left.value = comfyApp.canvas.mouse[0] + 'px'
  top.value = comfyApp.canvas.mouse[1] + 'px'
  tooltipText.value = tooltip

  await nextTick()

  const rect = tooltipRef.value.getBoundingClientRect()
  if (rect.right > window.innerWidth) {
    left.value = comfyApp.canvas.mouse[0] - rect.width + 'px'
  }

  if (rect.top < 0) {
    top.value = comfyApp.canvas.mouse[1] + rect.height + 'px'
  }
}
watch(hoveredItemStore, (hoveredItem) => {
  if (!hoveredItem.value) {
    return hideTooltip()
  }
  const item = hoveredItem.value
  const nodeDef =
    nodeDefStore.nodeDefsByName[item.node.type] ??
    LiteGraph.registered_node_types[item.node.type]?.nodeData
  if (item.type == 'Title') {
    let description = nodeDef.description
    if (Array.isArray(description)) {
      description = description[0]
    }
    return showTooltip(description)
  } else if (item.type == 'Input') {
    showTooltip(nodeDef.input.getInput(item.inputName)?.tooltip)
  } else if (item.type == 'Output') {
    showTooltip(nodeDef?.output?.all?.[item.outputSlot]?.tooltip)
  } else if (item.type == 'Widget') {
    showTooltip(
      item.widget.tooltip ??
        (
          nodeDef.input.optional?.[item.widget.name] ??
          nodeDef.input.required?.[item.widget.name]
        )?.tooltip
    )
  } else {
    hideTooltip()
  }
})

const onIdle = () => {
  const { canvas } = comfyApp
  const node = canvas.node_over
  if (!node) return

  const ctor = node.constructor as { title_mode?: 0 | 1 | 2 | 3 }
  const nodeDef =
    nodeDefStore.nodeDefsByName[node.type] ??
    LiteGraph.registered_node_types[node.type]?.nodeData

  if (
    ctor.title_mode !== LiteGraph.NO_TITLE &&
    canvas.graph_mouse[1] < node.pos[1] // If we are over a node, but not within the node then we are on its title
  ) {
    hoveredItemStore.value = { node, type: 'Title' }
  }

  if (node.flags?.collapsed) return

  const inputSlot = canvas.isOverNodeInput(
    node,
    canvas.graph_mouse[0],
    canvas.graph_mouse[1],
    [0, 0]
  )
  if (inputSlot !== -1) {
    const inputName = node.inputs[inputSlot].name
    hoveredItemStore.value = { node, type: 'Input', inputName }
  }

  const outputSlot = canvas.isOverNodeOutput(
    node,
    canvas.graph_mouse[0],
    canvas.graph_mouse[1],
    [0, 0]
  )
  if (outputSlot !== -1) {
    hoveredItemStore.value = { node, type: 'Output', outputSlot }
  }

  const widget = comfyApp.canvas.getWidgetAtCursor()
  // Dont show for DOM widgets, these use native browser tooltips as we dont get proper mouse events on these
  if (widget && !widget.element) {
    hoveredItemStore.value = { node, type: 'Widget', widget }
  }
}

const onMouseMove = (e: MouseEvent) => {
  clearHovered()
  clearTimeout(idleTimeout)

  if ((e.target as Node).nodeName !== 'CANVAS') return
  idleTimeout = window.setTimeout(onIdle, 500)
}

useEventListener(window, 'mousemove', onMouseMove)
useEventListener(window, 'click', clearHovered)
</script>

<style lang="css" scoped>
.node-tooltip {
  background: var(--comfy-input-bg);
  border-radius: 5px;
  box-shadow: 0 0 5px rgba(0, 0, 0, 0.4);
  color: var(--input-text);
  font-family: sans-serif;
  left: 0;
  max-width: 30vw;
  padding: 4px 8px;
  position: absolute;
  top: 0;
  transform: translate(5px, calc(-100% - 5px));
  white-space: pre-wrap;
  z-index: 99999;
}
</style>
