import { nextTick, onScopeDispose, toValue } from 'vue'
import type { MaybeRefOrGetter } from 'vue'

import {
  isMiddleButtonEvent,
  isMiddleButtonHeld,
  isMiddlePointerInput
} from '@/base/pointerUtils'
import { CanvasPointer } from '@/lib/litegraph/src/CanvasPointer'
import type {
  GestureEffect,
  GestureEvent,
  GestureState
} from '@/lib/litegraph/src/canvas/reduceGesture'
import {
  idleGesture,
  reduceGesture
} from '@/lib/litegraph/src/canvas/reduceGesture'
import { LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useCanvasInteractions } from '@/renderer/core/canvas/useCanvasInteractions'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { useNodeZIndex } from '@/renderer/extensions/vueNodes/composables/useNodeZIndex'
import { useNodeDrag } from '@/renderer/extensions/vueNodes/layout/useNodeDrag'
import type { NodeId } from '@/types/nodeId'
import type { NodeState } from '@/types/nodeState'
import { isLGraphNode } from '@/utils/litegraphUtil'

function canDrag(press: Press) {
  return !press.pinned
}

interface Press {
  nodeId: NodeId
  event: PointerEvent
  pinned: boolean
  pointerId: number
  captureTarget?: Element
}

export function useNodePointerInteractions(
  nodeStateRef: MaybeRefOrGetter<NodeState>
) {
  const canvasStore = useCanvasStore()
  const { startDrag, endDrag, handleDrag } = useNodeDrag()
  const { forwardEventToCanvas, shouldHandleNodePointerEvents } =
    useCanvasInteractions()
  const { bringNodeToFront } = useNodeZIndex()

  let gesture: GestureState = idleGesture
  let press: Press | null = null

  const gesturePolicy = () => ({
    clickDrift: CanvasPointer.maxClickDrift,
    doubleClickTime: CanvasPointer.doubleClickTime
  })

  function dispatch(gestureEvent: GestureEvent, event: PointerEvent) {
    const result = reduceGesture(gesture, gestureEvent, gesturePolicy())
    gesture = result.state
    try {
      for (const effect of result.effects) runEffect(effect, event)
    } finally {
      if (gesture.phase === 'idle') clearPress()
    }
  }

  function clearPress() {
    if (press?.captureTarget?.hasPointerCapture(press.pointerId)) {
      press.captureTarget.releasePointerCapture(press.pointerId)
    }
    press = null
  }

  function cancel(event: PointerEvent) {
    try {
      dispatch({ type: 'cancel' }, event)
    } finally {
      layoutStore.isDraggingVueNodes.value = false
    }
  }

  function runEffect(effect: GestureEffect, event: PointerEvent) {
    if (!press) return
    const { canvas } = canvasStore
    const node = canvasStore.currentGraph?.getNodeById(press.nodeId)
    switch (effect) {
      case 'click':
      case 'doubleClick':
        if (node) canvas?.processSelect(node, press.event)
        return
      case 'startDrag':
        if (node) canvas?.processSelect(node, press.event, true)
        if (press.pinned) return
        layoutStore.isDraggingVueNodes.value = true
        startDrag(press.event, press.nodeId)
        return
      case 'movePress':
        return
      case 'moveDrag':
        if (canDrag(press)) handleDrag(event, press.nodeId)
        return
      case 'endDrag':
        try {
          if (canDrag(press)) endDrag(event, press.nodeId)
        } finally {
          layoutStore.isDraggingVueNodes.value = false
        }
        return
    }
    effect satisfies never
  }

  const forwardMiddlePointerIfNeeded = (
    event: PointerEvent,
    isMiddleInput: (event: PointerEvent) => boolean
  ) => {
    if (!isMiddleInput(event)) return false
    forwardEventToCanvas(event)
    return true
  }

  function pressedNodeId(event: PointerEvent): NodeId {
    const nodeId = toValue(nodeStateRef).id
    if (!event.altKey) return nodeId
    const node = canvasStore.currentGraph?.getNodeById(nodeId)
    const clone = node && LGraphCanvas.cloneNodes([node])?.created[0]
    if (!isLGraphNode(clone)) return nodeId
    void nextTick(() => bringNodeToFront(clone.id))
    return clone.id
  }

  function onPointerdown(event: PointerEvent) {
    if (forwardMiddlePointerIfNeeded(event, isMiddlePointerInput)) return

    if (!shouldHandleNodePointerEvents.value) {
      forwardEventToCanvas(event)
      return
    }

    if (event.button !== 0 || press) return

    const nodeId = pressedNodeId(event)
    const pinned = !!toValue(nodeStateRef).flags.pinned
    if (!pinned) bringNodeToFront(nodeId)
    const captureTarget =
      event.currentTarget instanceof Element ? event.currentTarget : undefined
    captureTarget?.setPointerCapture(event.pointerId)
    press = { nodeId, event, pinned, pointerId: event.pointerId, captureTarget }
    dispatch(
      {
        type: 'down',
        position: { x: event.clientX, y: event.clientY },
        timeStamp: event.timeStamp
      },
      event
    )
  }

  function onPointermove(event: PointerEvent) {
    if (forwardMiddlePointerIfNeeded(event, isMiddleButtonHeld)) return
    if (!press || event.pointerId !== press.pointerId) return
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
      cancel(event)
      return
    }
    if (!press || event.pointerId !== press.pointerId || event.button !== 0)
      return
    dispatch(
      { type: 'up', position: { x: event.clientX, y: event.clientY } },
      event
    )
  }

  function onPointercancel(event: PointerEvent) {
    if (!press || event.pointerId !== press.pointerId) return
    cancel(event)
  }

  function onContextmenu(event: MouseEvent) {
    if (gesture.phase !== 'dragging' || !press) return
    event.preventDefault()
    cancel(press.event)
  }

  onScopeDispose(() => {
    layoutStore.isDraggingVueNodes.value = false
    clearPress()
  })

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
