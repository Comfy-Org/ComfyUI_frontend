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
  evenGap,
  laneBox,
  placeBox
} from '@comfyorg/graph-model/arrange/arrange'
import type {
  Axis,
  Placement,
  VisualBox
} from '@comfyorg/graph-model/arrange/arrange'
import type { NodeId } from '@comfyorg/graph-model/nodeId'
import { nodeBox, placementsOf } from '@/lib/litegraph/src/utils/arrange'
import {
  gapAfterTravel,
  gapMidpoints,
  setGap
} from '@comfyorg/graph-model/arrange/distributeGaps'
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
const { forwardEventToCanvas } = useCanvasInteractions()

const handles = shallowRef<GapHandle[]>([])
const axis = computed(() => distributeSession.value?.axis)

function sessionLanes(canvas: LGraphCanvas): LGraphNode[][] | undefined {
  const session = distributeSession.value
  const { graph } = canvas
  if (!session || !graph || session.graph !== graph || canvas.read_only) return
  if (canvas.selectedItems.size !== session.selectionSize) return
  const lanes = session.lanes.map((lane) =>
    lane.map((id) => graph.getNodeById(id))
  )
  const nodes = lanes.flat()
  if (nodes.some((node) => !node || !canvas.selectedItems.has(node))) return
  return lanes.map((lane) => lane.filter((node): node is LGraphNode => !!node))
}

interface LanePlacement {
  members: Map<NodeId, Placement>
  box: VisualBox
}

function placeLanes(lanes: LGraphNode[][], along: Axis): LanePlacement[] {
  return lanes.map((lane) => {
    const members = placementsOf(lane)
    return {
      members,
      box: laneBox(
        [...members.values()].map(({ box }) => box),
        along
      )
    }
  })
}

function computeHandles(
  canvas: LGraphCanvas,
  boxes: VisualBox[],
  along: Axis,
  gap: number
): GapHandle[] {
  return gapMidpoints(boxes, along, gap).map(({ x, y }, index) => {
    const [left, top] = canvas.ds.convertOffsetToCanvas([x, y])
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
        const boxes = sessionLanes(canvas)?.map((lane) =>
          laneBox(lane.map(nodeBox), along)
        )
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

function applyLaneBoxes(
  canvas: LGraphCanvas,
  rootGraphId: string,
  lanes: LanePlacement[],
  along: Axis,
  boxes: VisualBox[]
) {
  mutations.batchMoveNodes(
    rootGraphId,
    lanes.flatMap(({ members, box }, i) => {
      const shift = boxes[i][along] - box[along]
      return [...members].map(([nodeId, placement]) => ({
        nodeId,
        position: placeBox(placement, {
          ...placement.box,
          [along]: placement.box[along] + shift
        }).position
      }))
    })
  )
  canvas.setDirty(true, true)
}

function editableLanes() {
  const { canvas, rootGraphId } = canvasStore
  const nodeLanes = canvas && sessionLanes(canvas)
  const along = axis.value
  if (!canvas || !nodeLanes || !rootGraphId || !along) return
  return { canvas, rootGraphId, along, lanes: placeLanes(nodeLanes, along) }
}

let endActiveDrag: (() => void) | undefined
onBeforeUnmount(() => endActiveDrag?.())

function startDrag(event: PointerEvent, index: number) {
  if (event.button !== 0) return forwardEventToCanvas(event)
  const editable = editableLanes()
  if (!editable) return
  const { canvas, rootGraphId, along, lanes } = editable
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
    !!sessionLanes(canvas)

  const startBoxes = lanes.map(({ box }) => box)
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
      applyLaneBoxes(
        canvas,
        rootGraphId,
        lanes,
        along,
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
  const editable = !endActiveDrag && editableLanes()
  if (!editable) return
  const { canvas, rootGraphId, along, lanes } = editable
  event.preventDefault()
  event.stopPropagation()

  const boxes = lanes.map(({ box }) => box)
  const gap =
    (evenGap(boxes, along) ?? 0) + direction * (event.shiftKey ? 10 : 1)
  applyLaneBoxes(
    canvas,
    rootGraphId,
    lanes,
    along,
    setGap(boxes, along, index, gap)
  )
  workflowStore.activeWorkflow?.changeTracker.captureCanvasState()
}
</script>
