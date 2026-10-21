import type { NodeId } from '@/types/nodeId'

const DEFAULT_TIDY_GAP = 12

export interface LayoutBox {
  id: NodeId
  x: number
  y: number
  width: number
  height: number
}

export interface BoxPosition {
  id: NodeId
  x: number
  y: number
}

type GapAxis = 'x' | 'y'

export type SelectionLayoutKind = 'row' | 'column' | 'grid' | 'scattered'

interface GridCell {
  box: LayoutBox
  row: number
  column: number
}

interface SelectionGrid {
  kind: SelectionLayoutKind
  cells: GridCell[]
  rowCount: number
  columnCount: number
}

interface AxisSpan {
  start: number
  size: number
}

interface Band {
  start: number
  minSize: number
  members: LayoutBox[]
}

const GRID_ALIGN_TOLERANCE = 16
const OVERLAP_TOLERANCE = 0.5

const crossAxisOf = (axis: GapAxis): GapAxis => (axis === 'x' ? 'y' : 'x')

const spanOf = (box: LayoutBox, axis: GapAxis): AxisSpan =>
  axis === 'x'
    ? { start: box.x, size: box.width }
    : { start: box.y, size: box.height }

const trackIndexOf = (cell: GridCell, axis: GapAxis): number =>
  axis === 'x' ? cell.column : cell.row

const lineIndexOf = (cell: GridCell, axis: GapAxis): number =>
  axis === 'x' ? cell.row : cell.column

const trackCountOf = (grid: SelectionGrid, axis: GapAxis): number =>
  axis === 'x' ? grid.columnCount : grid.rowCount

const joinsBand = (band: Band, { start, size }: AxisSpan): boolean => {
  const offset = start - band.start
  const centreInBand = offset + size / 2 <= band.minSize
  const nearbyStart = offset <= Math.min(band.minSize, size) / 2
  return centreInBand || nearbyStart
}

function clusterAlong(boxes: LayoutBox[], axis: GapAxis): LayoutBox[][] {
  const crossAxis = crossAxisOf(axis)
  const sorted = [...boxes].sort(
    (a, b) =>
      spanOf(a, axis).start - spanOf(b, axis).start ||
      spanOf(a, crossAxis).start - spanOf(b, crossAxis).start
  )
  const bands: Band[] = []
  for (const box of sorted) {
    const span = spanOf(box, axis)
    const band = bands.at(-1)
    if (band && joinsBand(band, span)) {
      band.members.push(box)
      if (span.size < band.minSize) {
        band.start = span.start
        band.minSize = span.size
      }
    } else {
      bands.push({ start: span.start, minSize: span.size, members: [box] })
    }
  }
  return bands.map((band) => band.members)
}

const cumulativeStarts = (counts: number[]): number[] =>
  counts.map((_, i) => counts.slice(0, i).reduce((sum, n) => sum + n, 0))

function assignCells(
  rows: LayoutBox[][],
  columns: LayoutBox[][]
): { cells: GridCell[]; columnCount: number } {
  const columnOf = new Map(
    columns.flatMap((members, column) =>
      members.map((box) => [box.id, column] as const)
    )
  )
  const occupancy = (row: LayoutBox[], column: number) =>
    row.filter((box) => columnOf.get(box.id) === column).length
  const splitWidths = columns.map((_, column) =>
    Math.max(1, ...rows.map((row) => occupancy(row, column)))
  )
  const firstSplit = cumulativeStarts(splitWidths)

  const cells = rows.flatMap((row, rowIndex) => {
    const used = new Map<number, number>()
    return [...row]
      .sort((a, b) => a.x - b.x)
      .map((box) => {
        const column = columnOf.get(box.id) ?? 0
        const split = used.get(column) ?? 0
        used.set(column, split + 1)
        return { box, row: rowIndex, column: firstSplit[column] + split }
      })
  })
  return { cells, columnCount: splitWidths.reduce((sum, n) => sum + n, 0) }
}

const spansOverlap = (a: AxisSpan, b: AxisSpan): boolean =>
  a.start < b.start + b.size - OVERLAP_TOLERANCE &&
  b.start < a.start + a.size - OVERLAP_TOLERANCE

const boxesIntersect = (a: LayoutBox, b: LayoutBox): boolean =>
  spansOverlap(spanOf(a, 'x'), spanOf(b, 'x')) &&
  spansOverlap(spanOf(a, 'y'), spanOf(b, 'y'))

const anyIntersect = (boxes: LayoutBox[]): boolean =>
  boxes.some((a, i) => boxes.slice(i + 1).some((b) => boxesIntersect(a, b)))

function neighbourPairs(
  cells: GridCell[],
  axis: GapAxis
): Array<[GridCell, GridCell]> {
  const keyOf = (line: number, track: number) => `${line}:${track}`
  const byPosition = new Map(
    cells.map((cell) => [
      keyOf(lineIndexOf(cell, axis), trackIndexOf(cell, axis)),
      cell
    ])
  )
  return cells.flatMap((cell): Array<[GridCell, GridCell]> => {
    const next = byPosition.get(
      keyOf(lineIndexOf(cell, axis), trackIndexOf(cell, axis) + 1)
    )
    return next ? [[cell, next]] : []
  })
}

function isAlignedAlong(
  cells: GridCell[],
  axis: GapAxis,
  count: number
): boolean {
  return Array.from({ length: count }, (_, index) =>
    cells
      .filter((cell) => trackIndexOf(cell, axis) === index)
      .map((cell) => spanOf(cell.box, axis).start)
  ).every(
    (starts) =>
      Math.max(...starts) - Math.min(...starts) <= GRID_ALIGN_TOLERANCE
  )
}

function classify(
  cells: GridCell[],
  rowCount: number,
  columnCount: number
): SelectionLayoutKind {
  if (cells.length < 2) return 'scattered'
  if (anyIntersect(cells.map((cell) => cell.box))) return 'scattered'
  if (rowCount === 1) return 'row'
  if (columnCount === 1) return 'column'
  const aligned =
    isAlignedAlong(cells, 'x', columnCount) &&
    isAlignedAlong(cells, 'y', rowCount)
  const linkedBothWays =
    neighbourPairs(cells, 'x').length > 0 &&
    neighbourPairs(cells, 'y').length > 0
  return aligned && linkedBothWays ? 'grid' : 'scattered'
}

/**
 * Groups boxes into rows and columns, keeping their order, and says whether
 * they read as a row, a column, an aligned grid or a scattered selection.
 */
export function detectSelectionGrid(boxes: LayoutBox[]): SelectionGrid {
  const rows = clusterAlong(boxes, 'y')
  const { cells, columnCount } = assignCells(rows, clusterAlong(boxes, 'x'))
  return {
    kind: classify(cells, rows.length, columnCount),
    cells,
    rowCount: rows.length,
    columnCount
  }
}

const topLeftCell = (cells: GridCell[]): GridCell =>
  cells.reduce((best, cell) =>
    cell.row < best.row || (cell.row === best.row && cell.column < best.column)
      ? cell
      : best
  )

const membersOf = (grid: SelectionGrid, axis: GapAxis, track: number) =>
  grid.cells.filter((cell) => trackIndexOf(cell, axis) === track)

const sizeAlong = (cell: GridCell, axis: GapAxis): number =>
  spanOf(cell.box, axis).size

const startAlong = (cell: GridCell, axis: GapAxis): number =>
  spanOf(cell.box, axis).start

function reachBefore(
  grid: SelectionGrid,
  axis: GapAxis,
  cell: GridCell,
  startOf: (cell: GridCell) => number
): number {
  const track = trackIndexOf(cell, axis)
  const previous = membersOf(grid, axis, track - 1)
  const pastPrevious =
    Math.min(...previous.map(startOf)) +
    Math.min(...previous.map((member) => sizeAlong(member, axis)))
  const pastLineNeighbours = grid.cells
    .filter(
      (other) =>
        lineIndexOf(other, axis) === lineIndexOf(cell, axis) &&
        trackIndexOf(other, axis) < track
    )
    .map((other) => startOf(other) + sizeAlong(other, axis))
  return Math.max(pastPrevious, ...pastLineNeighbours)
}

const laterTracks = (grid: SelectionGrid, axis: GapAxis): number[] =>
  Array.from(
    { length: Math.max(0, trackCountOf(grid, axis) - 1) },
    (_, i) => i + 1
  )

function packedOffsets(
  grid: SelectionGrid,
  axis: GapAxis,
  gap: number
): number[] {
  const offsets = [0]
  const offsetOf = (cell: GridCell) => offsets[trackIndexOf(cell, axis)]
  for (const track of laterTracks(grid, axis)) {
    const reach = Math.max(
      ...membersOf(grid, axis, track).map((cell) =>
        reachBefore(grid, axis, cell, offsetOf)
      )
    )
    offsets.push(reach + gap)
  }
  return offsets
}

const largestSizeOf = (grid: SelectionGrid, axis: GapAxis, track: number) =>
  Math.max(...membersOf(grid, axis, track).map((cell) => sizeAlong(cell, axis)))

function uniformOffsets(
  grid: SelectionGrid,
  axis: GapAxis,
  gap: number
): number[] {
  const offsets = [0]
  for (const track of laterTracks(grid, axis)) {
    offsets.push(
      offsets[track - 1] + largestSizeOf(grid, axis, track - 1) + gap
    )
  }
  return offsets
}

const trackStartOf = (grid: SelectionGrid, axis: GapAxis, track: number) =>
  Math.min(
    ...membersOf(grid, axis, track).map((cell) => startAlong(cell, axis))
  )

const packedGapsAlong = (grid: SelectionGrid, axis: GapAxis): number[] =>
  laterTracks(grid, axis).map((track) =>
    Math.min(
      ...membersOf(grid, axis, track).map(
        (cell) =>
          startAlong(cell, axis) -
          reachBefore(grid, axis, cell, (other) => startAlong(other, axis))
      )
    )
  )

const uniformGapsAlong = (grid: SelectionGrid, axis: GapAxis): number[] =>
  laterTracks(grid, axis).map(
    (track) =>
      trackStartOf(grid, axis, track) -
      trackStartOf(grid, axis, track - 1) -
      largestSizeOf(grid, axis, track - 1)
  )

function roundedMedian(values: number[]): number | undefined {
  if (values.length === 0) return undefined
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return Math.round(
    sorted.length % 2
      ? sorted[middle]
      : (sorted[middle - 1] + sorted[middle]) / 2
  )
}

const AXES = ['x', 'y'] as const

function crowds(a: LayoutBox, b: LayoutBox, gap: number): boolean {
  const grown = (span: AxisSpan): AxisSpan => ({
    start: span.start - gap,
    size: span.size + 2 * gap
  })
  return AXES.some((axis) => {
    const crossAxis = crossAxisOf(axis)
    return (
      spansOverlap(spanOf(a, crossAxis), spanOf(b, crossAxis)) &&
      spansOverlap(grown(spanOf(a, axis)), spanOf(b, axis))
    )
  })
}

function layoutOf(grid: SelectionGrid, gap: number): BoxPosition[] {
  const anchor = topLeftCell(grid.cells)
  const place = (offsetsAlong: (axis: GapAxis) => number[]): BoxPosition[] => {
    const startsAlong = (axis: GapAxis) => {
      const offsets = offsetsAlong(axis)
      const shift =
        startAlong(anchor, axis) - offsets[trackIndexOf(anchor, axis)]
      return offsets.map((offset) => offset + shift)
    }
    const columnX = startsAlong('x')
    const rowY = startsAlong('y')
    return grid.cells.map(({ box, row, column }) => ({
      id: box.id,
      x: columnX[column],
      y: rowY[row]
    }))
  }

  const packed = place((axis) => packedOffsets(grid, axis, gap))
  const packedBoxes = grid.cells.map(({ box }, i) => ({
    ...box,
    x: packed[i].x,
    y: packed[i].y
  }))
  const crowded = packedBoxes.some((a, i) =>
    packedBoxes.slice(i + 1).some((b) => crowds(a, b, gap))
  )
  return crowded ? place((axis) => uniformOffsets(grid, axis, gap)) : packed
}

const POSITION_TOLERANCE = 0.5

const isLaidOutAt = (grid: SelectionGrid, gap: number): boolean =>
  layoutOf(grid, gap).every(
    (position, i) =>
      Math.abs(position.x - grid.cells[i].box.x) <= POSITION_TOLERANCE &&
      Math.abs(position.y - grid.cells[i].box.y) <= POSITION_TOLERANCE
  )

function gapOf(grid: SelectionGrid): number {
  const packedGap = roundedMedian(
    AXES.flatMap((axis) => packedGapsAlong(grid, axis))
  )
  if (packedGap === undefined) return DEFAULT_TIDY_GAP
  const uniformGap = roundedMedian(
    AXES.flatMap((axis) => uniformGapsAlong(grid, axis))
  )
  const keptGap = [packedGap, uniformGap].find(
    (gap) => gap !== undefined && gap >= 0 && isLaidOutAt(grid, gap)
  )
  if (keptGap !== undefined) return keptGap
  return packedGap < 0 ? DEFAULT_TIDY_GAP : Math.max(0, packedGap)
}

const safeGapOf = (gap: number): number =>
  Number.isFinite(gap) ? Math.max(0, gap) : DEFAULT_TIDY_GAP

/**
 * Lines boxes up into their detected rows and columns: rows align by top,
 * columns by left, and nodes that face each other sit `gap` apart. The
 * top-left box stays put. Without `gap`, an already tidy selection keeps its gap.
 */
export function computeTidyLayout(
  boxes: LayoutBox[],
  gap?: number
): BoxPosition[] {
  if (boxes.length < 2) return []
  const grid = detectSelectionGrid(boxes)
  return layoutOf(grid, gap === undefined ? gapOf(grid) : safeGapOf(gap))
}
