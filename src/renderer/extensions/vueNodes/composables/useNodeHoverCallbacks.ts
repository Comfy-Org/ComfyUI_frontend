import { useEventListener } from '@vueuse/core'
import { toValue } from 'vue'
import type { MaybeRefOrGetter } from 'vue'

import type { LGraphCanvas } from '@/lib/litegraph/src/LGraphCanvas'
import type { CanvasPointerEvent } from '@comfyorg/graph-model/events'
import type { NodeId } from '@comfyorg/graph-model/nodeId'
import type { PointTuple } from '@comfyorg/shared-frontend-utils/geometry'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'

type HoverCallback = 'onMouseEnter' | 'onMouseMove' | 'onMouseLeave'

function toCanvasPointerEvent(
  canvas: LGraphCanvas,
  event: PointerEvent
): CanvasPointerEvent {
  canvas.adjustMouseEvent(event)
  return event
}

/** Calls a node's classic `onMouseEnter`, `onMouseMove`, and `onMouseLeave` callbacks for pointer movement over its Vue node element. */
export function useNodeHoverCallbacks(
  nodeId: MaybeRefOrGetter<NodeId>,
  target: MaybeRefOrGetter<HTMLElement | null>
) {
  const canvasStore = useCanvasStore()

  function resolve(event: PointerEvent, callback: HoverCallback) {
    const canvas = canvasStore.canvas
    const node = canvas?.graph?.getNodeById(toValue(nodeId))
    if (!canvas || !node?.[callback]) return undefined
    canvas.setDirty(true)
    const canvasEvent = toCanvasPointerEvent(canvas, event)
    const pos: PointTuple = [
      canvasEvent.canvasX - node.pos[0],
      canvasEvent.canvasY - node.pos[1]
    ]
    return { node, canvas, event: canvasEvent, pos }
  }

  useEventListener(target, 'pointerenter', (event: PointerEvent) => {
    const hit = resolve(event, 'onMouseEnter')
    hit?.node.onMouseEnter?.(hit.event)
  })

  useEventListener(
    target,
    'pointermove',
    (event: PointerEvent) => {
      const hit = resolve(event, 'onMouseMove')
      hit?.node.onMouseMove?.(hit.event, hit.pos, hit.canvas)
    },
    { capture: true }
  )

  useEventListener(target, 'pointerleave', (event: PointerEvent) => {
    const hit = resolve(event, 'onMouseLeave')
    hit?.node.onMouseLeave?.(hit.event)
  })
}
