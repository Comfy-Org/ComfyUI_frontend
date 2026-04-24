/**
 * useBlockDrag — pointer-driven reorder for blocks inside a panel,
 * with multi-column row support.
 *
 * Architecture:
 * - **Snapshot hit-testing.** At drag start we capture each block's
 *   `{rect, rowIndex, colIndex}`. Every subsequent hit-test runs
 *   against that snapshot, never the live DOM. Without this, the
 *   reshuffle preview (`displayRows = applyMove(...)`) and its FLIP
 *   animation change rects during the drag, creating a feedback
 *   loop — a target change reshuffles the DOM, which changes
 *   `getBoundingClientRect()`, which changes the target again.
 *   Snapshot makes hit zones static and immune to mid-drag DOM
 *   mutation.
 * - **Target-shape equality.** `computeDropTarget()` returns a fresh
 *   object per call; writing it straight to the ref would re-trigger
 *   `displayRows` + FLIP every single pointermove even when the
 *   logical target is unchanged. A deep equality guard before the
 *   assignment keeps the reactive graph quiet unless the zone
 *   actually changes.
 * - **Hysteresis on zone boundaries.** Once a zone is active, we
 *   expand its effective boundary by `HYSTERESIS_PX` so the cursor
 *   has to move meaningfully past the edge before switching. Kills
 *   the jittery flip-flop when the pointer hovers exactly on a
 *   column-edge or the row midline.
 *
 * Drop-target detection: find the block whose (snapshot) center is
 * closest to the pointer, then classify the pointer's position
 * inside that block's snapshot rect into one of four zones — left
 * edge → columnBefore, right edge → columnAfter, upper middle →
 * newRowBefore, lower middle → newRowAfter.
 *
 * Drag contract:
 * - Starts on pointerdown; only activates (`draggingPos` set) once
 *   the pointer moves past `DRAG_THRESHOLD_PX`, so a plain click on
 *   the block doesn't count as a drag.
 * - Only responds to the pointer that started the drag.
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

interface BlockSnapshot {
  rect: DOMRect
  rowIndex: number
  colIndex: number
}

/** Fraction of a block's width that counts as "edge zone" for side-drop. */
const EDGE_FRACTION = 0.3
const EDGE_MIN_PX = 40
const EDGE_MAX_PX = 140
/** Pointer must move at least this far (px) to count as a drag, not a click. */
const DRAG_THRESHOLD_PX = 5
/** Current zone sticks by this many px past its edge before switching. */
const HYSTERESIS_PX = 8

function captureSnapshot(container: HTMLElement): BlockSnapshot[] {
  const blocks = container.querySelectorAll<HTMLElement>(
    '[data-block-row][data-block-col]'
  )
  const out: BlockSnapshot[] = []
  for (const el of blocks) {
    const rowIndex = Number(el.dataset.blockRow)
    const colIndex = Number(el.dataset.blockCol)
    if (!Number.isFinite(rowIndex) || !Number.isFinite(colIndex)) continue
    out.push({ rect: el.getBoundingClientRect(), rowIndex, colIndex })
  }
  return out
}

function targetsEqual(a: DropTarget | null, b: DropTarget | null): boolean {
  if (a === b) return true
  if (!a || !b) return false
  if (a.kind !== b.kind) return false
  if (a.rowIndex !== b.rowIndex) return false
  const aCol = 'colIndex' in a ? a.colIndex : undefined
  const bCol = 'colIndex' in b ? b.colIndex : undefined
  return aCol === bCol
}

function computeDropTarget(
  snapshot: BlockSnapshot[],
  dragFrom: BlockPos,
  pointerX: number,
  pointerY: number,
  currentTarget: DropTarget | null
): DropTarget | null {
  // Exclude the dragged block by its ORIGINAL row/col so the nearest
  // search doesn't snap to the block the user is currently holding.
  const candidates: BlockSnapshot[] = []
  for (const s of snapshot) {
    if (s.rowIndex === dragFrom.row && s.colIndex === dragFrom.col) continue
    candidates.push(s)
  }
  if (candidates.length === 0) return null

  let nearest: BlockSnapshot | null = null
  let nearestDist = Infinity
  for (const s of candidates) {
    const dx = s.rect.left + s.rect.width / 2 - pointerX
    const dy = s.rect.top + s.rect.height / 2 - pointerY
    const d = dx * dx + dy * dy
    if (d < nearestDist) {
      nearestDist = d
      nearest = s
    }
  }
  if (!nearest) return null

  const { rect, rowIndex, colIndex } = nearest
  const edgeZone = Math.min(
    Math.max(rect.width * EDGE_FRACTION, EDGE_MIN_PX),
    EDGE_MAX_PX
  )

  // Hysteresis — stickiness only applies when the nearest is the
  // same block/row we were targeting last. A target switch that
  // crosses to a different block uses the fresh boundaries; only
  // *staying put* gets the extra grace space.
  let stickyKind: DropTarget['kind'] | null = null
  if (currentTarget && currentTarget.rowIndex === rowIndex) {
    if (
      currentTarget.kind === 'columnBefore' ||
      currentTarget.kind === 'columnAfter'
    ) {
      if (currentTarget.colIndex === colIndex) stickyKind = currentTarget.kind
    } else {
      // newRowBefore / newRowAfter are per-row, not per-column — any
      // block in the same row keeps the stickiness alive.
      stickyKind = currentTarget.kind
    }
  }

  const leftEdge =
    rect.left + edgeZone + (stickyKind === 'columnBefore' ? HYSTERESIS_PX : 0)
  const rightEdge =
    rect.right - edgeZone - (stickyKind === 'columnAfter' ? HYSTERESIS_PX : 0)

  if (pointerX < leftEdge) {
    return { kind: 'columnBefore', rowIndex, colIndex }
  }
  if (pointerX > rightEdge) {
    return { kind: 'columnAfter', rowIndex, colIndex }
  }

  const midY = rect.top + rect.height / 2
  const effectiveMidY =
    stickyKind === 'newRowBefore'
      ? midY + HYSTERESIS_PX
      : stickyKind === 'newRowAfter'
        ? midY - HYSTERESIS_PX
        : midY

  if (pointerY < effectiveMidY) {
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
  let snapshot: BlockSnapshot[] = []

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
    snapshot = []
  }

  useEventListener(window, 'pointermove', (e: PointerEvent) => {
    if (!isOurPointer(e)) return
    if (!movedFarEnough) {
      const dx = e.clientX - startX
      const dy = e.clientY - startY
      if (dx * dx + dy * dy < DRAG_THRESHOLD_PX * DRAG_THRESHOLD_PX) return
      movedFarEnough = true
      // Promote the pending position into the live drag state.
      if (pendingPos) draggingPos.value = { ...pendingPos }
    }
    if (!pendingPos) return
    const next = computeDropTarget(
      snapshot,
      pendingPos,
      e.clientX,
      e.clientY,
      dropTarget.value
    )
    // Equality guard: a fresh `computeDropTarget` object every frame
    // would re-fire displayRows + FLIP even when logically nothing
    // changed. Only write when the zone shape actually differs.
    if (!targetsEqual(dropTarget.value, next)) {
      dropTarget.value = next
    }
  })

  useEventListener(window, 'pointerup', (e: PointerEvent) => {
    if (!isOurPointer(e)) return
    const from = draggingPos.value
    const target = dropTarget.value
    reset()
    // If we never crossed the threshold, draggingPos is null and we
    // skip the commit — a click on the block is a no-op.
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
    // Capture rects from the pre-drag layout — no reshuffle or FLIP
    // has run yet, so the DOM is in its stable original state.
    const container = opts.listEl.value
    snapshot = container ? captureSnapshot(container) : []
    try {
      target.setPointerCapture(e.pointerId)
    } catch {
      // ignore
    }
    // draggingPos + dropTarget stay null until the threshold crosses —
    // so a click on the block is a no-op.
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
