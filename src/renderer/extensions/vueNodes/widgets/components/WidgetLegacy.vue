<script setup lang="ts">
import { useResizeObserver } from '@vueuse/core'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

import { useChainCallback } from '@/composables/functional/useChainCallback'
import { CanvasPointer } from '@/lib/litegraph/src/CanvasPointer'
import type { LGraphCanvas } from '@/lib/litegraph/src/LGraphCanvas'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { augmentToCanvasPointerEvent } from '@/renderer/extensions/vueNodes/utils/eventUtils'
import { useColorPaletteStore } from '@/stores/workspace/colorPaletteStore'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'

const props = defineProps<{
  widget: SimplifiedWidget<void>
}>()

const canvasEl = ref()
const containerHeight = ref(20)

const canvas: LGraphCanvas = useCanvasStore().canvas as LGraphCanvas
let node: LGraphNode | undefined
let widgetInstance: IBaseWidget | undefined
let pointer: CanvasPointer | undefined
const scaleFactor = 2

onMounted(() => {
  node =
    canvas?.graph?.getNodeById(
      canvasEl.value.parentElement.attributes['node-id'].value
    ) ?? undefined
  if (!node) return
  widgetInstance = node.widgets?.find((w) => w.name === props.widget.name)
  if (!widgetInstance) return
  canvasEl.value.width *= scaleFactor
  if (!widgetInstance.triggerDraw)
    widgetInstance.callback = useChainCallback(
      widgetInstance.callback,
      function (this: IBaseWidget) {
        this?.triggerDraw?.()
      }
    )
  widgetInstance.triggerDraw = draw
  useResizeObserver(canvasEl.value.parentElement, draw)
  watch(() => useColorPaletteStore().activePaletteId, draw)
  pointer = new CanvasPointer(canvasEl.value)
})
onBeforeUnmount(() => {
  if (widgetInstance) widgetInstance.triggerDraw = () => {}
})

function draw() {
  if (!widgetInstance || !node) return
  const width = canvasEl.value.parentElement.clientWidth
  // Priority: computedHeight (from litegraph) > computeLayoutSize > computeSize
  let height = 20
  if (widgetInstance.computedHeight) {
    height = widgetInstance.computedHeight
  } else if (widgetInstance.computeLayoutSize) {
    height = widgetInstance.computeLayoutSize(node).minHeight
  } else if (widgetInstance.computeSize) {
    height = widgetInstance.computeSize(width)[1]
  }
  containerHeight.value = height
  // Set node.canvasHeight for legacy widgets that use it (e.g., Impact Pack)
  node.canvasHeight = height
  widgetInstance.y = 0
  canvasEl.value.height = (height + 2) * scaleFactor
  canvasEl.value.width = width * scaleFactor
  const ctx = canvasEl.value?.getContext('2d')
  if (!ctx) return
  ctx.scale(scaleFactor, scaleFactor)
  widgetInstance.draw?.(ctx, node, width, 1, height)
}
//See LGraphCanvas.processWidgetClick
function handleDown(e: PointerEvent) {
  if (!node || !widgetInstance || !pointer) return
  augmentToCanvasPointerEvent(e, node, canvas)
  pointer.down(e)
  if (widgetInstance.mouse)
    pointer.onDrag = (e) =>
      widgetInstance!.mouse?.(e, [e.offsetX, e.offsetY], node!)
  //NOTE: a mouseUp event is already registed under pointer.finally
  canvas.processWidgetClick(e, node, widgetInstance, pointer)
}
function handleUp(e: PointerEvent) {
  if (!pointer || !node) return
  augmentToCanvasPointerEvent(e, node, canvas)
  e.click_time = e.timeStamp - (pointer?.eDown?.timeStamp ?? 0)
  pointer.up(e)
}
function handleMove(e: PointerEvent) {
  if (!pointer || !node) return
  augmentToCanvasPointerEvent(e, node, canvas)
  pointer.move(e)
}
</script>
<template>
  <div
    class="relative mx-[-12px] min-w-0 basis-0"
    :style="{ minHeight: `${containerHeight}px` }"
  >
    <canvas
      ref="canvasEl"
      class="absolute w-full cursor-crosshair"
      @pointerdown.stop="handleDown"
      @pointerup.stop="handleUp"
      @pointermove.stop="handleMove"
    />
  </div>
</template>
