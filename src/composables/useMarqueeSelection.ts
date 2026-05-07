import { useEventListener, useRafFn } from '@vueuse/core'
import { computed, ref, watch } from 'vue'
import type { CSSProperties, Ref } from 'vue'

import { exceedsClickThreshold } from '@/composables/useClickDragGuard'

type Rect = { left: number; top: number; right: number; bottom: number }

interface MarqueeSelectionOptions {
  container: Ref<HTMLElement | null>
  itemSelector?: string
  threshold?: number
  autoScrollEdge?: number
  autoScrollSpeed?: number
  shiftKey: Ref<boolean | null>
  cmdOrCtrlKey: Ref<boolean | null>
  getCurrentSelection: () => Set<string>
  onSelectionChange: (ids: string[]) => void
}

type SelectionMode = 'replace' | 'add' | 'toggle'

function rectsIntersect(a: Rect, b: Rect): boolean {
  return (
    a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
  )
}

export function useMarqueeSelection(options: MarqueeSelectionOptions) {
  const {
    container,
    itemSelector = '[data-asset-id]',
    threshold = 5,
    autoScrollEdge = 40,
    autoScrollSpeed = 8,
    shiftKey,
    cmdOrCtrlKey,
    getCurrentSelection,
    onSelectionChange
  } = options

  const isActive = ref(false)
  const rectStyle = ref<CSSProperties | null>(null)

  // Internal state — not reactive for performance
  let pending = false
  let startClientX = 0
  let startClientY = 0
  let currentClientX = 0
  let currentClientY = 0
  let scrollTopAtStart = 0
  let selectionSnapshot: Set<string> = new Set()
  let mode: SelectionMode = 'replace'
  let capturedPointerId: number | null = null

  function getMarqueeRect(): Rect | null {
    const el = container.value
    if (!el) return null
    const cr = el.getBoundingClientRect()

    const startX = startClientX - cr.left
    const startY = startClientY - cr.top + scrollTopAtStart
    const currentX = currentClientX - cr.left
    const currentY = currentClientY - cr.top + el.scrollTop

    return {
      left: Math.min(startX, currentX),
      top: Math.min(startY, currentY),
      right: Math.max(startX, currentX),
      bottom: Math.max(startY, currentY)
    }
  }

  function getIntersectedIds(): string[] {
    const el = container.value
    const marquee = getMarqueeRect()
    if (!el || !marquee) return []

    const cr = el.getBoundingClientRect()
    const items = el.querySelectorAll(itemSelector)
    const ids: string[] = []

    for (const item of items) {
      const ir = item.getBoundingClientRect()
      const itemRect: Rect = {
        left: ir.left - cr.left,
        top: ir.top - cr.top + el.scrollTop,
        right: ir.right - cr.left,
        bottom: ir.bottom - cr.top + el.scrollTop
      }
      if (rectsIntersect(marquee, itemRect)) {
        const id = item.getAttribute('data-asset-id')
        if (id) ids.push(id)
      }
    }

    return ids
  }

  function computeSelection(intersectedIds: string[]): string[] {
    if (mode === 'replace') return intersectedIds

    if (mode === 'add') {
      return [...new Set([...selectionSnapshot, ...intersectedIds])]
    }

    // toggle: flip each intersected item relative to snapshot
    const result = new Set(selectionSnapshot)
    for (const id of intersectedIds) {
      if (result.has(id)) result.delete(id)
      else result.add(id)
    }
    return [...result]
  }

  function updateSelection() {
    const ids = getIntersectedIds()
    const selection = computeSelection(ids)
    onSelectionChange(selection)
  }

  function updateRectStyle() {
    const marquee = getMarqueeRect()
    if (!marquee) {
      rectStyle.value = null
      return
    }
    rectStyle.value = {
      left: `${marquee.left}px`,
      top: `${marquee.top}px`,
      width: `${marquee.right - marquee.left}px`,
      height: `${marquee.bottom - marquee.top}px`
    }
  }

  // Auto-scroll via RAF
  const { pause: pauseAutoScroll, resume: resumeAutoScroll } = useRafFn(
    () => {
      const el = container.value
      if (!isActive.value || !el) return

      const cr = el.getBoundingClientRect()
      const distFromTop = currentClientY - cr.top
      const distFromBottom = cr.bottom - currentClientY

      let scrollDelta = 0
      if (currentClientY < cr.top) {
        scrollDelta = -autoScrollSpeed
      } else if (distFromTop < autoScrollEdge) {
        scrollDelta = -autoScrollSpeed * (1 - distFromTop / autoScrollEdge)
      } else if (currentClientY > cr.bottom) {
        scrollDelta = autoScrollSpeed
      } else if (distFromBottom < autoScrollEdge) {
        scrollDelta = autoScrollSpeed * (1 - distFromBottom / autoScrollEdge)
      }

      if (scrollDelta !== 0) {
        el.scrollTop += scrollDelta
        updateRectStyle()
        updateSelection()
      }
    },
    { immediate: false }
  )
  pauseAutoScroll()

  function onPointerDown(e: PointerEvent) {
    if (e.button !== 0 || e.pointerType !== 'mouse') return

    // Only start marquee on background, not on cards
    const target = e.target as HTMLElement
    if (target.closest('[data-virtual-grid-item]')) return

    const el = container.value
    if (!el) return

    pending = true
    capturedPointerId = e.pointerId
    startClientX = e.clientX
    startClientY = e.clientY
    currentClientX = e.clientX
    currentClientY = e.clientY
    scrollTopAtStart = el.scrollTop
    selectionSnapshot = getCurrentSelection()
    mode = shiftKey.value ? 'add' : cmdOrCtrlKey.value ? 'toggle' : 'replace'

    e.preventDefault()
  }

  function onPointerMove(e: PointerEvent) {
    if (!pending && !isActive.value) return

    currentClientX = e.clientX
    currentClientY = e.clientY

    if (pending && !isActive.value) {
      if (
        exceedsClickThreshold(
          { x: startClientX, y: startClientY },
          { x: currentClientX, y: currentClientY },
          threshold
        )
      ) {
        isActive.value = true
        resumeAutoScroll()
        // Capture pointer so pointerup fires even outside the browser window
        const el = container.value
        if (el && capturedPointerId !== null) {
          try {
            el.setPointerCapture(capturedPointerId)
          } catch {
            // Ignore if pointer capture fails (e.g. pointer already released)
          }
        }
      } else {
        return
      }
    }

    updateRectStyle()
    updateSelection()
  }

  function onPointerUp() {
    if (!pending && !isActive.value) return

    const wasDrag = isActive.value

    // Sub-threshold click on background → clear selection (replace mode only)
    if (pending && !wasDrag && mode === 'replace') {
      onSelectionChange([])
    }

    pending = false
    isActive.value = false
    rectStyle.value = null
    pauseAutoScroll()

    // Release pointer capture
    const el = container.value
    if (el && capturedPointerId !== null) {
      try {
        el.releasePointerCapture(capturedPointerId)
      } catch {
        // Ignore — pointer may already be released
      }
    }
    capturedPointerId = null

    // After a real drag, swallow the synthetic click so card click handlers
    // don't overwrite the marquee selection with a single-select.
    if (wasDrag) {
      const swallowClick = (e: Event) => {
        e.stopPropagation()
        e.preventDefault()
      }
      document.addEventListener('click', swallowClick, {
        capture: true,
        once: true
      })
    }
  }

  useEventListener(container, 'pointerdown', onPointerDown)
  useEventListener(document, 'pointermove', onPointerMove)
  useEventListener(document, 'pointerup', onPointerUp)
  useEventListener(document, 'pointercancel', onPointerUp)
  useEventListener(document, 'visibilitychange', () => {
    if (document.hidden && (pending || isActive.value)) onPointerUp()
  })

  // Clean up if container changes
  watch(container, () => {
    if (pending || isActive.value) onPointerUp()
  })

  return {
    isActive: computed(() => isActive.value),
    rectStyle: computed(() => rectStyle.value)
  }
}
