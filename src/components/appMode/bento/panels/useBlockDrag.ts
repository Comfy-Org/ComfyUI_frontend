/**
 * useBlockDrag — pointer-driven reorder for blocks inside a panel,
 * with Notion-style column support.
 *
 * Drop-target detection: find the block closest to the pointer, then
 * classify the pointer's position inside that block's rect into one of
 * four zones — left edge → columnBefore, right edge → columnAfter,
 * upper middle → newRowBefore, lower middle → newRowAfter.
 */
import { computed, onBeforeUnmount, ref } from 'vue'
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

function computeDropTarget(
  container: HTMLElement,
  pointerX: number,
  pointerY: number
): DropTarget | null {
  const blocks = Array.from(
    container.querySelectorAll<HTMLElement>('[data-block-row][data-block-col]')
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

  let activePointerId: number | null = null
  let capturedEl: HTMLElement | null = null

  const isDragging = computed(() => draggingPos.value !== null)

  function onPointerMove(e: PointerEvent) {
    const container = opts.listEl.value
    if (!container || draggingPos.value === null) return
    dropTarget.value = computeDropTarget(container, e.clientX, e.clientY)
  }

  function cleanupListeners() {
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', onPointerUp)
    window.removeEventListener('pointercancel', onPointerCancel)
  }

  function endDrag(commit: boolean) {
    const from = draggingPos.value
    const target = dropTarget.value
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
    cleanupListeners()

    if (!commit || !from || !target) return
    opts.onCommit(from, target)
  }

  function onPointerUp() {
    endDrag(true)
  }
  function onPointerCancel() {
    endDrag(false)
  }

  function startDrag(pos: BlockPos, e: PointerEvent) {
    if (e.button !== 0 && e.pointerType === 'mouse') return
    const target = e.currentTarget as HTMLElement
    activePointerId = e.pointerId
    capturedEl = target
    try {
      target.setPointerCapture(e.pointerId)
    } catch {
      // ignore
    }
    draggingPos.value = { ...pos }
    const container = opts.listEl.value
    if (container) {
      dropTarget.value = computeDropTarget(container, e.clientX, e.clientY)
    }
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointercancel', onPointerCancel)
    e.preventDefault()
    e.stopPropagation()
  }

  onBeforeUnmount(cleanupListeners)

  return {
    draggingPos,
    dropTarget,
    isDragging,
    startDrag
  }
}
