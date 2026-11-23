<script setup lang="ts">
import { useResizeObserver, whenever } from '@vueuse/core'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

import { useChainCallback } from '@/composables/functional/useChainCallback'
import { CanvasPointer } from '@comfyorg/litegraph/CanvasPointer'
import {
  getWidgetSizing,
  minRowHeight
} from '@comfyorg/litegraph/utils/widgetLayout'
import type { LGraphCanvas } from '@comfyorg/litegraph/LGraphCanvas'
import type { LGraphNode } from '@comfyorg/litegraph/LGraphNode'
import type { CanvasPointerEvent } from '@comfyorg/graph-model/events'
import type { IBaseWidget } from '@comfyorg/graph-model/widgets'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { augmentToCanvasPointerEvent } from '@/renderer/extensions/vueNodes/utils/eventUtils'
import { resolveWidgetFromHostNode } from '@/renderer/extensions/vueNodes/widgets/utils/resolvePromotedWidget'
import { useThemeStore } from '@/platform/theme/themeStore'
import { useWidgetHostNode } from '@/renderer/extensions/vueNodes/widgets/composables/useWidgetHostNode'
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

function draw() {
  if (!widgetInstance || !node) return
  const row = canvasEl.value.parentElement
  const width = row.clientWidth
  const heights = getRowHeights(widgetInstance, node, row)
  const { minHeight, height, grows } = heights
  containerHeight.value = minHeight
  drawnHeight = grows ? height : minHeight
  node.canvasHeight = height
  const drawY = classicDrawY(node, heights)
  widgetInstance.y = drawY - 1
  widgetInstance.last_y = drawY - 1
  widgetInstance.width = width
  if (grows) widgetInstance.computedHeight = height
  canvasEl.value.height = height === 0 ? 0 : (height + 2) * scaleFactor
  canvasEl.value.width = width * scaleFactor
  const ctx = canvasEl.value.getContext('2d')
  if (!ctx) return
  ctx.scale(scaleFactor, scaleFactor)
  ctx.translate(0, 1 - drawY)
  widgetInstance.draw?.(ctx, node, width, drawY, drawnHeight)
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
  augmentToWidgetPointerEvent(e, node)
  pointer.down(e)
  if (widgetInstance.mouse)
    pointer.onDrag = (e) =>
      widgetInstance!.mouse?.(
        e,
        [e.offsetX, e.offsetY + (widgetInstance!.y ?? 0)],
        node!
      )
  canvas.processWidgetClick(e, node, widgetInstance, pointer)
  canvas.setDirty(true)
}
function handleUp(e: PointerEvent) {
  if (!pointer || !node) return
  if (!pointer.eDown && !isInWidgetBand(e)) return
  e.stopPropagation()
  augmentToWidgetPointerEvent(e, node)
  e.click_time = e.timeStamp - (pointer.eDown?.timeStamp ?? 0)
  pointer.up(e)
  canvas.setDirty(true)
}
function handleMove(e: PointerEvent) {
  if (!pointer || !node) return
  if (!pointer.eDown && !isInWidgetBand(e)) return
  e.stopPropagation()
  augmentToWidgetPointerEvent(e, node)
  pointer.move(e)
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
