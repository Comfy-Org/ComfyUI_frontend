/**
 * useBlockDrag — pointer-driven reorder for blocks inside a panel,
 * with multi-column row support.
 *
 * Drop-target detection: find the block closest to the pointer, then
 * classify the pointer's position inside that block's rect into one of
 * four zones — left edge → columnBefore, right edge → columnAfter,
 * upper middle → newRowBefore, lower middle → newRowAfter.
 *
 * Drag contract:
 * - Starts on grip pointerdown; only activates (`draggingPos` set) once
 *   the pointer moves past `DRAG_THRESHOLD_PX`, so a plain click on the
 *   grip doesn't count as a drag.
 * - Only responds to the pointer that started the drag (activePointerId
 *   filter).
 * - Ends on pointerup / pointercancel / window blur.
 */
import { useEventListener, useWindowFocus } from '@vueuse/core'
import { computed, ref, watch } from 'vue'
import type { Ref } from 'vue'

import type { BlockPos, DropTarget } from './panelTypes'

interface UseBlockDragOptions {
  /** Container element holding block elements (with `data-block-row` + `data-block-col`). */
  listEl: Ref<HTMLElement | null>
  /** Called on pointerup with the committed reorder target. */
  onCommit: (from: BlockPos, target: DropTarget) => void
}

/** Fraction of a block's width that counts as "edge zone" for side-drop. */
const EDGE_FRACTION = 0.3
const EDGE_MIN_PX = 40
const EDGE_MAX_PX = 140
/** Pointer must move at least this far (px) to count as a drag, not a click. */
const DRAG_THRESHOLD_PX = 5

function computeDropTarget(
  container: HTMLElement,
  pointerX: number,
  pointerY: number
): DropTarget | null {
  // Filter out the block currently in flight — PanelBlockList tags it
  // with `data-dragging="true"` so the dropTarget math snaps to siblings
  // instead of to the block's own preview position (which would always
  // read as the nearest and trap the target).
  const blocks = Array.from(
    container.querySelectorAll<HTMLElement>(
      '[data-block-row][data-block-col]:not([data-dragging])'
    )
  )
  if (blocks.length === 0) return null

  // Find the block whose center is closest to the pointer.
  let nearest: HTMLElement | null = null
  let nearestDist = Infinity
  for (const el of blocks) {
    const r = el.getBoundingClientRect()
    const dx = r.left + r.width / 2 - pointerX
    const dy = r.top + r.height / 2 - pointerY
    const d = dx * dx + dy * dy
    if (d < nearestDist) {
      nearestDist = d
      nearest = el
    }
  }
  if (!nearest) return null

  const rowIndex = Number(nearest.dataset.blockRow)
  const colIndex = Number(nearest.dataset.blockCol)
  const rect = nearest.getBoundingClientRect()

  const edgeZone = Math.min(
    Math.max(rect.width * EDGE_FRACTION, EDGE_MIN_PX),
    EDGE_MAX_PX
  )

  if (pointerX < rect.left + edgeZone) {
    return { kind: 'columnBefore', rowIndex, colIndex }
  }
  if (pointerX > rect.right - edgeZone) {
    return { kind: 'columnAfter', rowIndex, colIndex }
  }
  if (pointerY < rect.top + rect.height / 2) {
    return { kind: 'newRowBefore', rowIndex }
  }
  return { kind: 'newRowAfter', rowIndex }
}

export function useBlockDrag(opts: UseBlockDragOptions) {
  const draggingPos = ref<BlockPos | null>(null)
  const dropTarget = ref<DropTarget | null>(null)

  // Non-reactive drag state.
  let activePointerId: number | null = null
  let capturedEl: HTMLElement | null = null
  let startX = 0
  let startY = 0
  let movedFarEnough = false
  let pendingPos: BlockPos | null = null

  const isDragging = computed(() => draggingPos.value !== null)

  function isOurPointer(e: PointerEvent): boolean {
    return activePointerId !== null && e.pointerId === activePointerId
  }

  function reset() {
    draggingPos.value = null
    dropTarget.value = null
    if (capturedEl && activePointerId !== null) {
      try {
        capturedEl.releasePointerCapture(activePointerId)
      } catch {
        // ignore
      }
    }
    activePointerId = null
    capturedEl = null
    movedFarEnough = false
    pendingPos = null
  }

  useEventListener(window, 'pointermove', (e: PointerEvent) => {
    if (!isOurPointer(e)) return
    if (!movedFarEnough) {
      const dx = e.clientX - startX
      const dy = e.clientY - startY
      if (dx * dx + dy * dy < DRAG_THRESHOLD_PX * DRAG_THRESHOLD_PX) return
      movedFarEnough = true
      // Promote the pending position into the live drag state.
      // PanelBlockList reads `draggingPos` + `dropTarget` to reshuffle
      // its layout into the post-drop preview and frame the moving
      // block with a dashed outline.
      if (pendingPos) draggingPos.value = { ...pendingPos }
    }
    const container = opts.listEl.value
    if (container) {
      dropTarget.value = computeDropTarget(container, e.clientX, e.clientY)
    }
  })

  useEventListener(window, 'pointerup', (e: PointerEvent) => {
    if (!isOurPointer(e)) return
    const from = draggingPos.value
    const target = dropTarget.value
    reset()
    // If we never crossed the threshold, draggingPos is null and we
    // skip the commit — a click on the grip is a no-op.
    if (from && target) opts.onCommit(from, target)
  })

  useEventListener(window, 'pointercancel', (e: PointerEvent) => {
    if (!isOurPointer(e)) return
    reset()
  })

  // Abandon on window blur so a drag doesn't survive alt-tab / OS modals.
  const focused = useWindowFocus()
  watch(focused, (nowFocused) => {
    if (!nowFocused && activePointerId !== null) reset()
  })

  function startDrag(pos: BlockPos, e: PointerEvent) {
    if (e.button !== 0 && e.pointerType === 'mouse') return
    const target = e.currentTarget as HTMLElement
    activePointerId = e.pointerId
    capturedEl = target
    startX = e.clientX
    startY = e.clientY
    movedFarEnough = false
    pendingPos = pos
    try {
      target.setPointerCapture(e.pointerId)
    } catch {
      // ignore
    }
    // draggingPos + dropTarget stay null until the threshold crosses —
    // so a click on the grip is a no-op.
    e.preventDefault()
    e.stopPropagation()
  }

  return {
    draggingPos,
    dropTarget,
    isDragging,
    startDrag
  }
}
