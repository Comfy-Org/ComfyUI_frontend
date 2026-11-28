<script setup lang="ts">
import { useResizeObserver, whenever } from '@vueuse/core'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

import { useChainCallback } from '@/composables/functional/useChainCallback'
import { CanvasPointer } from '@/lib/litegraph/src/CanvasPointer'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import {
  getWidgetSizing,
  minRowHeight
} from '@/lib/litegraph/src/utils/widgetLayout'
import type { LGraphCanvas } from '@/lib/litegraph/src/LGraphCanvas'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { CanvasPointerEvent } from '@comfyorg/graph-model/events'
import type { IBaseWidget } from '@comfyorg/graph-model/widgets'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { augmentToCanvasPointerEvent } from '@/renderer/extensions/vueNodes/utils/eventUtils'
import { resolveWidgetFromHostNode } from '@/renderer/extensions/vueNodes/widgets/utils/resolvePromotedWidget'
import { useThemeStore } from '@/platform/theme/themeStore'
import { useWidgetHostNode } from '@/renderer/extensions/vueNodes/widgets/composables/useWidgetHostNode'
import {
  readLegacyWidgetGeometry,
  rememberGeometryBeforeVueNodes,
  writeLegacyWidgetGeometry
} from '@/renderer/extensions/vueNodes/widgets/utils/legacyWidgetCanvasGeometry'
import type { NodeId } from '@comfyorg/graph-model/nodeId'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'

const props = defineProps<{
  widget: SimplifiedWidget<undefined>
  nodeId: NodeId
}>()

const canvasEl = ref()
const containerHeight = ref(20)
let drawnHeight = 20

const canvasStore = useCanvasStore()
const owner = useWidgetHostNode(() => props.nodeId)
const canvas: LGraphCanvas = canvasStore.canvas as LGraphCanvas
let node: LGraphNode | undefined
let widgetInstance: IBaseWidget | undefined
let pointer: CanvasPointer | undefined
let rowGeometry: { y: number; width: number; canvasHeight: number } | undefined
const scaleFactor = 2

function findLegacyWidget():
  | {
      node: LGraphNode
      widget: IBaseWidget
    }
  | undefined {
  return resolveWidgetFromHostNode(owner.value, props.widget.name)
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
watch(owner, bindWidget, { flush: 'post' })

function getRowHeights(
  widget: IBaseWidget,
  node: LGraphNode,
  row: HTMLElement
): { minHeight: number; height: number; grows: boolean } {
  const sizing = getWidgetSizing(widget, node, row.clientWidth)
  if (sizing?.kind === 'growable') {
    const minHeight = Math.max(0, sizing.minHeight)
    const height = Math.max(minHeight, row.clientHeight)
    return { minHeight, height, grows: true }
  }
  const minHeight = Math.max(
    0,
    widget.computedHeight ?? (sizing ? minRowHeight(sizing) : 20)
  )
  const height = Math.max(minHeight, row.clientHeight)
  return { minHeight, height, grows: false }
}

function classicDrawY(
  node: LGraphNode,
  { minHeight, height, grows }: ReturnType<typeof getRowHeights>
) {
  return !grows && height > minHeight ? node.size[1] - height : 1
}

function withRowGeometry(run: () => void) {
  if (!widgetInstance || !node || !rowGeometry) return run()
  const widget = widgetInstance
  const host = node
  const canvasGeometry = readLegacyWidgetGeometry(widget, host)
  writeLegacyWidgetGeometry(widget, host, {
    y: rowGeometry.y,
    last_y: rowGeometry.y,
    width: rowGeometry.width,
    canvasHeight: rowGeometry.canvasHeight
  })
  try {
    run()
  } finally {
    if (LiteGraph.vueNodesMode)
      rememberGeometryBeforeVueNodes(widget, host, canvasGeometry)
    else writeLegacyWidgetGeometry(widget, host, canvasGeometry)
  }
}

function draw() {
  if (!widgetInstance || !node) return
  const widget = widgetInstance
  const host = node
  const row = canvasEl.value.parentElement
  const width = row.clientWidth
  const heights = getRowHeights(widget, host, row)
  const { minHeight, height, grows } = heights
  containerHeight.value = minHeight
  drawnHeight = grows ? height : minHeight
  const drawY = classicDrawY(host, heights)
  rowGeometry = { y: drawY - 1, width, canvasHeight: height }
  if (grows) widget.computedHeight = height
  canvasEl.value.height = height === 0 ? 0 : (height + 2) * scaleFactor
  canvasEl.value.width = width * scaleFactor
  withRowGeometry(() => {
    const ctx = canvasEl.value.getContext('2d')
    if (!ctx) return
    ctx.scale(scaleFactor, scaleFactor)
    ctx.translate(0, 1 - drawY)
    widget.draw?.(ctx, host, width, drawY, drawnHeight)
  })
}
function augmentToWidgetPointerEvent(
  e: PointerEvent,
  node: LGraphNode
): asserts e is CanvasPointerEvent {
  augmentToCanvasPointerEvent(e, node, canvas)
  canvas.graph_mouse[1] += widgetInstance?.y ?? 0
  Object.assign(e, {
    canvasX: canvas.graph_mouse[0],
    canvasY: canvas.graph_mouse[1]
  })
}
function isInWidgetBand(e: PointerEvent) {
  return e.offsetY <= drawnHeight + 2
}
function handleDown(e: PointerEvent) {
  if (!isInWidgetBand(e)) return
  e.stopPropagation()
  if (!node || !widgetInstance || !pointer || e.button !== 0) return
  const host = node
  const widget = widgetInstance
  const activePointer = pointer
  withRowGeometry(() => {
    augmentToWidgetPointerEvent(e, host)
    activePointer.down(e)
    if (widget.mouse)
      activePointer.onDrag = (e) =>
        widget.mouse?.(e, [e.offsetX, e.offsetY + (widget.y ?? 0)], host)
    canvas.processWidgetClick(e, host, widget, activePointer)
  })
  canvas.setDirty(true)
}
function handleUp(e: PointerEvent) {
  if (!pointer || !node) return
  if (!pointer.eDown && !isInWidgetBand(e)) return
  e.stopPropagation()
  const host = node
  const activePointer = pointer
  withRowGeometry(() => {
    augmentToWidgetPointerEvent(e, host)
    e.click_time = e.timeStamp - (activePointer.eDown?.timeStamp ?? 0)
    activePointer.up(e)
  })
  canvas.setDirty(true)
}
function handleMove(e: PointerEvent) {
  if (!pointer || !node) return
  if (!pointer.eDown && !isInWidgetBand(e)) return
  e.stopPropagation()
  const host = node
  const activePointer = pointer
  withRowGeometry(() => {
    augmentToWidgetPointerEvent(e, host)
    activePointer.move(e)
  })
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
      @pointerdown="handleDown"
      @pointerup="handleUp"
      @pointermove="handleMove"
    />
  </div>
</template>
