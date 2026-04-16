<script setup lang="ts">
/**
 * BentoGrid — grid layout primitive for App Mode.
 *
 * Renders cells on a 12-column responsive grid where 1×1 cells are square
 * (row height = column width). Empty cells are invisible at runtime; only
 * cells with content render as visible containers.
 *
 * Cells snap to integer column/row positions and integer span values.
 */
import { computed, useTemplateRef } from 'vue'
import { useElementSize } from '@vueuse/core'

export interface BentoCellPlacement {
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

const props = withDefaults(
  defineProps<{
    /** 1×1 cell side length (px). Fixed — cells never resize. */
    cellSize?: number
    /** Cell placements. Each cell's <slot> name is its id.
     *  col/row accept negative values as CSS Grid end-anchored indices
     *  (-1 = last track, -2 = second-to-last, etc.). */
    cells: BentoCellPlacement[]
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
  }>(),
  {
    cellSize: 48,
    outerPadding: 16,
    minGap: 8,
    fillEmpty: false
  }
)

const gridEl = useTemplateRef<HTMLElement>('gridEl')
const { width, height } = useElementSize(gridEl)

// useElementSize defaults to 'content-box' measurement — the reported
// width/height already exclude the element's padding. So `available`
// IS the usable track area; no further subtraction.

// Max track count that fits given min gap (tightest packing).
const trackCount = (available: number) => {
  if (available < props.cellSize) return 1
  // N * cellSize + (N - 1) * minGap <= available
  return Math.max(
    1,
    Math.floor((available + props.minGap) / (props.cellSize + props.minGap))
  )
}

// Actual gap distributes remaining slack evenly between tracks so the
// grid snaps to the outer margin on all sides — no slack piles up at
// the bottom or right edge.
const axisGap = (available: number, trackN: number) => {
  if (trackN <= 1) return props.minGap
  const cellsTotal = trackN * props.cellSize
  return (available - cellsTotal) / (trackN - 1)
}

const cols = computed(() => trackCount(width.value))
const rows = computed(() => trackCount(height.value))
const columnGap = computed(() => axisGap(width.value, cols.value))
const rowGap = computed(() => axisGap(height.value, rows.value))

const gridStyle = computed(() => ({
  padding: `${props.outerPadding}px`,
  columnGap: `${columnGap.value}px`,
  rowGap: `${rowGap.value}px`,
  gridTemplateColumns: `repeat(${cols.value}, ${props.cellSize}px)`,
  gridTemplateRows: `repeat(${rows.value}, ${props.cellSize}px)`
}))

// Resolve negative CSS Grid indices (-1, -2, ...) to 1-indexed positions
// based on the current track count. CSS line -k = line (N + 2 - k) for
// N tracks, so the track starting at that line has number (N + 2 - k).
function resolvePos(v: number, total: number): number {
  if (v > 0) return v
  return total + 2 + v
}

// Ghost cells fill every unoccupied grid position — prototype visual
// so the full grid structure is visible before real content lands.
const ghostCells = computed<BentoCellPlacement[]>(() => {
  if (!props.fillEmpty || cols.value < 1 || rows.value < 1) return []

  const occupied = new Set<string>()
  for (const cell of props.cells) {
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

  const ghosts: BentoCellPlacement[] = []
  for (let r = 1; r <= rows.value; r++) {
    for (let c = 1; c <= cols.value; c++) {
      if (!occupied.has(`${c},${r}`)) {
        ghosts.push({ id: `__ghost-${c}-${r}`, col: c, row: r, kind: 'ghost' })
      }
    }
  }
  return ghosts
})

function cellStyle(cell: BentoCellPlacement) {
  const colSpan = cell.colSpan ?? 1
  const rowSpan = cell.rowSpan ?? 1
  return {
    gridColumn: `${cell.col} / span ${colSpan}`,
    gridRow: `${cell.row} / span ${rowSpan}`
  }
}
</script>

<template>
  <div
    ref="gridEl"
    class="bento-grid"
    :style="gridStyle"
    data-testid="bento-grid"
  >
    <!-- Ghost cells (fillEmpty=true) render beneath real cells, showing
         the grid structure. aria-hidden so they don't pollute the a11y tree. -->
    <div
      v-for="ghost in ghostCells"
      :key="ghost.id"
      class="bento-cell bento-cell--ghost"
      :style="cellStyle(ghost)"
      aria-hidden="true"
      :data-cell-id="ghost.id"
    />
    <div
      v-for="cell in cells"
      :key="cell.id"
      class="bento-cell"
      :style="cellStyle(cell)"
      :data-cell-id="cell.id"
      :data-cell-kind="cell.kind"
    >
      <slot :name="cell.id" :cell="cell" />
    </div>
  </div>
</template>

<style scoped>
.bento-grid {
  /* Absolute fill eliminates width/height-inheritance ambiguity through
     nested Vue components. Parent must be position: relative (or absolute). */
  position: absolute;
  inset: 0;
  display: grid;
  box-sizing: border-box;
  background-color: var(--p-content-background, #1a1a1a);
  overflow: hidden;
}

.bento-cell {
  /* Subtle dark-on-darker fill matches mockup. Cells with no slot content
     stay empty (no background) so the canvas reads as composed, not gridded. */
  display: flex;
  min-width: 0;
  min-height: 0;
}

/* Real cells with rendered slot content get the subtle fill.
   Truly empty cells (no slot content) have no children → no background,
   keeping the runtime canvas composed rather than gridded. */
.bento-cell:has(> *) {
  background-color: var(--p-surface-800, #2a2a2a);
  border-radius: 4px;
}

/* Ghost cells (fillEmpty prototype) always show the fill so the
   grid structure is visible regardless of slot content. */
.bento-cell--ghost {
  background-color: var(--p-surface-800, #2a2a2a);
  border-radius: 4px;
  opacity: 0.6;
}
</style>
