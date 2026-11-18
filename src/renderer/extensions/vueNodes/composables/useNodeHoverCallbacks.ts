import { useEventListener } from '@vueuse/core'
import { toValue } from 'vue'
import type { MaybeRefOrGetter } from 'vue'

import type { LGraphCanvas } from '@/lib/litegraph/src/LGraphCanvas'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { CanvasPointerEvent } from '@comfyorg/graph-model/events'
import type { NodeId } from '@comfyorg/graph-model/nodeId'
import { reportError } from '@comfyorg/telemetry/reportError'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'

type HoverCallback = 'onMouseEnter' | 'onMouseMove' | 'onMouseLeave'

const reportedFailures = new Set<string>()

function toCanvasPointerEvent(
  canvas: LGraphCanvas,
  event: PointerEvent
): CanvasPointerEvent {
  canvas.adjustMouseEvent(event)
  return event
}

function reportHoverFailure(
  error: unknown,
  node: LGraphNode,
  callback: HoverCallback
) {
  const key = `${node.type}:${callback}`
  if (reportedFailures.has(key)) return
  reportedFailures.add(key)
  reportError(error, {
    surface: 'graph',
    errorType: 'failure_invoking_node_hover_callback',
    tags: { node_type: node.type, callback }
  })
}

/** Calls a node's classic `onMouseEnter`, `onMouseMove`, and `onMouseLeave` callbacks for pointer movement over its Vue node element. */
export function useNodeHoverCallbacks(
  nodeId: MaybeRefOrGetter<NodeId>,
  target: MaybeRefOrGetter<HTMLElement | null>
) {
  const canvasStore = useCanvasStore()
  let hoveredNode: LGraphNode | undefined

  function deliver(
    node: LGraphNode | undefined,
    callback: HoverCallback,
    pointerEvent: PointerEvent
  ) {
    const canvas = canvasStore.canvas
    if (!canvas || !node?.[callback]) return
    canvas.setDirty(true)
    const event = toCanvasPointerEvent(canvas, pointerEvent)
    try {
      if (callback === 'onMouseMove') {
        node.onMouseMove?.(
          event,
          [event.canvasX - node.pos[0], event.canvasY - node.pos[1]],
          canvas
        )
      } else {
        node[callback]?.(event)
      }
    } catch (error) {
      reportHoverFailure(error, node, callback)
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

  useEventListener(target, 'pointerleave', (event: PointerEvent) => {
    const node = hoveredNode
    hoveredNode = undefined
    deliver(node, 'onMouseLeave', event)
  })
}
