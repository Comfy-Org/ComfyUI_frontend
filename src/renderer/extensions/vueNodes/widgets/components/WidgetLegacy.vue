<script setup lang="ts">
import { useResizeObserver, whenever } from '@vueuse/core'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

import { useChainCallback } from '@/composables/functional/useChainCallback'
import { CanvasPointer } from '@/lib/litegraph/src/CanvasPointer'
import type { LGraphCanvas } from '@/lib/litegraph/src/LGraphCanvas'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { CanvasPointerEvent } from '@comfyorg/graph-model/events'
import type { IBaseWidget } from '@comfyorg/graph-model/widgets'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { augmentToCanvasPointerEvent } from '@/renderer/extensions/vueNodes/utils/eventUtils'
import { resolveWidgetFromHostNode } from '@/renderer/extensions/vueNodes/widgets/utils/resolvePromotedWidget'
import { useThemeStore } from '@/platform/theme/themeStore'
import type { NodeId } from '@comfyorg/graph-model/nodeId'
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

function findLegacyWidget():
  | {
      node: LGraphNode
      widget: IBaseWidget
    }
  | undefined {
  const hostNode = canvas.graph?.getNodeById(props.nodeId) ?? undefined
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
        this.triggerDraw?.()
      }
    )
  widgetInstance.triggerDraw = draw
  draw()
}

onMounted(() => {
  canvasEl.value.width *= scaleFactor
  bindWidget()
  if (!widgetInstance) return
  useResizeObserver(canvasEl.value.parentElement, draw)
  watch(() => useThemeStore().activePresetId, draw)
  pointer = new CanvasPointer(canvasEl.value)
})
onBeforeUnmount(() => {
  if (widgetInstance) widgetInstance.triggerDraw = () => {}
})

whenever(() => !canvasStore.linearMode, bindWidget)
watch(() => canvasStore.currentGraph, bindWidget)

function getWidgetHeight(
  widget: IBaseWidget,
  node: LGraphNode,
  width: number
): number {
  return Math.max(
    0,
    widget.computedHeight ??
      widget.computeLayoutSize?.(node).minHeight ??
      widget.computeSize?.(width)[1] ??
      20
  )
}

/**
 * Runs `fn` with the widget laid out for this component's own canvas.
 *
 * The widget instance is shared with the litegraph canvas. Outside Vue nodes
 * mode the graph canvas owns its layout, so the previous values are put back
 * afterwards. Otherwise a legacy widget shown in the properties panel keeps
 * the panel's width and is drawn at that width on its node.
 */
function withLocalLayout<T>(
  widget: IBaseWidget,
  width: number,
  fn: () => T
): T {
  const { y, last_y, width: previousWidth } = widget
  widget.y = 0
  widget.last_y = 0
  widget.width = width
  try {
    return fn()
  } finally {
    if (!LiteGraph.vueNodesMode) {
      widget.y = y
      widget.last_y = last_y
      widget.width = previousWidth
    }
  }
}

function getLayoutWidth(): number {
  return canvasEl.value.parentElement.clientWidth
}

function draw() {
  if (!widgetInstance || !node) return
  const widget = widgetInstance
  const hostNode = node
  const width = getLayoutWidth()
  const height = getWidgetHeight(widget, hostNode, width)
  containerHeight.value = height
  hostNode.canvasHeight = height
  canvasEl.value.height = height === 0 ? 0 : (height + 2) * scaleFactor
  canvasEl.value.width = width * scaleFactor
  withLocalLayout(widget, width, () => {
    const ctx = canvasEl.value.getContext('2d')
    if (!ctx) return
    ctx.scale(scaleFactor, scaleFactor)
    widget.draw?.(ctx, hostNode, width, 1, height)
  })
}
function augmentToWidgetPointerEvent(
  e: PointerEvent,
  node: LGraphNode
): asserts e is CanvasPointerEvent {
  augmentToCanvasPointerEvent(e, node, canvas)
  Object.assign(e, {
    canvasX: canvas.graph_mouse[0],
    canvasY: canvas.graph_mouse[1]
  })
}
function handleDown(e: PointerEvent) {
  if (!node || !widgetInstance || !pointer || e.button !== 0) return
  const widget = widgetInstance
  const hostNode = node
  const activePointer = pointer
  augmentToWidgetPointerEvent(e, hostNode)
  withLocalLayout(widget, getLayoutWidth(), () => {
    activePointer.down(e)
    if (widget.mouse)
      activePointer.onDrag = (e) =>
        widget.mouse?.(e, [e.offsetX, e.offsetY], hostNode)
    canvas.processWidgetClick(e, hostNode, widget, activePointer)
  })
  canvas.setDirty(true)
}
function handleUp(e: PointerEvent) {
  if (!pointer || !node || !widgetInstance) return
  const activePointer = pointer
  augmentToWidgetPointerEvent(e, node)
  e.click_time = e.timeStamp - (activePointer.eDown?.timeStamp ?? 0)
  withLocalLayout(widgetInstance, getLayoutWidth(), () => activePointer.up(e))
  canvas.setDirty(true)
}
function handleMove(e: PointerEvent) {
  if (!pointer || !node || !widgetInstance) return
  const activePointer = pointer
  augmentToWidgetPointerEvent(e, node)
  withLocalLayout(widgetInstance, getLayoutWidth(), () => activePointer.move(e))
  if (e.buttons) canvas.setDirty(true)
}
</script>
<template>
  <div
    class="relative -mx-3 min-w-0"
    :style="{ minHeight: `${containerHeight}px` }"
  >
    <canvas
      ref="canvasEl"
      data-testid="legacy-widget-canvas"
      class="absolute w-full cursor-crosshair"
      @pointerdown.stop="handleDown"
      @pointerup.stop="handleUp"
      @pointermove.stop="handleMove"
    />
  </div>
</template>
