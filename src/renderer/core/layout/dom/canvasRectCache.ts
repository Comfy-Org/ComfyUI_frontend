/**
 * Canvas Rect Cache (VueUse-based)
 *
 * Tracks the client-origin and size of the graph canvas container using
 * useElementBounding, and exposes a small API to read the rect and
 * subscribe to changes.
 *
 * We assume no document scrolling (body is overflow: hidden). Layout
 * changes are driven by window resize and container/splitter changes.
 */
import { useElementBounding } from '@vueuse/core'
import { shallowRef, watch } from 'vue'

type Rect = DOMRectReadOnly

// Target container element (covers the canvas fully and shares its origin)
const containerRef = shallowRef<HTMLElement | null>(null)

// Bind bounding measurement once; element may be resolved later
const { x, y, width, height } = useElementBounding(containerRef, {
  // Track layout changes from resize; scrolling is disabled globally
  windowResize: true,
  windowScroll: false,
  immediate: true
})

// Listener registry for external subscribers
const listeners = new Set<() => void>()

function ensureContainer() {
  if (!containerRef.value) {
    containerRef.value = document.getElementById(
      'graph-canvas-container'
    ) as HTMLElement | null
  }
}

// Notify subscribers when the bounding rect changes
watch([x, y, width, height], () => {
  if (listeners.size) listeners.forEach((cb) => cb())
})

export function invalidate(notify = false) {
  if (notify && listeners.size) listeners.forEach((cb) => cb())
}

export function onCanvasRectChange(cb: () => void): () => void {
  ensureContainer()
  listeners.add(cb)
  return () => listeners.delete(cb)
}

export function getCanvasRect(): Rect {
  ensureContainer()
  const lx = x.value || 0
  const ly = y.value || 0
  const w = width.value || 0
  const h = height.value || 0
  return new DOMRect(lx, ly, w, h)
}

export function getCanvasClientOrigin() {
  ensureContainer()
  const el = containerRef.value
  // VueUse refs can be 0 on first read right after binding
  // if the element was assigned in the same tick. In that case,
  // synchronously read from getBoundingClientRect as a fallback
  // to avoid returning a zero offset during initialization.
  const lx = x.value || 0
  const ly = y.value || 0
  // Also check width/height to distinguish a legitimate (0,0)
  // from an unmeasured state (all zeros)
  if (el && lx === 0 && ly === 0 && width.value === 0 && height.value === 0) {
    const rect = el.getBoundingClientRect()
    return { left: rect.left, top: rect.top }
  }
  return { left: lx, top: ly }
}
