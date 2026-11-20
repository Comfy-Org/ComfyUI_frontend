<template>
  <div
    v-if="handles.length && axis"
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
      aria-valuemin="0"
      :class="
        cn(
          'group pointer-events-auto absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center outline-none',
          axis === 'x' ? 'h-8 w-3 cursor-ew-resize' : 'h-3 w-8 cursor-ns-resize'
        )
      "
      :style="{ left: `${handle.left}px`, top: `${handle.top}px` }"
      @pointerdown="startDrag($event, handle.index)"
      @wheel="forwardEventToCanvas"
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
            'absolute text-2xs whitespace-nowrap text-primary tabular-nums',
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
import { useEventListener } from '@vueuse/core'
import { computed, onBeforeUnmount, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { onCanvasFrame } from '@/lib/litegraph/src/canvas/canvasFrame'
import type { LGraphCanvas, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useCanvasInteractions } from '@/renderer/core/canvas/useCanvasInteractions'
import {
  snapBoxOf,
  nodePlacement,
  positionForBox
} from '@/renderer/core/canvas/smartGuides/dragSnapSession'
import type { NodePlacement } from '@/renderer/core/canvas/smartGuides/dragSnapSession'
import {
  evenGap,
  gapAfterTravel,
  setGap
} from '@/renderer/core/canvas/smartGuides/distributeGaps'
import { distributeSession } from '@/renderer/core/canvas/smartGuides/smartGuidesState'
import type {
  Axis,
  SnapBox
} from '@/renderer/core/canvas/smartGuides/snapSolver'
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
const { forwardEventToCanvas } = useCanvasInteractions()

const handles = shallowRef<GapHandle[]>([])
const axis = computed(() => distributeSession.value?.axis)

function sessionNodes(canvas: LGraphCanvas): LGraphNode[] | undefined {
  const session = distributeSession.value
  const { graph } = canvas
  if (!session || !graph || session.graph !== graph || canvas.read_only) return
  if (canvas.selectedItems.size !== session.selectionSize) return
  const nodes = session.nodeIds.map((id) => graph.getNodeById(id))
  if (nodes.some((node) => !node || !canvas.selectedItems.has(node))) return
  return nodes.filter((node): node is LGraphNode => !!node)
}

function computeHandles(
  canvas: LGraphCanvas,
  boxes: SnapBox[],
  along: Axis,
  gap: number
): GapHandle[] {
  const crossStart = Math.min(...boxes.map((b) => (along === 'x' ? b.y : b.x)))
  const crossEnd = Math.max(
    ...boxes.map((b) => (along === 'x' ? b.y + b.height : b.x + b.width))
  )
  const cross = (crossStart + crossEnd) / 2
  return boxes.slice(1).map((box, index) => {
    const [left, top] = canvas.ds.convertOffsetToCanvas(
      along === 'x' ? [box.x - gap / 2, cross] : [cross, box.y - gap / 2]
    )
    return { index, gap: Math.round(gap), left, top }
  })
}

const sameHandles = (a: GapHandle[], b: GapHandle[]) =>
  a.length === b.length &&
  a.every(
    (h, i) => h.gap === b[i].gap && h.left === b[i].left && h.top === b[i].top
  )

function clearHandles() {
  distributeSession.value = null
  handles.value = []
}

watch(
  () => canvasStore.canvas,
  (canvas, _, onCleanup) => {
    if (!canvas) return
    onCleanup(
      onCanvasFrame(canvas, 'present', () => {
        const along = axis.value
        if (!along) {
          if (handles.value.length) handles.value = []
          return
        }
        const boxes = sessionNodes(canvas)?.map(snapBoxOf)
        const gap = boxes && evenGap(boxes, along)
        if (!boxes || gap === undefined || gap < 0) {
          clearHandles()
          return
        }
        const next = computeHandles(canvas, boxes, along, gap)
        if (!sameHandles(next, handles.value)) handles.value = next
      })
    )
  },
  { immediate: true }
)

function applyBoxes(
  canvas: LGraphCanvas,
  rootGraphId: string,
  placements: NodePlacement[],
  boxes: SnapBox[]
) {
  mutations.batchMoveNodes(
    rootGraphId,
    placements.map((placement, i) => ({
      nodeId: placement.node.id,
      position: positionForBox(placement, boxes[i])
    }))
  )
  canvas.setDirty(true, true)
}

let endActiveDrag: (() => void) | undefined
onBeforeUnmount(() => endActiveDrag?.())

function startDrag(event: PointerEvent, index: number) {
  if (event.button !== 0) return forwardEventToCanvas(event)
  const { canvas, rootGraphId } = canvasStore
  const nodes = canvas && sessionNodes(canvas)
  const along = axis.value
  if (!canvas || !nodes || !rootGraphId || !along) return
  event.preventDefault()
  event.stopPropagation()

  const target = event.currentTarget
  if (target instanceof HTMLElement) {
    target.setPointerCapture(event.pointerId)
    target.focus()
  }

  const { graph } = canvas
  const workflow = workflowStore.activeWorkflow
  const session = distributeSession.value
  const isStillEditable = () =>
    distributeSession.value === session &&
    canvas.graph === graph &&
    canvasStore.rootGraphId === rootGraphId &&
    workflowStore.activeWorkflow === workflow &&
    !!sessionNodes(canvas)

  const placements = nodes.map(nodePlacement)
  const startBoxes = placements.map(({ box }) => box)
  const pointerAlong = (e: PointerEvent) =>
    along === 'x' ? e.clientX : e.clientY
  const startPointer = pointerAlong(event)
  const scale = canvas.ds.scale || 1
  const { pointerId } = event

  endActiveDrag?.()
  workflow?.changeTracker.beforeChange()

  const stopListeners = [
    useEventListener(window, 'pointermove', (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== pointerId) return
      if (!isStillEditable()) return endDrag()
      const travel = (pointerAlong(moveEvent) - startPointer) / scale
      const gap = gapAfterTravel(startBoxes, along, index, travel)
      applyBoxes(
        canvas,
        rootGraphId,
        placements,
        setGap(startBoxes, along, index, gap)
      )
    }),
    useEventListener(window, 'pointerup', (e: PointerEvent) => {
      if (e.pointerId === pointerId) endDrag()
    }),
    useEventListener(window, 'pointercancel', (e: PointerEvent) => {
      if (e.pointerId === pointerId) endDrag()
    })
  ]
  function endDrag() {
    for (const stop of stopListeners) stop()
    endActiveDrag = undefined
    workflow?.changeTracker.afterChange()
  }
  endActiveDrag = endDrag
}

const NUDGE_KEYS: Record<string, number> = {
  ArrowRight: 1,
  ArrowUp: 1,
  ArrowLeft: -1,
  ArrowDown: -1
}

function nudge(event: KeyboardEvent, index: number) {
  const direction = NUDGE_KEYS[event.key]
  if (!direction || event.ctrlKey || event.altKey || event.metaKey) return
  if (endActiveDrag) return
  const { canvas, rootGraphId } = canvasStore
  const nodes = canvas && sessionNodes(canvas)
  const along = axis.value
  if (!canvas || !nodes || !rootGraphId || !along) return
  event.preventDefault()
  event.stopPropagation()

  const placements = nodes.map(nodePlacement)
  const boxes = placements.map(({ box }) => box)
  const gap =
    (evenGap(boxes, along) ?? 0) + direction * (event.shiftKey ? 10 : 1)
  applyBoxes(canvas, rootGraphId, placements, setGap(boxes, along, index, gap))
  workflowStore.activeWorkflow?.changeTracker.captureCanvasState()
}
</script>
