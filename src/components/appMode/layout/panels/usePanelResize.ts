/**
 * usePanelResize — pointer-driven width resize for FloatingPanel when
 * docked. Snaps to whole cell + gutter increments so the panel always
 * lands on the layout grid. Activates on pointerdown over an inner-
 * edge hit area (caller wires `startResize` to that element).
 *
 * Clamped to [MIN_CELLS, MAX_CELLS]; the min matches the default dock
 * width so the panel can never be narrower than its non-resizable
 * baseline.
 */
import { useEventListener } from '@vueuse/core'
import { ref } from 'vue'
import type { Ref } from 'vue'

interface UsePanelResizeOptions {
  /** Which side the panel docks to — controls drag direction math. */
  side: Ref<'left' | 'right'>
  /** Two-way reactive cell count (read + write). */
  widthCells: Ref<number>
}

const MIN_CELLS = 8
const MAX_CELLS = 19

/** Read the grid step (cell + gutter, in px) from design-system tokens
 *  at runtime so theme overrides take effect without a constant sync. */
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
    // For right-dock the panel's inner edge is on the LEFT — dragging
    // the pointer left should widen the panel (negative clientX delta
    // → more cells). For left-dock it's the opposite.
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
