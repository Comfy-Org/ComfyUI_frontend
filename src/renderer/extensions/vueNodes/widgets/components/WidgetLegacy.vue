<script setup lang="ts">
import { reactive, ref, onMounted, watch } from 'vue'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'

// Button widgets don't have a v-model value, they trigger actions
const props = defineProps<{
  widget: SimplifiedWidget<void>
  readonly?: boolean
}>()


const canvasEl = ref()
console.log(props.widget)


const { canvas } = useCanvasStore()
let node
let widget
onMounted(() => {
  node = canvas.graph.getNodeById(canvasEl.value.attributes['node-id'].value)
  if (!node) return
  widget = node.widgets.find((w) => w.name === props.widget.name)
  const originalCallback = widget.callback
  widget.callback = function() {
    const ret = originalCallback.apply(this, arguments)
    draw()
    return ret
  }
  draw()
})
function draw() {
  const ctx = canvasEl.value?.getContext('2d')
  if (!ctx) return
  const bgcolor = window.LiteGraph.WIDGET_BGCOLOR
  try {
    //zinc-500/10
    window.LiteGraph.WIDGET_BGCOLOR = "#71717A1A"
    const { width } = canvasEl.value
    const height = widget.computeSize ? widget.computeSize(width)[1] : 20
    widget.y = 0
    canvasEl.value.height = height
    ctx.fill
    if (widget.draw)
      widget.draw(ctx, node, width, 0, height)
    else
      widget.drawWidget(ctx, { width, showText: true })
  } finally {
    window.LiteGraph.WIDGET_BGCOLOR = bgcolor
  }
}
//TODO: some nodes use onPointerDown
let interactingMouse: boolean = false
function handleMouse(e) {
  if (e.type == 'pointerup')
    interactingMouse = false
  else if (e.type == 'pointerdown')
    interactingMouse = true
  else if (e.type == 'pointermove' && !interactingMouse)
    return
  const x = e.offsetX
  const y = e.offsetY
  e.canvasX = x + node.pos[0]
  e.canvasY = y + node.pos[1]

  if (widget.mouse) {
    widget.mouse(e, [x, y], node)
    return
  }
  if (widget.onClick && e.type == 'pointerup')
    widget.onClick({e, node, canvas})
  else if (widget.onDrag && e.type =='pointermove' && interactingMouse)
    widget.onDrag({e, node, canvas})
}
</script>
<template>
  <canvas ref="canvasEl" class="ml-[-24px] mr-[-16px] cursor-crosshair"
    @pointerdown="handleMouse"
    @pointermove="handleMouse"
    @pointerup="handleMouse"
    />
</template>
