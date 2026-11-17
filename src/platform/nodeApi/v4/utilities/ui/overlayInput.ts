import type { LGraphCanvas } from '@/lib/litegraph/src/LGraphCanvas'
import { callListener } from '@/platform/nodeApi/shared/listeners'
import type {
  GraphOverlayHitRegion,
  GraphOverlayKeyEvent,
  GraphOverlayPointerEvent
} from '@/platform/nodeApi/v4/types'

import { hitsRegion } from './overlayRegions'

type PointerCallback = (event: GraphOverlayPointerEvent) => unknown

/** The callbacks of an overlay that take input. */
export interface OverlayInputCallbacks {
  readonly onPointerDown?: PointerCallback
  readonly onPointerMove?: PointerCallback
  readonly onPointerUp?: PointerCallback
  readonly onPointerCancel?: PointerCallback
  readonly onKeyDown?: (event: GraphOverlayKeyEvent) => unknown
}

/** What an overlay's handle changes and its input reads. */
export interface OverlayState {
  visible: boolean
  interactive: boolean
  regions: readonly GraphOverlayHitRegion[] | undefined
}

const FOLLOWED = ['pointermove', 'pointerup', 'pointercancel'] as const

/**
 * Gives an overlay each press in its regions, with that pointer's later events,
 * and its keys while it has focus, until the returned function is called.
 */
export function routeOverlayInput(
  element: HTMLElement,
  view: HTMLElement,
  canvas: LGraphCanvas,
  member: string,
  callbacks: OverlayInputCallbacks,
  state: OverlayState
): () => void {
  const pointers = pointerRouter(element, canvas, member, callbacks, state)
  const key = (event: KeyboardEvent) => {
    const { onKeyDown } = callbacks
    if (!state.visible || !state.interactive || !onKeyDown) return
    event.stopPropagation()
    callListener(member, () => onKeyDown(keyEventOf(event)))
  }
  view.addEventListener('pointerdown', pointers.take, true)
  element.addEventListener('keydown', key)
  return () => {
    view.removeEventListener('pointerdown', pointers.take, true)
    element.removeEventListener('keydown', key)
    pointers.release()
  }
}

function pointerRouter(
  element: HTMLElement,
  canvas: LGraphCanvas,
  member: string,
  callbacks: OverlayInputCallbacks,
  state: OverlayState
) {
  const owned = new Set<number>()
  const deliver = (
    callback: PointerCallback | undefined,
    event: PointerEvent
  ) =>
    callback &&
    callListener(member, () => callback(pointerEventOf(canvas, event)))
  const following = (listen: boolean) => {
    for (const type of FOLLOWED) {
      if (listen) window.addEventListener(type, follow, true)
      else window.removeEventListener(type, follow, true)
    }
  }

  function follow(event: PointerEvent) {
    if (!owned.has(event.pointerId)) return
    event.stopPropagation()
    if (event.type !== 'pointermove') owned.delete(event.pointerId)
    if (owned.size === 0) following(false)
    deliver(pointerCallback(callbacks, event.type), event)
  }

  return {
    take(event: PointerEvent) {
      if (!state.visible || !state.interactive) return
      if (!takesPress(element, canvas, state.regions, event)) return
      event.preventDefault()
      event.stopPropagation()
      if (owned.size === 0) following(true)
      owned.add(event.pointerId)
      element.focus({ preventScroll: true })
      deliver(callbacks.onPointerDown, event)
    },
    release() {
      owned.clear()
      following(false)
    }
  }
}

function takesPress(
  element: HTMLElement,
  canvas: LGraphCanvas,
  regions: OverlayState['regions'],
  event: PointerEvent
): boolean {
  const { target } = event
  const above =
    target instanceof Node &&
    (element.compareDocumentPosition(target) &
      Node.DOCUMENT_POSITION_FOLLOWING) !==
      0
  return !above && hitsRegion(regions, viewportPoint(canvas, event))
}

function pointerCallback(
  callbacks: OverlayInputCallbacks,
  type: string
): PointerCallback | undefined {
  if (type === 'pointermove') return callbacks.onPointerMove
  return type === 'pointerup'
    ? callbacks.onPointerUp
    : callbacks.onPointerCancel
}

function viewportPoint(canvas: LGraphCanvas, event: PointerEvent) {
  const bounds = canvas.canvas.getBoundingClientRect()
  return Object.freeze({
    x: event.clientX - bounds.left,
    y: event.clientY - bounds.top
  })
}

function pointerEventOf(
  canvas: LGraphCanvas,
  event: PointerEvent
): GraphOverlayPointerEvent {
  const [x, y] = canvas.convertEventToCanvasOffset(event)
  return Object.freeze({
    pointerId: event.pointerId,
    pointerType: event.pointerType,
    button: event.button,
    viewport: viewportPoint(canvas, event),
    graph: Object.freeze({ x, y })
  })
}

function keyEventOf(event: KeyboardEvent): GraphOverlayKeyEvent {
  return Object.freeze({
    key: event.key,
    repeat: event.repeat,
    ctrlKey: event.ctrlKey,
    metaKey: event.metaKey,
    shiftKey: event.shiftKey
  })
}
