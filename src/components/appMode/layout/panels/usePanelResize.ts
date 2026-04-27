/**
 * Pointer-driven width resize for FloatingPanel's dock presets.
 * Snaps to whole cell+gutter steps so the panel lands on the grid.
 * Clamped to [MIN_CELLS, MAX_CELLS] (min = default dock width).
 */
import { useEventListener, useWindowFocus } from '@vueuse/core'
import { ref, watch } from 'vue'
import type { Ref } from 'vue'

interface UsePanelResizeOptions {
  /** Which side the panel docks to — controls drag direction math. */
  side: Ref<'left' | 'right'>
  /** Two-way reactive cell count (read + write). */
  widthCells: Ref<number>
}

const MIN_CELLS = 8
const MAX_CELLS = 19

/** Read cell + gutter from design-system tokens at runtime so theme
 *  overrides take effect without a constant sync. */
function readGridStep(): number {
  if (typeof document === 'undefined') return 56
  const cs = getComputedStyle(document.documentElement)
  const cell = parseFloat(cs.getPropertyValue('--spacing-layout-cell')) || 48
  const gutter = parseFloat(cs.getPropertyValue('--spacing-layout-gutter')) || 8
  return cell + gutter
}

export function usePanelResize(opts: UsePanelResizeOptions) {
  const isResizing = ref(false)

  let activePointerId: number | null = null
  let capturedEl: HTMLElement | null = null
  let startX = 0
  let startCells = 0
  let gridStep = 56

  function isOurPointer(e: PointerEvent): boolean {
    return activePointerId !== null && e.pointerId === activePointerId
  }

  function reset() {
    isResizing.value = false
    if (capturedEl && activePointerId !== null) {
      try {
        capturedEl.releasePointerCapture(activePointerId)
      } catch {
        // pointer may already be released
      }
    }
    activePointerId = null
    capturedEl = null
  }

  useEventListener(window, 'pointermove', (e: PointerEvent) => {
    if (!isOurPointer(e)) return
    // Right-dock's inner edge is on the LEFT, so a leftward pointer
    // delta widens the panel; left-dock is opposite.
    const delta = e.clientX - startX
    const widenPx = opts.side.value === 'right' ? -delta : delta
    const deltaCells = Math.round(widenPx / gridStep)
    const next = Math.max(
      MIN_CELLS,
      Math.min(MAX_CELLS, startCells + deltaCells)
    )
    if (next !== opts.widthCells.value) opts.widthCells.value = next
  })

  useEventListener(window, 'pointerup', (e: PointerEvent) => {
    if (!isOurPointer(e)) return
    reset()
  })

  useEventListener(window, 'pointercancel', (e: PointerEvent) => {
    if (!isOurPointer(e)) return
    reset()
  })

  // Abandon on window blur so a resize can't get stuck waiting for a
  // pointerup that never arrives (alt-tab, OS modal, etc.).
  const focused = useWindowFocus()
  watch(focused, (nowFocused) => {
    if (!nowFocused && activePointerId !== null) reset()
  })

  function startResize(e: PointerEvent) {
    if (e.button !== 0 && e.pointerType === 'mouse') return
    activePointerId = e.pointerId
    capturedEl = e.currentTarget as HTMLElement
    startX = e.clientX
    startCells = opts.widthCells.value
    gridStep = readGridStep()
    isResizing.value = true
    try {
      capturedEl.setPointerCapture(e.pointerId)
    } catch {
      // some browsers reject capture on non-primary pointers; ignore
    }
    e.preventDefault()
    e.stopPropagation()
  }

  return { isResizing, startResize }
}
