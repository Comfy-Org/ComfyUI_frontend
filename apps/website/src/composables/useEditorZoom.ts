import { useEventListener } from '@vueuse/core'
import type { InjectionKey, ShallowRef } from 'vue'
import { computed, shallowRef } from 'vue'

import type { ZoomView } from '@/components/workshop/app-editor/zoom'
import {
  FIT,
  panBy,
  stepZoom,
  wheelFactor,
  zoomAt,
  zoomPercent
} from '@/components/workshop/app-editor/zoom'

const TYPING = 'input, textarea, select, [contenteditable="true"]'
const CONTROLS = 'button, a, input, textarea, select, label, [role]'
/** The keys that zoom: a step in, a step out, or 0 to fit. */
const ZOOM_KEYS: Partial<Record<string, 1 | -1 | 0>> = {
  '+': 1,
  '=': 1,
  '-': -1,
  _: -1,
  '0': 0
}

function typingIn(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest(TYPING))
}

/** Empty canvas around the stage, where a plain drag pans. */
function onBackdrop(target: EventTarget | null, frame: HTMLElement) {
  return (
    target instanceof Element &&
    !frame.contains(target) &&
    !target.closest(CONTROLS)
  )
}

/** Where a client point sits from the frame's unzoomed top left. */
function framePoint(frame: HTMLElement, view: ZoomView, x: number, y: number) {
  const box = frame.getBoundingClientRect()
  return { x: x - (box.left - view.x), y: y - (box.top - view.y) }
}

const sizeOf = (frame: HTMLElement) => ({
  width: frame.offsetWidth,
  height: frame.offsetHeight
})

/**
 * The editor canvas's zoom: the stage's `EditorFrame` registers as `frame`
 * and draws `view`; the canvas takes ctrl or pinch wheel, two-finger
 * pinch, space or middle-button drag, and the + - 0 keys.
 */
export function useEditorZoom(
  canvas: Readonly<ShallowRef<HTMLElement | null>>
) {
  const view = shallowRef<ZoomView>(FIT)
  const frame = shallowRef<HTMLElement>()
  const percent = computed(() => zoomPercent(view.value))
  const touches = new Map<number, { x: number; y: number }>()
  let spaceHeld = false
  let panning: { x: number; y: number } | undefined

  const fit = () => (view.value = FIT)

  function step(direction: 1 | -1) {
    if (frame.value)
      view.value = stepZoom(view.value, direction, sizeOf(frame.value))
  }

  function zoomAround(factor: number, x: number, y: number) {
    const el = frame.value
    if (!el) return
    const at = framePoint(el, view.value, x, y)
    view.value = zoomAt(view.value, factor, at, sizeOf(el))
  }

  function pan(dx: number, dy: number) {
    if (frame.value) view.value = panBy(view.value, dx, dy, sizeOf(frame.value))
  }

  function onWheel(event: WheelEvent) {
    if (!frame.value) return
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault()
      zoomAround(wheelFactor(event.deltaY), event.clientX, event.clientY)
    } else if (view.value.scale !== 1) {
      event.preventDefault()
      pan(-event.deltaX, -event.deltaY)
    }
  }

  function pinch(event: PointerEvent) {
    const [a, b] = [...touches.values()]
    touches.set(event.pointerId, { x: event.clientX, y: event.clientY })
    const [c, d] = [...touches.values()]
    const before = Math.hypot(a.x - b.x, a.y - b.y)
    const after = Math.hypot(c.x - d.x, c.y - d.y)
    pan((c.x + d.x - a.x - b.x) / 2, (c.y + d.y - a.y - b.y) / 2)
    if (before) zoomAround(after / before, (c.x + d.x) / 2, (c.y + d.y) / 2)
  }

  function trackTouch(event: PointerEvent) {
    if (event.pointerType === 'touch' && touches.size < 2)
      touches.set(event.pointerId, { x: event.clientX, y: event.clientY })
  }

  function grabs(event: PointerEvent, el: HTMLElement) {
    if (view.value.scale === 1) return false
    return spaceHeld || event.button === 1 || onBackdrop(event.target, el)
  }

  function onPointerDown(event: PointerEvent) {
    const el = frame.value
    if (!el) return
    trackTouch(event)
    if (touches.size < 2 && !grabs(event, el)) return
    event.preventDefault()
    event.stopPropagation()
    if (touches.size < 2) panning = { x: event.clientX, y: event.clientY }
    canvas.value?.setPointerCapture(event.pointerId)
  }

  function onPointerMove(event: PointerEvent) {
    if (touches.size === 2 && touches.has(event.pointerId)) {
      event.stopPropagation()
      pinch(event)
      return
    }
    if (!panning) return
    pan(event.clientX - panning.x, event.clientY - panning.y)
    panning = { x: event.clientX, y: event.clientY }
  }

  function onPointerUp(event: PointerEvent) {
    touches.delete(event.pointerId)
    panning = undefined
  }

  function onSpace(event: KeyboardEvent) {
    if (event.key === ' ' && !typingIn(event.target))
      spaceHeld = event.type === 'keydown'
  }

  function onKey(event: KeyboardEvent) {
    const direction = ZOOM_KEYS[event.key]
    if (direction === undefined || event.ctrlKey || event.metaKey) return
    if (!frame.value || typingIn(event.target)) return
    if (direction) step(direction)
    else fit()
  }

  useEventListener(canvas, 'wheel', onWheel, { passive: false })
  useEventListener(canvas, 'pointerdown', onPointerDown, { capture: true })
  useEventListener(canvas, 'pointermove', onPointerMove, { capture: true })
  useEventListener(canvas, ['pointerup', 'pointercancel'], onPointerUp, {
    capture: true
  })
  useEventListener(window, ['keydown', 'keyup'], onSpace)
  useEventListener(window, 'keydown', onKey)

  return {
    view,
    frame,
    percent,
    fit,
    zoomIn: () => step(1),
    zoomOut: () => step(-1)
  }
}

export type EditorZoom = ReturnType<typeof useEditorZoom>

export const EDITOR_ZOOM: InjectionKey<EditorZoom> = Symbol('editor-zoom')
