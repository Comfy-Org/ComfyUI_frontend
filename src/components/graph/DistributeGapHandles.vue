<template>
  <div
    v-if="handles.length"
    class="pointer-events-none absolute inset-0 z-2 overflow-hidden"
  >
    <div
      v-for="handle in handles"
      :key="handle.index"
      role="separator"
      tabindex="0"
      data-testid="distribute-gap-handle"
      :aria-label="t('g.distributeGap')"
      :aria-orientation="axis === 'x' ? 'vertical' : 'horizontal'"
      :aria-valuenow="handle.gap"
      :class="
        cn(
          'group pointer-events-auto absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center outline-none',
          axis === 'x' ? 'h-8 w-3 cursor-ew-resize' : 'h-3 w-8 cursor-ns-resize'
        )
      "
      :style="{ left: `${handle.left}px`, top: `${handle.top}px` }"
      @pointerdown="startDrag($event, handle.index)"
      @keydown="nudge($event, handle.index)"
    >
      <div
        :class="
          cn(
            'rounded-sm bg-primary group-hover:brightness-125 group-focus-visible:ring-2 group-focus-visible:ring-primary/50',
            axis === 'x' ? 'h-6 w-1.5' : 'h-1.5 w-6'
          )
        "
      />
      <span
        :class="
          cn(
            'absolute text-[11px] whitespace-nowrap text-primary tabular-nums',
            axis === 'x' ? 'bottom-full mb-1' : 'left-full ml-1'
          )
        "
      >
        {{ handle.gap }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import type { SnapBox } from '@/lib/litegraph/src/canvas/gestureSnap'
import { onCanvasFrame } from '@/lib/litegraph/src/canvas/canvasFrame'
import type { LGraphCanvas, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { nodeBox } from '@/renderer/core/canvas/smartGuides/dragSnapSession'
import {
  evenGap,
  gapAfterTravel,
  setGap
} from '@/renderer/core/canvas/smartGuides/distributeGaps'
import type { DistributeAxis } from '@/renderer/core/canvas/smartGuides/distributeGaps'
import { distributeSession } from '@/renderer/core/canvas/smartGuides/smartGuidesState'
import { useLayoutMutations } from '@/renderer/core/layout/operations/layoutMutations'
import { LayoutSource } from '@/renderer/core/layout/types'

interface GapHandle {
  index: number
  gap: number
  left: number
  top: number
}

const { t } = useI18n()
const canvasStore = useCanvasStore()
const workflowStore = useWorkflowStore()
const mutations = useLayoutMutations(LayoutSource.Canvas)

const handles = ref<GapHandle[]>([])
const axis = ref<DistributeAxis>('x')
let handlesKey = ''

function sessionNodes(canvas: LGraphCanvas): LGraphNode[] | undefined {
  const session = distributeSession.value
  const { graph } = canvas
  if (!session || !graph || session.graph !== graph || canvas.read_only) return
  if (canvas.selectedItems.size !== session.selectionSize) return
  const nodes = session.nodeIds.map((id) => graph.getNodeById(id))
  if (nodes.some((node) => !node || !canvas.selectedItems.has(node))) return
  return nodes.filter((node): node is LGraphNode => !!node)
}

function computeHandles(canvas: LGraphCanvas, boxes: SnapBox[]): GapHandle[] {
  const along = axis.value
  const gap = evenGap(boxes, along) ?? 0
  const crossStart = Math.min(...boxes.map((b) => (along === 'x' ? b.y : b.x)))
  const crossEnd = Math.max(
    ...boxes.map((b) => (along === 'x' ? b.y + b.height : b.x + b.width))
  )
  const cross = (crossStart + crossEnd) / 2
  return boxes.slice(1).map((box, index) => {
    const [x, y] =
      along === 'x' ? [box.x - gap / 2, cross] : [cross, box.y - gap / 2]
    const { scale, offset } = canvas.ds
    const left = (x + offset[0]) * scale
    const top = (y + offset[1]) * scale
    return { index, gap: Math.round(gap), left, top }
  })
}

function clearHandles() {
  distributeSession.value = null
  handles.value = []
  handlesKey = ''
}

watch(
  () => canvasStore.canvas,
  (canvas, _, onCleanup) => {
    if (!canvas) return
    onCleanup(
      onCanvasFrame(canvas, 'present', () => {
        if (!distributeSession.value) {
          if (handles.value.length) clearHandles()
          return
        }
        axis.value = distributeSession.value.axis
        const nodes = sessionNodes(canvas)
        const boxes = nodes?.map(nodeBox)
        if (!boxes || evenGap(boxes, axis.value) === undefined) {
          clearHandles()
          return
        }
        const next = computeHandles(canvas, boxes)
        const key = JSON.stringify(next)
        if (key === handlesKey) return
        handlesKey = key
        handles.value = next
      })
    )
  },
  { immediate: true }
)

function applyBoxes(
  canvas: LGraphCanvas,
  rootGraphId: string,
  nodes: LGraphNode[],
  boxes: SnapBox[]
) {
  mutations.batchMoveNodes(
    rootGraphId,
    nodes.map((node, i) => ({
      nodeId: node.id,
      position: { x: boxes[i].x, y: boxes[i].y + boxes[i].head }
    }))
  )
  canvas.setDirty(true, true)
}

let endActiveDrag: (() => void) | undefined
onBeforeUnmount(() => endActiveDrag?.())

function pointerAlong(event: PointerEvent) {
  return axis.value === 'x' ? event.clientX : event.clientY
}

function startDrag(event: PointerEvent, index: number) {
  const { canvas, rootGraphId } = canvasStore
  const nodes = canvas && sessionNodes(canvas)
  if (event.button !== 0 || !canvas || !nodes || !rootGraphId) return
  event.preventDefault()
  event.stopPropagation()

  const target = event.currentTarget
  if (target instanceof HTMLElement) target.setPointerCapture(event.pointerId)

  const { graph } = canvas
  const workflow = workflowStore.activeWorkflow
  const isStillEditable = () =>
    !canvas.read_only &&
    canvas.graph === graph &&
    canvasStore.rootGraphId === rootGraphId &&
    workflowStore.activeWorkflow === workflow

  const startBoxes = nodes.map(nodeBox)
  const startPointer = pointerAlong(event)
  const scale = canvas.ds.scale || 1
  const { pointerId } = event
  let moved = false

  const onMove = (moveEvent: PointerEvent) => {
    if (moveEvent.pointerId !== pointerId) return
    if (!isStillEditable()) return endDrag()
    const travel = (pointerAlong(moveEvent) - startPointer) / scale
    const gap = gapAfterTravel(startBoxes, axis.value, index, travel)
    applyBoxes(
      canvas,
      rootGraphId,
      nodes,
      setGap(startBoxes, axis.value, index, gap)
    )
    moved = true
  }
  const endDrag = () => {
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onEnd)
    window.removeEventListener('pointercancel', onEnd)
    endActiveDrag = undefined
    if (moved && workflowStore.activeWorkflow === workflow)
      workflow?.changeTracker.captureCanvasState()
  }
  const onEnd = (endEvent: PointerEvent) => {
    if (endEvent.pointerId === pointerId) endDrag()
  }
  endActiveDrag?.()
  endActiveDrag = endDrag
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onEnd)
  window.addEventListener('pointercancel', onEnd)
}

const NUDGE_KEYS: Record<string, number> = {
  ArrowRight: 1,
  ArrowUp: 1,
  ArrowLeft: -1,
  ArrowDown: -1
}

function nudge(event: KeyboardEvent, index: number) {
  const direction = NUDGE_KEYS[event.key]
  const { canvas, rootGraphId } = canvasStore
  const nodes = canvas && sessionNodes(canvas)
  if (!direction || !canvas || !nodes || !rootGraphId) return
  event.preventDefault()
  event.stopPropagation()

  const boxes = nodes.map(nodeBox)
  const gap =
    (evenGap(boxes, axis.value) ?? 0) + direction * (event.shiftKey ? 10 : 1)
  applyBoxes(canvas, rootGraphId, nodes, setGap(boxes, axis.value, index, gap))
  workflowStore.activeWorkflow?.changeTracker.captureCanvasState()
}
</script>
