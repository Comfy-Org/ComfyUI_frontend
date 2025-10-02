<template>
  <canvas ref="canvas" class="w-full h-7 ml-[-24px] mr-[-16px] my-[-16px]"
    @pointerdown="handleMouse"
    @pointermove="handleMouse"
    @pointerup="handleMouse"
    />
</template>

<script setup lang="ts">
import { computed, ref, onBeforeUnmount, onMounted } from 'vue'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'

// Button widgets don't have a v-model value, they trigger actions
const props = defineProps<{
  widget: SimplifiedWidget<void>
  readonly?: boolean
}>()

const canvas = ref()
console.log(props.widget)
let interval
let node
let widget
onMounted(() => {
  interval = setInterval(draw, 100)
  node = window.app.canvas.graph.getNodeById(canvas.value.attributes['node-id'].value)
  widget = node.widgets.find((w) => w.name === props.widget.name)
})
onBeforeUnmount(() => {
  clearInterval(interval)
})
function draw() {
  const ctx = canvas.value?.getContext('2d')
  if (!ctx) {
    clearInterval(interval)
    return
  }
  window.LiteGraph.WIDGET_BGCOLOR = "#71717A1A"
  const { width } = canvas.value
  const height = widget.computeSize ? widget.computeSize(width)[1] : 20
  widget.y = 0
  canvas.value.height = height
  ctx.fill
  if (widget.draw)
    widget.draw(ctx, node, width, 0, height)
  else
    widget.drawWidget(ctx, { width, showText: true })
}
let interactingMouse: boolean = false
function handleMouse(e) {
  if (e.type == 'pointerup')
    interactingMouse = false
  else if (e.type == 'pointerdown')
    interactingMouse = true
  else if (e.type == 'pointermove' && !interactingMouse)
    return
  const ds = window.app.canvas.ds
  const { x, y } = canvas.value.getBoundingClientRect()

  if (widget.mouse)
    widget.mouse(e, [(e.x - x)/ds.scale, (e.y - y)/ds.scale], node)
}
</script>
