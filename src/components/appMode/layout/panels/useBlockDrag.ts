/**
 * Pointer-driven multi-column block reorder.
 *
 * Hit-testing reads a snapshot of block rects taken at drag start —
 * never the live DOM — so the FLIP-animated preview can't feed back
 * into target detection. Equality guard before writing dropTarget
 * keeps the display layout from re-running every pointermove.
 * HYSTERESIS_PX widens the active zone's boundary so the pointer
 * has to move past the edge before switching — kills jitter at
 * column edges and row midlines.
 */
import { computed, ref } from 'vue'
import type { Ref } from 'vue'

import type { BlockPos, DropTarget } from './panelTypes'
import { usePointerDrag } from './usePointerDrag'

interface UseBlockDragOptions {
  listEl: Ref<HTMLElement | null>
  onCommit: (from: BlockPos, target: DropTarget) => void
}

interface BlockSnapshot {
  rect: DOMRect
  rowIndex: number
  colIndex: number
}

const EDGE_FRACTION = 0.3
const EDGE_MIN_PX = 40
const EDGE_MAX_PX = 140
const DRAG_THRESHOLD_PX = 5
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
  // Exclude the dragged block from the nearest-search.
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

  // Hysteresis only when nearest === last target; crossing to a
  // different block uses fresh boundaries.
  let stickyKind: DropTarget['kind'] | null = null
  if (currentTarget && currentTarget.rowIndex === rowIndex) {
    if (
      currentTarget.kind === 'columnBefore' ||
      currentTarget.kind === 'columnAfter'
    ) {
      if (currentTarget.colIndex === colIndex) stickyKind = currentTarget.kind
    } else {
      // newRow* is per-row, so any block in this row keeps it sticky.
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

  let pendingPos: BlockPos | null = null
  let snapshot: BlockSnapshot[] = []

  const { isDragging: isPastThreshold, start: startGen } = usePointerDrag({
    threshold: DRAG_THRESHOLD_PX,
    stopPropagation: true,
    onActivate: () => {
      if (pendingPos) draggingPos.value = { ...pendingPos }
    },
    onMove: (e) => {
      if (!pendingPos) return
      const next = computeDropTarget(
        snapshot,
        pendingPos,
        e.clientX,
        e.clientY,
        dropTarget.value
      )
      if (!targetsEqual(dropTarget.value, next)) dropTarget.value = next
    },
    onCommit: () => {
      const from = draggingPos.value
      const target = dropTarget.value
      if (from && target) opts.onCommit(from, target)
    },
    onReset: () => {
      draggingPos.value = null
      dropTarget.value = null
      pendingPos = null
      snapshot = []
    }
  })

  const isDragging = computed(() => isPastThreshold.value)

  function startDrag(pos: BlockPos, e: PointerEvent) {
    // Gate before writing state so a rejected press can't leak into
    // the next valid drag.
    if (e.button !== 0 && e.pointerType === 'mouse') return
    pendingPos = pos
    const container = opts.listEl.value
    snapshot = container ? captureSnapshot(container) : []
    startGen(e)
  }

  return { draggingPos, dropTarget, isDragging, startDrag }
}
