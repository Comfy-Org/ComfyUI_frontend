/**
 * Pointer-driven width resize for FloatingPanel's dock presets.
 * Snaps to whole cell+gutter steps so the panel lands on the grid.
 * Clamped to [MIN_CELLS, MAX_CELLS] (min = default dock width).
 */
import type { Ref } from 'vue'

import { usePointerDrag } from './usePointerDrag'

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
  let startX = 0
  let startCells = 0
  let gridStep = 56

  const { isDragging: isResizing, start: startResize } = usePointerDrag({
    stopPropagation: true,
    onStart: (e) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return false
      startX = e.clientX
      startCells = opts.widthCells.value
      gridStep = readGridStep()
    },
    onMove: (e) => {
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
    }
  })

  return { isResizing, startResize }
}
