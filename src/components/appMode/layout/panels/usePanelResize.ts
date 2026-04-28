/**
 * Pointer-driven width resize for FloatingPanel's dock presets.
 * Snaps to cell+gutter steps and clamps to [MIN_CELLS, MAX_CELLS].
 */
import type { Ref } from 'vue'

import { usePointerDrag } from './usePointerDrag'

interface UsePanelResizeOptions {
  side: Ref<'left' | 'right'>
  widthCells: Ref<number>
}

const MIN_CELLS = 8
const MAX_CELLS = 19

// Read tokens at runtime so theme overrides take effect.
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
      // Right-dock widens on leftward pointer delta; left-dock opposite.
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
