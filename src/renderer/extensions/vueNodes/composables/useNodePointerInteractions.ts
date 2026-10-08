import { nextTick, onScopeDispose, toValue } from 'vue'
import type { MaybeRefOrGetter } from 'vue'

import {
  isMiddleButtonEvent,
  isMiddleButtonHeld,
  isMiddlePointerInput
} from '@/base/pointerUtils'
import { CanvasPointer } from '@/lib/litegraph/src/CanvasPointer'
import { captureGesture } from '@/lib/litegraph/src/canvas/captureGesture'
import type {
  GestureEffect,
  GestureEvent,
  GestureState
} from '@/lib/litegraph/src/canvas/reduceGesture'
import {
  idleGesture,
  reduceGesture
} from '@/lib/litegraph/src/canvas/reduceGesture'
import { LGraphCanvas, LiteGraph } from '@/lib/litegraph/src/litegraph'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useCanvasInteractions } from '@/renderer/core/canvas/useCanvasInteractions'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { useNodeZIndex } from '@/renderer/extensions/vueNodes/composables/useNodeZIndex'
import { useNodeDrag } from '@/renderer/extensions/vueNodes/layout/useNodeDrag'
import type { NodeId } from '@/types/nodeId'
import type { NodeState } from '@/types/nodeState'
import { isLGraphNode } from '@/utils/litegraphUtil'

interface Press {
  nodeId: NodeId
  event: PointerEvent
  movingNode: boolean
  releaseCapture?: () => void
}

export function useNodePointerInteractions(
  nodeStateRef: MaybeRefOrGetter<NodeState>
) {
  const canvasStore = useCanvasStore()
  const { startDrag, endDrag, handleDrag, cancelDrag } = useNodeDrag()
  const { forwardEventToCanvas, shouldHandleNodePointerEvents } =
    useCanvasInteractions()
  const { bringNodeToFront } = useNodeZIndex()

  let gesture: GestureState = idleGesture
  let press: Press | null = null

  function canDrag() {
    return !toValue(nodeStateRef).flags.pinned
  }

  function dispatch(gestureEvent: GestureEvent, event: PointerEvent) {
    const result = reduceGesture(gesture, gestureEvent)
    gesture = result.state
    try {
      for (const effect of result.effects) runEffect(effect, event)
    } finally {
      if (gesture.phase === 'idle') clearPress()
    }
  }

  function clearPress() {
    const completedPress = press
    press = null
    completedPress?.releaseCapture?.()
    if (completedPress?.movingNode) layoutStore.isDraggingVueNodes.value = false
  }

  function cancelPress() {
    if (press) dispatch({ type: 'cancel' }, press.event)
  }

  function selectNode(activePress: Press, sticky = false) {
    const { canvas } = canvasStore
    const node = canvasStore.currentGraph?.getNodeById(activePress.nodeId)
    if (node) canvas?.processSelect(node, activePress.event, sticky)
  }

  function startNodeDrag(activePress: Press, event: PointerEvent) {
    selectNode(activePress, true)
    if (!canDrag()) return
    layoutStore.isDraggingVueNodes.value = true
    activePress.movingNode = true
    startDrag(activePress.event, activePress.nodeId, event.shiftKey)
  }

  const effectHandlers: Record<
    GestureEffect,
    (activePress: Press, event: PointerEvent) => void
  > = {
    click: (activePress) => selectNode(activePress),
    doubleClick: (activePress) => selectNode(activePress),
    movePress: () => {},
    startDrag: startNodeDrag,
    moveDrag: (activePress, event) => {
      if (activePress.movingNode && canDrag())
        handleDrag(event, activePress.nodeId)
    },
    endDrag: (activePress, event) => {
      if (activePress.movingNode)
        endDrag(event, canDrag() ? activePress.nodeId : undefined)
    },
    cancelDrag: (activePress) => {
      if (activePress.movingNode) cancelDrag()
    }
  }

  function runEffect(effect: GestureEffect, event: PointerEvent) {
    if (press) effectHandlers[effect](press, event)
  }

  const forwardMiddlePointerIfNeeded = (
    event: PointerEvent,
    isMiddleInput: (event: PointerEvent) => boolean
  ) => {
    if (!isMiddleInput(event)) return false
    forwardEventToCanvas(event)
    return true
  }

  function shouldCloneOnPress(event: PointerEvent) {
    return (
      LiteGraph.alt_drag_do_clone_nodes &&
      event.altKey &&
      !event.ctrlKey &&
      !!canvasStore.canvas?.allow_interaction
    )
  }

  function cloneNode(nodeId: NodeId): NodeId | undefined {
    const node = canvasStore.currentGraph?.getNodeById(nodeId)
    const clone = node && LGraphCanvas.cloneNodes([node])?.created[0]
    return isLGraphNode(clone) ? clone.id : undefined
  }

  function pressNode(event: PointerEvent): NodeId {
    const nodeId = toValue(nodeStateRef).id
    const cloneId = shouldCloneOnPress(event) ? cloneNode(nodeId) : undefined
    if (cloneId === undefined) {
      if (canDrag()) bringNodeToFront(nodeId)
      return nodeId
    }
    void nextTick(() => bringNodeToFront(cloneId))
    return cloneId
  }

  function onPointerdown(event: PointerEvent) {
    if (forwardMiddlePointerIfNeeded(event, isMiddlePointerInput)) return

    if (!shouldHandleNodePointerEvents.value) {
      forwardEventToCanvas(event)
      return
    }

    if (event.button !== 0) return
    if (press) {
      if (press.event.pointerId !== event.pointerId) return
      cancelPress()
    }

    const nodeId = pressNode(event)
    const captureTarget =
      event.target instanceof Element ? event.target : undefined
    press = {
      nodeId,
      event,
      movingNode: false,
      releaseCapture:
        canDrag() && captureTarget
          ? captureGesture(captureTarget, event.pointerId, cancelPress)
          : undefined
    }
    dispatch(
      {
        type: 'down',
        position: { x: event.clientX, y: event.clientY },
        timeStamp: event.timeStamp,
        policy: CanvasPointer.gesturePolicy()
      },
      event
    )
  }

  function dispatchUp(event: PointerEvent) {
    dispatch(
      {
        type: 'up',
        position: { x: event.clientX, y: event.clientY },
        acceptsDoubleClick: false
      },
      event
    )
  }

  function isPressPointer(event: PointerEvent) {
    return press?.event.pointerId === event.pointerId
  }

  function onPointermove(event: PointerEvent) {
    if (forwardMiddlePointerIfNeeded(event, isMiddleButtonHeld)) return
    if (!isPressPointer(event)) return
    if (!(event.buttons & 1)) {
      dispatchUp(event)
      return
    }
    dispatch(
      {
        type: 'move',
        position: { x: event.clientX, y: event.clientY }
      },
      event
    )
  }

  function onPointerup(event: PointerEvent) {
    if (forwardMiddlePointerIfNeeded(event, isMiddleButtonEvent)) return
    if (!shouldHandleNodePointerEvents.value) {
      forwardEventToCanvas(event)
      if (!isPressPointer(event)) return
      if (press?.movingNode) dispatchUp(event)
      else cancelPress()
      return
    }
    if (!isPressPointer(event) || event.button !== 0) return
    dispatchUp(event)
  }

  function onPointercancel(event: PointerEvent) {
    if (isPressPointer(event)) cancelPress()
  }

  function onContextmenu(event: MouseEvent) {
    if (!press?.movingNode) return
    event.preventDefault()
    event.stopImmediatePropagation()
    cancelPress()
  }

  onScopeDispose(cancelPress)

  const pointerHandlers = {
    onPointerdown,
    onPointermove,
    onPointerup,
    onPointercancel,
    onContextmenu
  } as const

  return {
    pointerHandlers
  }
}
