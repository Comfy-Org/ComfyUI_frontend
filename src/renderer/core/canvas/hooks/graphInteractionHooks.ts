/**
 * Typed event bus for graph interaction hot paths. Listeners run on every
 * pointermove during a drag, so they must be cheap and must not mutate the
 * event payload. `on(...)` returns an unsubscribe function; call it from
 * `onScopeDispose` (or equivalent) to avoid leaks.
 */
import type { NodeId, Point } from '@/renderer/core/layout/types'

export interface NodeDragMoveEvent {
  nodeId: NodeId
  /** Pointer position in canvas space (post pan/zoom transform). */
  canvasPos: Point
  /** Source pointer event. Read-only. */
  pointerEvent: PointerEvent
  selectionSize: number
}

export interface NodeDragEndEvent {
  nodeId: NodeId
  canvasPos: Point
  pointerEvent: PointerEvent
  selectionSize: number
}

interface GraphInteractionEventMap {
  nodeDragMove: NodeDragMoveEvent
  nodeDragEnd: NodeDragEndEvent
}

type Listener<E> = (event: E) => void
type Unsubscribe = () => void

function createBus() {
  const listeners: {
    [K in keyof GraphInteractionEventMap]: Set<
      Listener<GraphInteractionEventMap[K]>
    >
  } = {
    nodeDragMove: new Set(),
    nodeDragEnd: new Set()
  }

  function on<K extends keyof GraphInteractionEventMap>(
    type: K,
    listener: Listener<GraphInteractionEventMap[K]>
  ): Unsubscribe {
    listeners[type].add(listener)
    return () => {
      listeners[type].delete(listener)
    }
  }

  function emit<K extends keyof GraphInteractionEventMap>(
    type: K,
    event: GraphInteractionEventMap[K]
  ): void {
    for (const listener of listeners[type]) {
      try {
        listener(event)
      } catch (error) {
        console.error(
          `graphInteractionHooks: listener for ${type} threw`,
          error
        )
      }
    }
  }

  function clear(): void {
    listeners.nodeDragMove.clear()
    listeners.nodeDragEnd.clear()
  }

  return { on, emit, clear }
}

export const graphInteractionHooks = createBus()
