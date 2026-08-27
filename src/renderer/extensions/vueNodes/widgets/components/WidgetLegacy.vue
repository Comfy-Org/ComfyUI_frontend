<script setup lang="ts">
import { useResizeObserver, whenever } from '@vueuse/core'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

import { useChainCallback } from '@/composables/functional/useChainCallback'
import { CanvasPointer } from '@/lib/litegraph/src/CanvasPointer'
import type { LGraphCanvas } from '@/lib/litegraph/src/LGraphCanvas'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { augmentToCanvasPointerEvent } from '@/renderer/extensions/vueNodes/utils/eventUtils'
import { resolveWidgetFromHostNode } from '@/renderer/extensions/vueNodes/widgets/utils/resolvePromotedWidget'
import { useColorPaletteStore } from '@/stores/workspace/colorPaletteStore'
import type { NodeId } from '@/types/nodeId'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'

const props = defineProps<{
  widget: SimplifiedWidget<undefined>
  nodeId: NodeId
}>()

const canvasEl = ref()
const containerHeight = ref(20)

const canvasStore = useCanvasStore()
const canvas: LGraphCanvas = canvasStore.canvas as LGraphCanvas
let node: LGraphNode | undefined
let widgetInstance: IBaseWidget | undefined
let pointer: CanvasPointer | undefined
const scaleFactor = 2

type LegacyWidgetNode = LGraphNode & { canvasHeight?: number }

function findLegacyWidget():
  | {
      node: LGraphNode
      widget: IBaseWidget
    }
  | undefined {
  const hostNode = canvas?.graph?.getNodeById(props.nodeId) ?? undefined
  return resolveWidgetFromHostNode(hostNode, props.widget.name)
}

function bindWidget() {
  if (widgetInstance) widgetInstance.triggerDraw = () => {}

  const resolved = findLegacyWidget()
  if (!resolved) {
    widgetInstance = undefined
    node = undefined
    return
  }
  node = resolved.node
  widgetInstance = resolved.widget
  if (!widgetInstance.triggerDraw)
    widgetInstance.callback = useChainCallback(
      widgetInstance.callback,
      function (this: IBaseWidget) {
        this?.triggerDraw?.()
      }
    )
  widgetInstance.triggerDraw = draw
  draw()
}

onMounted(() => {
  canvasEl.value.width *= scaleFactor
  bindWidget()
  if (!widgetInstance) return
  useResizeObserver(canvasEl, draw)
  watch(() => useColorPaletteStore().activePaletteId, draw)
  pointer = new CanvasPointer(canvasEl.value)
})
onBeforeUnmount(() => {
  if (widgetInstance) widgetInstance.triggerDraw = () => {}
})

whenever(() => !canvasStore.linearMode, bindWidget)
watch(() => canvasStore.currentGraph, bindWidget)

function withHostWidgetGeometry<T>(
  widget: IBaseWidget,
  hostNode: LGraphNode,
  callback: (width: number, legacyNode: LegacyWidgetNode) => T,
  hostHeight?: number
): T | undefined {
  const parent = canvasEl.value?.parentElement
  if (!parent) return

  const legacyNode = hostNode as LegacyWidgetNode
  const previousWidth = widget.width
  const previousY = widget.y
  const hadCanvasHeight = Object.hasOwn(legacyNode, 'canvasHeight')
  const previousCanvasHeight = legacyNode.canvasHeight
  const width = canvasEl.value.getBoundingClientRect().width || parent.clientWidth

  // Host geometry is ephemeral renderer-local state, not authoritative graph
  // layout. Borrow it only for this synchronous operation and restore it below.
  widget.width = width
  widget.y = 0
  if (hostHeight !== undefined) legacyNode.canvasHeight = hostHeight

  try {
    return callback(width, legacyNode)
  } finally {
    widget.width = previousWidth
    widget.y = previousY
    if (hadCanvasHeight) legacyNode.canvasHeight = previousCanvasHeight
    else delete legacyNode.canvasHeight
  }
}

function draw() {
  const currentWidget = widgetInstance
  const currentNode = node
  if (!currentWidget || !currentNode) return

  withHostWidgetGeometry(currentWidget, currentNode, (width, legacyNode) => {
    // Priority: computedHeight (from litegraph) > computeLayoutSize > computeSize
    let height = 20
    if (currentWidget.computedHeight) {
      height = currentWidget.computedHeight
    } else if (currentWidget.computeLayoutSize) {
      height = currentWidget.computeLayoutSize(currentNode).minHeight
    } else if (currentWidget.computeSize) {
      height = currentWidget.computeSize(width)[1]
    }
    containerHeight.value = height
    // Legacy custom widgets such as Impact Pack read this during drawing.
    legacyNode.canvasHeight = height
    canvasEl.value.height = (height + 2) * scaleFactor
    canvasEl.value.width = width * scaleFactor
    const ctx = canvasEl.value?.getContext('2d')
    if (!ctx) return
    ctx.scale(scaleFactor, scaleFactor)
    currentWidget.draw?.(ctx, currentNode, width, 1, height)
  })
}
//See LGraphCanvas.processWidgetClick
function handleDown(e: PointerEvent) {
  const currentNode = node
  const currentWidget = widgetInstance
  const currentPointer = pointer
  if (!currentNode || !currentWidget || !currentPointer) return

  withHostWidgetGeometry(
    currentWidget,
    currentNode,
    () => {
      augmentToCanvasPointerEvent(e, currentNode, canvas)
      currentPointer.down(e)
      if (currentWidget.mouse)
        currentPointer.onDrag = (e) =>
          withHostWidgetGeometry(
            currentWidget,
            currentNode,
            () => currentWidget.mouse?.(e, [e.offsetX, e.offsetY], currentNode),
            containerHeight.value
          )
      //NOTE: a mouseUp event is already registed under pointer.finally
      canvas.processWidgetClick(e, currentNode, currentWidget, currentPointer)
    },
    containerHeight.value
  )
}
function handleUp(e: PointerEvent) {
  const currentPointer = pointer
  const currentNode = node
  const currentWidget = widgetInstance
  if (!currentPointer || !currentNode) return

  augmentToCanvasPointerEvent(e, currentNode, canvas)
  e.click_time = e.timeStamp - (currentPointer.eDown?.timeStamp ?? 0)
  if (currentWidget) {
    withHostWidgetGeometry(
      currentWidget,
      currentNode,
      () => currentPointer.up(e),
      containerHeight.value
    )
  } else {
    currentPointer.up(e)
  }
}
function handleMove(e: PointerEvent) {
  const currentPointer = pointer
  const currentNode = node
  const currentWidget = widgetInstance
  if (!currentPointer || !currentNode) return

  augmentToCanvasPointerEvent(e, currentNode, canvas)
  if (currentWidget) {
    withHostWidgetGeometry(
      currentWidget,
      currentNode,
      () => currentPointer.move(e),
      containerHeight.value
    )
  } else {
    currentPointer.move(e)
  }
}
</script>
<template>
  <div
    class="relative mx-[-12px] w-full min-w-0"
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
