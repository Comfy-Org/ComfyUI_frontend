<script setup lang="ts">
import { onMounted, ref } from 'vue'

import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { BaseWidget } from '@/lib/litegraph/src/widgets/BaseWidget'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'

const props = defineProps<{
  widget: SimplifiedWidget<void>
  readonly?: boolean
}>()

const canvasEl = ref()

const { canvas } = useCanvasStore()
let node: LGraphNode | undefined
let widgetInstance: IBaseWidget | undefined
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
//TODO: some nodes use onPointerDown
let interactingMouse: boolean = false
function handleMouse(e: PointerEvent) {
  if (!node || !widgetInstance || !canvas) return
  if (e.type == 'pointerup') interactingMouse = false
  else if (e.type == 'pointerdown') interactingMouse = true
  else if (e.type == 'pointermove' && !interactingMouse) return
  const x = e.offsetX
  const y = e.offsetY
  if (widgetInstance.mouse) {
    // @ts-expect-error - event is missing properties
    widgetInstance.mouse(e, [x, y], node)
  }
}
</script>
<template>
  <canvas
    ref="canvasEl"
    class="ml-[-24px] mr-[-16px] cursor-crosshair"
    @pointerdown="handleMouse"
    @pointermove="handleMouse"
    @pointerup="handleMouse"
  />
</template>
