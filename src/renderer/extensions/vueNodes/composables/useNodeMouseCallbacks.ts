import { useEventListener } from '@vueuse/core'
import { toValue } from 'vue'
import type { MaybeRefOrGetter } from 'vue'

import type { LGraphCanvas } from '@/lib/litegraph/src/LGraphCanvas'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { CanvasMouseEvent } from '@comfyorg/graph-model/events'
import type { NodeId } from '@comfyorg/graph-model/nodeId'
import type { PointTuple as Point } from '@comfyorg/shared-frontend-utils/geometry'
import { reportError } from '@comfyorg/telemetry/reportError'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { cancelNodePress } from '@/renderer/extensions/vueNodes/composables/useNodePointerInteractions'

interface DeliveredEvents {
  onDblClick: MouseEvent
  onMouseDown: PointerEvent
  onMouseEnter: PointerEvent
  onMouseLeave: PointerEvent
  onMouseMove: PointerEvent
}

type MouseCallback = keyof DeliveredEvents

type CanvasEventFor<C extends MouseCallback> = DeliveredEvents[C] &
  CanvasMouseEvent

const invokers: {
  [C in MouseCallback]: (
    node: LGraphNode,
    event: CanvasEventFor<C>,
    pos: Point,
    canvas: LGraphCanvas
  ) => boolean | void
} = {
  onMouseEnter: (node, event) => node.onMouseEnter?.(event),
  onMouseMove: (node, event, pos, canvas) =>
    node.onMouseMove?.(event, pos, canvas),
  onMouseLeave: (node, event) => node.onMouseLeave?.(event),
  onMouseDown: (node, event, pos, canvas) =>
    node.onMouseDown?.(event, pos, canvas),
  onDblClick: (node, event, pos, canvas) =>
    node.onDblClick?.(event, pos, canvas)
}

const OWN_DOUBLE_CLICK_TARGETS = '.lg-slot, .lg-node-widget'

const reportedFailures = new Set<string>()

function toCanvasEvent<E extends MouseEvent>(
  canvas: LGraphCanvas,
  event: E
): E & CanvasMouseEvent {
  canvas.adjustMouseEvent(event)
  return event
}

function holdCanvasPointerUntilRelease(
  canvas: LGraphCanvas,
  pointerId: number
) {
  if (canvas.pointer.isDown) return
  canvas.pointer.isDown = true
  const release = (event: PointerEvent) => {
    if (event.pointerId !== pointerId) return
    canvas.pointer.isDown = false
    window.removeEventListener('pointerup', release, true)
    window.removeEventListener('pointercancel', release, true)
  }
  window.addEventListener('pointerup', release, true)
  window.addEventListener('pointercancel', release, true)
}

function reportMouseCallbackFailure(
  error: unknown,
  node: LGraphNode,
  callback: MouseCallback
) {
  const key = `${node.type}:${callback}`
  if (reportedFailures.has(key)) return
  reportedFailures.add(key)
  reportError(error, {
    surface: 'graph',
    errorType: 'failure_invoking_node_mouse_callback',
    tags: { node_type: node.type, callback }
  })
}

/** Calls a node's classic `onMouseEnter`, `onMouseMove`, `onMouseLeave`, `onMouseDown` and `onDblClick` callbacks for pointer input on its Vue node element, as the canvas renderer does. */
export function useNodeMouseCallbacks(
  nodeId: MaybeRefOrGetter<NodeId>,
  target: MaybeRefOrGetter<HTMLElement | null>
) {
  const canvasStore = useCanvasStore()
  let hoveredNode: LGraphNode | undefined

  function deliver<C extends MouseCallback>(
    node: LGraphNode | undefined,
    callback: C,
    domEvent: DeliveredEvents[C]
  ): boolean {
    const canvas = canvasStore.canvas
    if (!canvas || !node?.[callback]) return false
    canvas.setDirty(true)
    const event = toCanvasEvent(canvas, domEvent)
    try {
      const pos: Point = [
        event.canvasX - node.pos[0],
        event.canvasY - node.pos[1]
      ]
      return invokers[callback](node, event, pos, canvas) === true
    } catch (error) {
      reportMouseCallbackFailure(error, node, callback)
      return false
    }
  }

  useEventListener(target, 'pointerenter', (event: PointerEvent) => {
    hoveredNode =
      canvasStore.canvas?.graph?.getNodeById(toValue(nodeId)) ?? undefined
    deliver(hoveredNode, 'onMouseEnter', event)
  })

  useEventListener(
    target,
    'pointermove',
    (event: PointerEvent) => deliver(hoveredNode, 'onMouseMove', event),
    { capture: true }
  )

  useEventListener(target, 'pointerdown', (event: PointerEvent) => {
    const canvas = canvasStore.canvas
    const node = canvas?.graph?.getNodeById(toValue(nodeId))
    if (!canvas || canvasStore.isReadOnly || canvas.selectOnly) return
    if (event.button !== 0 || !node?.onMouseDown) return
    holdCanvasPointerUntilRelease(canvas, event.pointerId)
    if (deliver(node, 'onMouseDown', event)) cancelNodePress(event.pointerId)
  })

  useEventListener(target, 'dblclick', (event: MouseEvent) => {
    const canvas = canvasStore.canvas
    if (!canvas || canvasStore.isReadOnly || canvas.selectOnly) return
    if (
      event.target instanceof Element &&
      event.target.closest(OWN_DOUBLE_CLICK_TARGETS)
    )
      return
    const node = canvas.graph?.getNodeById(toValue(nodeId)) ?? undefined
    if (!(canvas.allow_interaction || node?.flags.allow_interaction)) return
    deliver(node, 'onDblClick', event)
  })

  useEventListener(target, 'pointerleave', (event: PointerEvent) => {
    const node = hoveredNode
    hoveredNode = undefined
    deliver(node, 'onMouseLeave', event)
  })
}
