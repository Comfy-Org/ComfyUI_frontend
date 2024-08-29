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
import { nextTick, ref, onBeforeUnmount, watch } from 'vue'
import { LiteGraph } from '@comfyorg/litegraph'
import { app as comfyApp } from '@/scripts/app'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import { useSettingStore } from '@/stores/settingStore'

let idleTimeout: number
const nodeDefStore = useNodeDefStore()
const settingStore = useSettingStore()
const tooltipRef = ref<HTMLDivElement>()
const tooltipText = ref('')
const left = ref<string>()
const top = ref<string>()

const getHoveredWidget = () => {
  const node = comfyApp.canvas.node_over
  if (!node.widgets) return

  const graphPos = comfyApp.canvas.graph_mouse
  const x = graphPos[0] - node.pos[0]
  const y = graphPos[1] - node.pos[1]

  for (const w of node.widgets) {
    let widgetWidth: number, widgetHeight: number
    if (w.computeSize) {
      ;[widgetWidth, widgetHeight] = w.computeSize(node.size[0])
    } else {
      widgetWidth = (w as { width?: number }).width || node.size[0]
      widgetHeight = LiteGraph.NODE_WIDGET_HEIGHT
    }

    if (
      w.last_y !== undefined &&
      x >= 6 &&
      x <= widgetWidth - 12 &&
      y >= w.last_y &&
      y <= w.last_y + widgetHeight
    ) {
      return w
    }
  }
}

const hideTooltip = () => (tooltipText.value = null)

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

const onIdle = () => {
  const { canvas } = comfyApp
  const node = canvas.node_over
  if (!node) return

  const ctor = node.constructor as { title_mode?: 0 | 1 | 2 | 3 }
  const nodeDef = nodeDefStore.nodeDefsByName[node.type]

  if (
    ctor.title_mode !== LiteGraph.NO_TITLE &&
    canvas.graph_mouse[1] < node.pos[1] // If we are over a node, but not within the node then we are on its title
  ) {
    return showTooltip(nodeDef.description)
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
    return showTooltip(nodeDef.input.getInput(inputName)?.tooltip)
  }

  const outputSlot = canvas.isOverNodeOutput(
    node,
    canvas.graph_mouse[0],
    canvas.graph_mouse[1],
    [0, 0]
  )
  if (outputSlot !== -1) {
    return showTooltip(nodeDef.output.all?.[outputSlot].tooltip)
  }

  const widget = getHoveredWidget()
  // Dont show for DOM widgets, these use native browser tooltips as we dont get proper mouse events on these
  if (widget && !widget.element) {
    return showTooltip(
      widget.tooltip ?? nodeDef.input.getInput(widget.name)?.tooltip
    )
  }
}

const onMouseMove = (e: MouseEvent) => {
  hideTooltip()
  clearTimeout(idleTimeout)

  if ((e.target as Node).nodeName !== 'CANVAS') return
  idleTimeout = window.setTimeout(onIdle, 500)
}

watch(
  () => settingStore.get('Comfy.EnableTooltips'),
  (enabled) => {
    if (enabled) {
      window.addEventListener('mousemove', onMouseMove)
      window.addEventListener('click', hideTooltip)
    } else {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('click', hideTooltip)
    }
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  window.removeEventListener('mousemove', onMouseMove)
  window.removeEventListener('click', hideTooltip)
})
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
