<script setup lang="ts">
/**
 * LayoutGrid — grid layout primitive for App Mode.
 *
 * Renders cells on a 12-column responsive grid where 1×1 cells are square
 * (row height = column width). Empty cells are invisible at runtime; only
 * cells with content render as visible containers via `has-[>*]:*`.
 *
 * Cells snap to integer column/row positions and integer span values.
 */
import { useElementSize } from '@vueuse/core'
import { computed, useTemplateRef } from 'vue'

export interface LayoutCellPlacement {
  /** Stable identifier for the cell. */
  id: string
  /** 1-indexed grid column. */
  col: number
  /** 1-indexed grid row. */
  row: number
  /** Number of columns the cell spans. Default 1. */
  colSpan?: number
  /** Number of rows the cell spans. Default 1. */
  rowSpan?: number
  /** Optional semantic kind, surfaced as a data attribute for testing. */
  kind?: string
}

const {
  cellSize = 48,
  cells,
  outerPadding = 16,
  minGap = 8,
  fillEmpty = false
} = defineProps<{
  /** 1×1 cell side length (px). Fixed — cells never resize. */
  cellSize?: number
  /** Cell placements. Each cell's <slot> name is its id.
   *  col/row accept negative values as CSS Grid end-anchored indices
   *  (-1 = last track, -2 = second-to-last, etc.). */
  cells: LayoutCellPlacement[]
  /** Outer margin around the grid (px). Fixed — stays consistent at every viewport. */
  outerPadding?: number
  /** Minimum gap between cells (px). Actual gap grows from this floor
   *  to absorb whatever slack the viewport has — so cells stay aligned
   *  to the outer margin on all sides. */
  minGap?: number
  /** Prototype-only: render a ghost cell at every unoccupied grid
   *  position so the whole grid is visible. Remove when real
   *  content populates the canvas. */
  fillEmpty?: boolean
}>()

const gridEl = useTemplateRef<HTMLElement>('gridEl')
const { width, height } = useElementSize(gridEl)

// useElementSize defaults to 'content-box' measurement — the reported
// width/height already exclude the element's padding. So `available`
// IS the usable track area; no further subtraction.

// Max track count that fits given min gap (tightest packing).
const trackCount = (available: number) => {
  if (available < cellSize) return 1
  // N * cellSize + (N - 1) * minGap <= available
  return Math.max(1, Math.floor((available + minGap) / (cellSize + minGap)))
}

// Actual gap distributes remaining slack evenly between tracks so the
// grid snaps to the outer margin on all sides — no slack piles up at
// the bottom or right edge.
const axisGap = (available: number, trackN: number) => {
  if (trackN <= 1) return minGap
  const cellsTotal = trackN * cellSize
  return (available - cellsTotal) / (trackN - 1)
}

const cols = computed(() => trackCount(width.value))
const rows = computed(() => trackCount(height.value))
const columnGap = computed(() => axisGap(width.value, cols.value))
const rowGap = computed(() => axisGap(height.value, rows.value))

const gridStyle = computed(() => ({
  padding: `${outerPadding}px`,
  columnGap: `${columnGap.value}px`,
  rowGap: `${rowGap.value}px`,
  gridTemplateColumns: `repeat(${cols.value}, ${cellSize}px)`,
  gridTemplateRows: `repeat(${rows.value}, ${cellSize}px)`
}))

// Resolve negative CSS Grid indices to 1-indexed track positions based on
// the current track count. -2 resolves to the start of the last track,
// -3 to the second-to-last, etc.
//
// Note: -1 resolves to line (N + 1), which is the line *after* the last
// track — valid as a span end, not as a start. Use -2 or lower for start
// positions. CSS line math: line -k = line (N + 2 - k) for N tracks.
function resolvePos(v: number, total: number): number {
  if (v > 0) return v
  return total + 2 + v
}

// Ghost cells fill every unoccupied grid position — prototype visual
// so the full grid structure is visible before real content lands.
const ghostCells = computed<LayoutCellPlacement[]>(() => {
  if (!fillEmpty || cols.value < 1 || rows.value < 1) return []

  const occupied = new Set<string>()
  for (const cell of cells) {
    const c0 = resolvePos(cell.col, cols.value)
    const r0 = resolvePos(cell.row, rows.value)
    const cSpan = cell.colSpan ?? 1
    const rSpan = cell.rowSpan ?? 1
    for (let r = r0; r < r0 + rSpan; r++) {
      for (let c = c0; c < c0 + cSpan; c++) {
        occupied.add(`${c},${r}`)
      }
    }
  }

  const ghosts: LayoutCellPlacement[] = []
  for (let r = 1; r <= rows.value; r++) {
    for (let c = 1; c <= cols.value; c++) {
      if (!occupied.has(`${c},${r}`)) {
        ghosts.push({ id: `__ghost-${c}-${r}`, col: c, row: r, kind: 'ghost' })
      }
    }
  }
  return ghosts
})

function cellStyle(cell: LayoutCellPlacement) {
  const colSpan = cell.colSpan ?? 1
  const rowSpan = cell.rowSpan ?? 1
  return {
    gridColumn: `${cell.col} / span ${colSpan}`,
    gridRow: `${cell.row} / span ${rowSpan}`
  }
}
</script>

<template>
  <!-- Absolute fill eliminates width/height-inheritance ambiguity through
       nested Vue components. Parent must be position: relative (or absolute).

       layout-cell class is kept (not reduced to utilities only) so
       LayoutView's :deep() selectors can continue to match cells by
       .layout-cell[data-cell-kind='...']. -->
  <div
    ref="gridEl"
    class="layout-grid absolute inset-0 box-border grid overflow-hidden bg-layout-canvas"
    :style="gridStyle"
    data-testid="layout-grid"
  >
    <!-- Ghost cells (fillEmpty=true) render beneath real cells, showing
         the grid structure. aria-hidden so they don't pollute the a11y tree.
         The ghost always paints (opacity-60) so the grid is visible even
         when there's no slot content. -->
    <div
      v-for="ghost in ghostCells"
      :key="ghost.id"
      class="layout-cell flex min-h-0 min-w-0 rounded-layout-cell bg-layout-cell opacity-60"
      :style="cellStyle(ghost)"
      aria-hidden="true"
      :data-cell-id="ghost.id"
    />
    <!-- Real cells: subtle dark-on-darker fill only when the cell has
         rendered slot content (has-[>*]). Truly empty cells (no slot
         content) paint no background so the runtime canvas reads as
         composed, not gridded. -->
    <div
      v-for="cell in cells"
      :key="cell.id"
      class="layout-cell flex min-h-0 min-w-0 has-[>*]:rounded-layout-cell has-[>*]:bg-layout-cell"
      :style="cellStyle(cell)"
      :data-cell-id="cell.id"
      :data-cell-kind="cell.kind"
    >
      <slot :name="cell.id" :cell="cell" />
    </div>
  </div>
</template>
