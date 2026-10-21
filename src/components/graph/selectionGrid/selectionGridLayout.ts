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

const AXES = ['x', 'y'] as const
const GRID_ALIGN_TOLERANCE = 16
const OVERLAP_TOLERANCE = 0.5
const POSITION_TOLERANCE = 0.5

function crossAxisOf(axis: GapAxis): GapAxis {
  return axis === 'x' ? 'y' : 'x'
}

function spanOf(box: LayoutBox, axis: GapAxis): AxisSpan {
  return axis === 'x'
    ? { start: box.x, size: box.width }
    : { start: box.y, size: box.height }
}

function trackIndexOf(cell: GridCell, axis: GapAxis): number {
  return axis === 'x' ? cell.column : cell.row
}

function lineIndexOf(cell: GridCell, axis: GapAxis): number {
  return axis === 'x' ? cell.row : cell.column
}

function trackCountOf(grid: SelectionGrid, axis: GapAxis): number {
  return axis === 'x' ? grid.columnCount : grid.rowCount
}

function endOf({ start, size }: AxisSpan): number {
  return start + size
}

function longestAlong(boxes: LayoutBox[], axis: GapAxis): AxisSpan {
  return boxes
    .map((box) => spanOf(box, axis))
    .reduce((longest, span) => (span.size > longest.size ? span : longest))
}

function isStackedWith(a: LayoutBox, b: LayoutBox, crossAxis: GapAxis) {
  const spanA = spanOf(a, crossAxis)
  const spanB = spanOf(b, crossAxis)
  const overlap =
    Math.min(endOf(spanA), endOf(spanB)) - Math.max(spanA.start, spanB.start)
  return overlap >= Math.min(spanA.size, spanB.size) / 2
}

function joinsBand(
  members: LayoutBox[],
  box: LayoutBox,
  axis: GapAxis
): boolean {
  const crossAxis = crossAxisOf(axis)
  const { start, size } = spanOf(box, axis)
  const stacked = members.filter((member) =>
    isStackedWith(member, box, crossAxis)
  )
  const overlapsStacked = stacked.every(
    (member) => start < endOf(spanOf(member, axis)) - OVERLAP_TOLERANCE
  )
  const reference = longestAlong(stacked.length > 0 ? stacked : members, axis)
  const centreInReference = start + size / 2 <= endOf(reference)
  const nearbyStart =
    start - reference.start <= Math.min(reference.size, size) / 2
  return overlapsStacked && (centreInReference || nearbyStart)
}

function clusterAlong(boxes: LayoutBox[], axis: GapAxis): LayoutBox[][] {
  const crossAxis = crossAxisOf(axis)
  const sorted = [...boxes].sort(
    (a, b) =>
      spanOf(a, axis).start - spanOf(b, axis).start ||
      spanOf(a, crossAxis).start - spanOf(b, crossAxis).start
  )
  const bands: LayoutBox[][] = []
  for (const box of sorted) {
    const band = bands.at(-1)
    if (band && joinsBand(band, box, axis)) band.push(box)
    else bands.push([box])
  }
  return bands
}

function cumulativeStarts(counts: number[]): number[] {
  return counts.map((_, i) => counts.slice(0, i).reduce((sum, n) => sum + n, 0))
}

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

function spansOverlap(a: AxisSpan, b: AxisSpan): boolean {
  return (
    a.start < endOf(b) - OVERLAP_TOLERANCE &&
    b.start < endOf(a) - OVERLAP_TOLERANCE
  )
}

function boxesIntersect(a: LayoutBox, b: LayoutBox): boolean {
  return (
    spansOverlap(spanOf(a, 'x'), spanOf(b, 'x')) &&
    spansOverlap(spanOf(a, 'y'), spanOf(b, 'y'))
  )
}

function anyPair(
  boxes: LayoutBox[],
  matches: (a: LayoutBox, b: LayoutBox) => boolean
): boolean {
  return boxes.some((a, i) => boxes.slice(i + 1).some((b) => matches(a, b)))
}

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
  if (
    anyPair(
      cells.map((cell) => cell.box),
      boxesIntersect
    )
  )
    return 'scattered'
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

function hasUsableGeometry({ x, y, width, height }: LayoutBox): boolean {
  return [x, y, width, height].every(Number.isFinite) && width > 0 && height > 0
}

/**
 * Groups boxes that have a finite position and a positive size into rows and
 * columns, and says whether they form a row, column, aligned grid or scatter.
 */
export function detectSelectionGrid(boxes: LayoutBox[]): SelectionGrid {
  const placed = boxes.filter(hasUsableGeometry)
  const rows = clusterAlong(placed, 'y')
  const { cells, columnCount } = assignCells(rows, clusterAlong(placed, 'x'))
  return {
    kind: classify(cells, rows.length, columnCount),
    cells,
    rowCount: rows.length,
    columnCount
  }
}

function topLeftCell(cells: GridCell[]): GridCell {
  return cells.reduce((best, cell) =>
    cell.row < best.row || (cell.row === best.row && cell.column < best.column)
      ? cell
      : best
  )
}

function membersOf(
  grid: SelectionGrid,
  axis: GapAxis,
  track: number
): GridCell[] {
  return grid.cells.filter((cell) => trackIndexOf(cell, axis) === track)
}

function sizeAlong(cell: GridCell, axis: GapAxis): number {
  return spanOf(cell.box, axis).size
}

function startAlong(cell: GridCell, axis: GapAxis): number {
  return spanOf(cell.box, axis).start
}

function reachBefore(
  grid: SelectionGrid,
  axis: GapAxis,
  cell: GridCell,
  startOf: (cell: GridCell) => number
): number {
  const track = trackIndexOf(cell, axis)
  const previous = membersOf(grid, axis, track - 1)
  const pastPrevious = Math.min(
    ...previous.map((member) => startOf(member) + sizeAlong(member, axis))
  )
  const pastLineNeighbours = grid.cells
    .filter(
      (other) =>
        lineIndexOf(other, axis) === lineIndexOf(cell, axis) &&
        trackIndexOf(other, axis) < track
    )
    .map((other) => startOf(other) + sizeAlong(other, axis))
  return Math.max(pastPrevious, ...pastLineNeighbours)
}

function laterTracks(grid: SelectionGrid, axis: GapAxis): number[] {
  return Array.from(
    { length: Math.max(0, trackCountOf(grid, axis) - 1) },
    (_, i) => i + 1
  )
}

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

function largestSizeOf(
  grid: SelectionGrid,
  axis: GapAxis,
  track: number
): number {
  return Math.max(
    ...membersOf(grid, axis, track).map((cell) => sizeAlong(cell, axis))
  )
}

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

function trackStartOf(
  grid: SelectionGrid,
  axis: GapAxis,
  track: number
): number {
  return Math.min(
    ...membersOf(grid, axis, track).map((cell) => startAlong(cell, axis))
  )
}

function packedGapsAlong(grid: SelectionGrid, axis: GapAxis): number[] {
  return laterTracks(grid, axis).map((track) =>
    Math.min(
      ...membersOf(grid, axis, track).map(
        (cell) =>
          startAlong(cell, axis) -
          reachBefore(grid, axis, cell, (other) => startAlong(other, axis))
      )
    )
  )
}

function uniformGapsAlong(grid: SelectionGrid, axis: GapAxis): number[] {
  return laterTracks(grid, axis).map(
    (track) =>
      trackStartOf(grid, axis, track) -
      trackStartOf(grid, axis, track - 1) -
      largestSizeOf(grid, axis, track - 1)
  )
}

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

function placeCells(
  grid: SelectionGrid,
  offsetsAlong: (axis: GapAxis) => number[]
): BoxPosition[] {
  const anchor = topLeftCell(grid.cells)
  const startsAlong = (axis: GapAxis) => {
    const offsets = offsetsAlong(axis)
    const shift = startAlong(anchor, axis) - offsets[trackIndexOf(anchor, axis)]
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

function readsAsSameGrid(grid: SelectionGrid, boxes: LayoutBox[]): boolean {
  const reread = detectSelectionGrid(boxes)
  const cellOf = new Map(reread.cells.map((cell) => [cell.box.id, cell]))
  return (
    reread.rowCount === grid.rowCount &&
    reread.columnCount === grid.columnCount &&
    grid.cells.every(({ box, row, column }) => {
      const cell = cellOf.get(box.id)
      return cell?.row === row && cell.column === column
    })
  )
}

function layoutOf(grid: SelectionGrid, gap: number): BoxPosition[] {
  const packed = placeCells(grid, (axis) => packedOffsets(grid, axis, gap))
  const packedBoxes = grid.cells.map(({ box }, i) => ({ ...box, ...packed[i] }))
  const keepsPacking =
    !anyPair(packedBoxes, (a, b) => crowds(a, b, gap)) &&
    readsAsSameGrid(grid, packedBoxes)
  return keepsPacking
    ? packed
    : placeCells(grid, (axis) => uniformOffsets(grid, axis, gap))
}

function isLaidOutAt(grid: SelectionGrid, gap: number): boolean {
  return layoutOf(grid, gap).every(
    (position, i) =>
      Math.abs(position.x - grid.cells[i].box.x) <= POSITION_TOLERANCE &&
      Math.abs(position.y - grid.cells[i].box.y) <= POSITION_TOLERANCE
  )
}

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
  return packedGap < 0 ? DEFAULT_TIDY_GAP : packedGap
}

function safeGapOf(gap: number): number {
  return Number.isFinite(gap) ? Math.max(0, gap) : DEFAULT_TIDY_GAP
}

function isFinitePosition({ x, y }: BoxPosition): boolean {
  return Number.isFinite(x) && Number.isFinite(y)
}

/**
 * Lines boxes up into rows and columns with facing nodes `gap` apart and the
 * top-left box in place; without `gap`, a tidy selection keeps its own gap.
 * Returns nothing when a position would not be finite.
 */
export function computeTidyLayout(
  boxes: LayoutBox[],
  gap?: number
): BoxPosition[] {
  const grid = detectSelectionGrid(boxes)
  if (grid.cells.length < 2) return []
  const positions = layoutOf(
    grid,
    gap === undefined ? gapOf(grid) : safeGapOf(gap)
  )
  return positions.every(isFinitePosition) ? positions : []
}
