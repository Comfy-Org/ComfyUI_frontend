<script setup lang="ts">
import { ref, onMounted } from 'vue'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import {  LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import type { CanvasPointerEvent } from 'lib/litegrpah/src/types/events'
import { BaseWidget } from '@/lib/litegraph/src/widgets/BaseWidget'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'

const props = defineProps<{
  widget: SimplifiedWidget<void>
  readonly?: boolean
}>()


const canvasEl = ref()
console.log(props.widget)


const { canvas } = useCanvasStore()
let node: LGraphNode|undefined
let widget: IBaseWidget|undefined
onMounted(() => {
  node = canvas?.graph?.getNodeById(canvasEl.value.attributes['node-id'].value) ?? undefined
  if (!node) return
  widget = node.widgets?.find((w) => w.name === props.widget.name)
  if (!widget) return
  const originalCallback = widget.callback
  widget.callback = function(...args) {
    const ret = originalCallback?.apply(this, args)
    draw()
    return ret
  }
  draw()
})
function draw() {
  if (!widget || !node) return
  const ctx = canvasEl.value?.getContext('2d')
  if (!ctx) return
  const bgcolor = LiteGraph.WIDGET_BGCOLOR
  try {
    //zinc-500/10
    LiteGraph.WIDGET_BGCOLOR = "#71717A1A"
    const { width } = canvasEl.value
    const height = widget.computeSize ? widget.computeSize(width)[1] : 20
    widget.y = 0
    canvasEl.value.height = height
    ctx.fill
    if (widget instanceof BaseWidget)
      widget.drawWidget(ctx, { width, showText: true })
    else
      widget.draw?.(ctx, node, width, 0, height)
  } finally {
    LiteGraph.WIDGET_BGCOLOR = bgcolor
  }
}
//TODO: some nodes use onPointerDown
let interactingMouse: boolean = false
function handleMouse(e: PointerEvent) {
  if (!node || !widget || !canvas) return
  if (e.type == 'pointerup')
    interactingMouse = false
  else if (e.type == 'pointerdown')
    interactingMouse = true
  else if (e.type == 'pointermove' && !interactingMouse)
    return
  const x = e.offsetX
  const y = e.offsetY
  const canvasPointerEvent: CanvasPointerEvent = {
    ...e,
    canvasX: x + node.pos[0],
    canvasY: y + node.pos[1]
  }

  if (widget.mouse) {
    widget.mouse(canvasPointerEvent, [x, y], node)
    return
  }
  if (!(widget instanceof BaseWidget)) return
  if (widget.onClick && e.type == 'pointerup')
    widget.onClick({e: canvasPointerEvent, node, canvas})
  else if (widget.onDrag && e.type =='pointermove' && interactingMouse)
    widget.onDrag({e: canvasPointerEvent, node, canvas})
}
</script>
<template>
  <canvas ref="canvasEl" class="ml-[-24px] mr-[-16px] cursor-crosshair"
    @pointerdown="handleMouse"
    @pointermove="handleMouse"
    @pointerup="handleMouse"
    />
</template>
