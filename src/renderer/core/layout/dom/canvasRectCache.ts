/**
 * Canvas Rect Cache (VueUse-based)
 *
 * Tracks the client-origin and size of the graph canvas container using
 * useElementBounding, and exposes a small API to read the rect and
 * subscribe to changes.
 *
 * Assumptions:
 * - Document scrolling is disabled (body overflow: hidden)
 * - Layout changes are driven by window resize and container/splitter changes
 */
import { useElementBounding } from '@vueuse/core'
import { shallowRef, watch } from 'vue'

// Target container element (covers the canvas fully and shares its origin)
const containerRef = shallowRef<HTMLElement | null>(null)

// Bind bounding measurement once; element may be resolved later
const { x, y, width, height, update } = useElementBounding(containerRef, {
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
    if (containerRef.value) update()
  }
}

// Notify subscribers when the bounding rect changes
watch([x, y, width, height], () => {
  if (listeners.size) listeners.forEach((cb) => cb())
})

export function getCanvasClientOrigin() {
  ensureContainer()
  return { left: x.value || 0, top: y.value || 0 }
}
