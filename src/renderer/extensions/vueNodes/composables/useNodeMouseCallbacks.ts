import { useEventListener } from '@vueuse/core'
import { toValue } from 'vue'
import type { MaybeRefOrGetter } from 'vue'

import type { LGraphCanvas } from '@/lib/litegraph/src/LGraphCanvas'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { CanvasPointerEvent } from '@comfyorg/graph-model/events'
import type { NodeId } from '@comfyorg/graph-model/nodeId'
import type { PointTuple as Point } from '@comfyorg/shared-frontend-utils/geometry'
import { reportError } from '@comfyorg/telemetry/reportError'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'

type MouseCallback =
  | 'onMouseEnter'
  | 'onMouseMove'
  | 'onMouseLeave'
  | 'onMouseDown'

const reportedFailures = new Set<string>()

function toCanvasPointerEvent(
  canvas: LGraphCanvas,
  event: PointerEvent
): CanvasPointerEvent {
  canvas.adjustMouseEvent(event)
  return event
}

function holdCanvasPointerUntilRelease(canvas: LGraphCanvas) {
  if (canvas.pointer.isDown) return
  canvas.pointer.isDown = true
  const release = () => {
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

/** Calls a node's classic `onMouseEnter`, `onMouseMove`, `onMouseLeave`, and `onMouseDown` callbacks for pointer input on its Vue node element. */
export function useNodeMouseCallbacks(
  nodeId: MaybeRefOrGetter<NodeId>,
  target: MaybeRefOrGetter<HTMLElement | null>
) {
  const canvasStore = useCanvasStore()
  let hoveredNode: LGraphNode | undefined

  function deliver(
    node: LGraphNode | undefined,
    callback: MouseCallback,
    pointerEvent: PointerEvent
  ) {
    const canvas = canvasStore.canvas
    if (!canvas || !node?.[callback]) return
    canvas.setDirty(true)
    const event = toCanvasPointerEvent(canvas, pointerEvent)
    try {
      const pos: Point = [
        event.canvasX - node.pos[0],
        event.canvasY - node.pos[1]
      ]
      if (callback === 'onMouseMove') {
        node.onMouseMove?.(event, pos, canvas)
      } else if (callback === 'onMouseDown') {
        node.onMouseDown?.(event, pos, canvas)
      } else {
        node[callback]?.(event)
      }
    } catch (error) {
      reportMouseCallbackFailure(error, node, callback)
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
    if (!canvas || canvasStore.isReadOnly || event.button !== 0) return
    if (!node?.onMouseDown) return
    holdCanvasPointerUntilRelease(canvas)
    deliver(node, 'onMouseDown', event)
  })

  useEventListener(target, 'pointerleave', (event: PointerEvent) => {
    const node = hoveredNode
    hoveredNode = undefined
    deliver(node, 'onMouseLeave', event)
  })
}
