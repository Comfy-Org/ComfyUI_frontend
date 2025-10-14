<script setup lang="ts">
import { onMounted, ref } from 'vue'

import { CanvasPointer } from '@/lib/litegraph/src/CanvasPointer'
import type { LGraphCanvas } from '@/lib/litegraph/src/LGraphCanvas'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { CanvasPointerEvent } from '@/lib/litegraph/src/types/events'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { BaseWidget } from '@/lib/litegraph/src/widgets/BaseWidget'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'

const props = defineProps<{
  widget: SimplifiedWidget<void>
  readonly?: boolean
}>()

const canvasEl = ref()

const canvas: LGraphCanvas = useCanvasStore().canvas as LGraphCanvas
let node: LGraphNode | undefined
let widgetInstance: IBaseWidget | undefined
let pointer: CanvasPointer | undefined
onMounted(() => {
  node =
    canvas?.graph?.getNodeById(canvasEl.value.attributes['node-id'].value) ??
    undefined
  if (!node) return
  widgetInstance = node.widgets?.find((w) => w.name === props.widget.name)
  if (!widgetInstance) return
  const originalCallback = widgetInstance.callback
  widgetInstance.callback = function (...args) {
    const ret = originalCallback?.apply(this, args)
    draw()
    return ret
  }
  draw()
  pointer = new CanvasPointer(canvasEl.value)
})
function draw() {
  if (!widgetInstance || !node) return
  const ctx = canvasEl.value?.getContext('2d')
  if (!ctx) return
  const bgcolor = LiteGraph.WIDGET_BGCOLOR
  try {
    //zinc-500/10
    LiteGraph.WIDGET_BGCOLOR = '#71717A1A'
    const { width } = canvasEl.value
    const height = widgetInstance.computeSize
      ? widgetInstance.computeSize(width)[1]
      : 20
    widgetInstance.y = 0
    canvasEl.value.height = height
    if (widgetInstance instanceof BaseWidget)
      widgetInstance.drawWidget(ctx, { width, showText: true })
    else widgetInstance.draw?.(ctx, node, width, 0, height)
  } finally {
    LiteGraph.WIDGET_BGCOLOR = bgcolor
  }
}
function translateEvent(e: PointerEvent): asserts e is CanvasPointerEvent {
  if (!node) return
  canvas.adjustMouseEvent(e)
  canvas.graph_mouse[0] = e.offsetX + node.pos[0]
  canvas.graph_mouse[1] = e.offsetY + node.pos[1]
}
//See LGraphCanvas.processWidgetClick
function handleDown(e: PointerEvent) {
  if (!node || !widgetInstance || !pointer) return
  translateEvent(e)
  pointer.down(e)
  if (widgetInstance.mouse) {
    pointer.onDrag = (e) =>
      widgetInstance!.mouse?.(e, [e.offsetX, e.offsetY], node!)
    pointer.onClick = (e) =>
      widgetInstance!.mouse?.(e, [e.offsetX, e.offsetY], node!)
  }
  canvas.processWidgetClick(e, node, widgetInstance, pointer)
}
function handleUp(e: PointerEvent) {
  if (!pointer) return
  translateEvent(e)
  pointer.up(e)
}
function handleMove(e: PointerEvent) {
  if (!pointer) return
  translateEvent(e)
  pointer.move(e)
}
</script>
<template>
  <canvas
    ref="canvasEl"
    class="mr-[-16px] ml-[-24px] cursor-crosshair"
    @pointerdown="handleDown"
    @pointerup="handleUp"
    @pointermove="handleMove"
  />
</template>
