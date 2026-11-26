import type {
  CompassCorners,
  Point2D,
  ReadOnlyRect,
  Size2D
} from '@comfyorg/shared-frontend-utils/geometry'

import { ALIGNED_EPSILON } from './arrange'
import type { Axis, VisualBox } from './arrange'
import { hasNorthEdge, hasWestEdge } from './cornerResize'

export interface ResizeEdges {
  x?: 'left' | 'right'
  y?: 'top' | 'bottom'
}

type XAnchor = 'left' | 'center' | 'right'
type YAnchor = 'top' | 'body' | 'middle' | 'bottom'
type Anchor = XAnchor | YAnchor

type SnapKind = 'wire' | 'spacing' | 'edge'

export interface WireAnchor {
  mine: Point2D
  theirs: Point2D
}

export type SmartGuide =
  | { kind: 'line'; axis: Axis; at: number; from: number; to: number }
  | { kind: 'wire'; from: Point2D; to: Point2D }
  | {
      kind: 'gap'
      axis: Axis
      from: number
      to: number
      cross: number
    }

interface SnapLine {
  anchor: Anchor
  axis: Axis
  guides: (box: VisualBox) => SmartGuide[]
  kind: SnapKind
  value: number
  alignedWith?: VisualBox
  isValid?: (box: VisualBox) => boolean
}

type LineBuckets = Map<number, SnapLine[]>
type AnchorLines = Partial<Record<Anchor, LineBuckets>>

export interface SnapOptions {
  edges: boolean
  gap: number
  spacing: boolean
  wires: boolean
}

export interface SnapThreshold {
  enter: number
  exit: number
}

export type SnapAttachment = Partial<Record<Axis, SnapLine>>

/** Snap lines per axis, grouped by the moving box's anchor and bucketed by value. */
export interface SnapIndex {
  lines: Record<Axis, AnchorLines>
}

interface SnapFrame {
  threshold: SnapThreshold
  attachment?: SnapAttachment
}

const KIND_PRIORITY: Record<SnapKind, number> = {
  wire: 3,
  spacing: 2,
  edge: 1
}

const SPACING_NEIGHBOR_SCAN = 64
const LINE_BUCKET_SIZE = 64

function right(b: VisualBox) {
  return b.x + b.width
}
function bottom(b: VisualBox) {
  return b.y + b.height
}
function bodyTop(b: VisualBox) {
  return b.y + b.titleHeight
}

function anchorValue(box: VisualBox, anchor: Anchor): number {
  switch (anchor) {
    case 'left':
      return box.x
    case 'center':
      return box.x + box.width / 2
    case 'right':
      return right(box)
    case 'top':
      return box.y
    case 'body':
      return bodyTop(box)
    case 'middle':
      return box.y + box.height / 2
    case 'bottom':
      return bottom(box)
  }
}

function crossRange(box: VisualBox, axis: Axis): [number, number] {
  return axis === 'x' ? [box.y, bottom(box)] : [box.x, right(box)]
}

function overlapsAcross(a: VisualBox, b: VisualBox, axis: Axis): boolean {
  return axis === 'x'
    ? a.y < bottom(b) && b.y < bottom(a)
    : a.x < right(b) && b.x < right(a)
}

function crossDistance(a: VisualBox, b: VisualBox, axis: Axis): number {
  const [a0, a1] = crossRange(a, axis)
  const [b0, b1] = crossRange(b, axis)
  return Math.max(0, a0 - b1, b0 - a1)
}

function spanLine(
  axis: Axis,
  at: number,
  a: VisualBox,
  b: VisualBox
): SmartGuide {
  const [a0, a1] = crossRange(a, axis)
  const [b0, b1] = crossRange(b, axis)
  return {
    kind: 'line',
    axis,
    at: Math.round(at * 2) / 2,
    from: Math.min(a0, b0),
    to: Math.max(a1, b1)
  }
}

function gapGuide(axis: Axis, first: VisualBox, second: VisualBox): SmartGuide {
  const [a0, a1] = crossRange(first, axis)
  const [b0, b1] = crossRange(second, axis)
  const from = axis === 'x' ? right(first) : bottom(first)
  const to = axis === 'x' ? second.x : second.y
  return {
    kind: 'gap',
    axis,
    from,
    to,
    cross: (Math.max(a0, b0) + Math.min(a1, b1)) / 2
  }
}

function orderedAlong(
  a: VisualBox,
  b: VisualBox,
  axis: Axis
): [VisualBox, VisualBox] {
  return (axis === 'x' ? a.x <= b.x : a.y <= b.y) ? [a, b] : [b, a]
}

function addEdgeLines(
  add: (line: SnapLine) => void,
  target: VisualBox,
  gap: number
) {
  function align(axis: Axis, anchor: Anchor, value: number) {
    add({
      axis,
      anchor,
      value,
      kind: 'edge',
      alignedWith: target,
      guides: (box) => [spanLine(axis, value, box, target)]
    })
  }
  function abut(axis: Axis, anchor: Anchor, value: number) {
    add({
      axis,
      anchor,
      value,
      kind: 'edge',
      isValid: (box) => overlapsAcross(box, target, axis),
      guides: (box) => [
        gap === 0
          ? spanLine(axis, value, box, target)
          : gapGuide(axis, ...orderedAlong(box, target, axis))
      ]
    })
  }

  align('x', 'left', target.x)
  align('x', 'right', right(target))
  align('x', 'center', target.x + target.width / 2)
  abut('x', 'left', right(target) + gap)
  abut('x', 'right', target.x - gap)
  align('y', 'body', bodyTop(target))
  align('y', 'bottom', bottom(target))
  align('y', 'middle', target.y + target.height / 2)
  abut('y', 'top', bottom(target) + gap)
  abut('y', 'bottom', target.y - gap)
}

function addSpacingLinesFor(
  add: (line: SnapLine) => void,
  first: VisualBox,
  second: VisualBox,
  axis: Axis
) {
  const start = axis === 'x' ? 'left' : 'top'
  const end = axis === 'x' ? 'right' : 'bottom'
  const center = axis === 'x' ? 'center' : 'middle'
  const firstEnd = anchorValue(first, end)
  const secondStart = anchorValue(second, start)
  const room = secondStart - firstEnd
  if (room <= 0) return

  function overlapsBoth(box: VisualBox) {
    return overlapsAcross(box, first, axis) && overlapsAcross(box, second, axis)
  }
  function size(box: VisualBox) {
    return axis === 'x' ? box.width : box.height
  }

  add({
    axis,
    anchor: center,
    value: (firstEnd + secondStart) / 2,
    kind: 'spacing',
    isValid: (box) => size(box) < room && overlapsBoth(box),
    guides: (box) => [gapGuide(axis, first, box), gapGuide(axis, box, second)]
  })
  add({
    axis,
    anchor: start,
    value: anchorValue(second, end) + room,
    kind: 'spacing',
    isValid: (box) => overlapsAcross(box, second, axis),
    guides: (box) => [
      gapGuide(axis, first, second),
      gapGuide(axis, second, box)
    ]
  })
  add({
    axis,
    anchor: end,
    value: anchorValue(first, start) - room,
    kind: 'spacing',
    isValid: (box) => overlapsAcross(box, first, axis),
    guides: (box) => [gapGuide(axis, box, first), gapGuide(axis, first, second)]
  })
}

function nextAlong(
  sorted: VisualBox[],
  i: number,
  axis: Axis
): VisualBox | undefined {
  const first = sorted[i]
  const firstEnd = anchorValue(first, axis === 'x' ? 'right' : 'bottom')
  const last = Math.min(sorted.length, i + 1 + SPACING_NEIGHBOR_SCAN)
  for (let j = i + 1; j < last; j++) {
    const box = sorted[j]
    if (
      overlapsAcross(first, box, axis) &&
      anchorValue(box, axis === 'x' ? 'left' : 'top') >= firstEnd
    )
      return box
  }
}

function addSpacingLines(add: (line: SnapLine) => void, targets: VisualBox[]) {
  for (const axis of ['x', 'y'] as const) {
    const sorted = targets.toSorted(
      axis === 'x' ? (a, b) => a.x - b.x : (a, b) => a.y - b.y
    )
    for (const [i, first] of sorted.entries()) {
      const next = nextAlong(sorted, i, axis)
      if (next) addSpacingLinesFor(add, first, next, axis)
    }
  }
}

function wireLines(movingStart: VisualBox, wires: WireAnchor[]): SnapLine[] {
  return wires.map((wire) => {
    const offset = {
      x: wire.mine.x - movingStart.x,
      y: wire.mine.y - movingStart.y
    }
    return {
      axis: 'y',
      anchor: 'top',
      value: wire.theirs.y - offset.y,
      kind: 'wire',
      guides: (box) => [
        {
          kind: 'wire',
          from: wire.theirs,
          to: { x: box.x + offset.x, y: box.y + offset.y }
        }
      ]
    }
  })
}

export function buildSnapIndex(
  targets: VisualBox[],
  options: SnapOptions,
  wiring?: { movingStart: VisualBox; wires: WireAnchor[] }
): SnapIndex {
  const lines: SnapIndex['lines'] = { x: {}, y: {} }
  function add(line: SnapLine) {
    const buckets = (lines[line.axis][line.anchor] ??= new Map())
    const bucket = bucketOf(line.value)
    const sharing = buckets.get(bucket)
    if (sharing) sharing.push(line)
    else buckets.set(bucket, [line])
  }
  if (options.edges)
    for (const target of targets) addEdgeLines(add, target, options.gap)
  if (options.spacing) addSpacingLines(add, targets)
  if (options.wires && wiring)
    wireLines(wiring.movingStart, wiring.wires).forEach(add)
  return { lines }
}

function bucketOf(value: number): number {
  return Math.floor(value / LINE_BUCKET_SIZE)
}

function* linesWithin(
  buckets: LineBuckets | undefined,
  value: number,
  reach: number
): Generator<SnapLine> {
  if (!buckets) return
  const first = bucketOf(value - reach)
  const span = bucketOf(value + reach) - first
  for (let step = 0; step <= span; step++)
    for (const line of buckets.get(first + step) ?? [])
      if (Math.abs(line.value - value) <= reach) yield line
}

interface Candidate {
  delta: number
  line: SnapLine
}

type ApplyDelta = (box: VisualBox, axis: Axis, delta: number) => VisualBox
type Fits = (box: VisualBox) => boolean

function candidatesFor(
  lines: AnchorLines,
  box: VisualBox,
  anchors: readonly Anchor[],
  reach: number,
  apply: ApplyDelta,
  fits: Fits
): Candidate[] {
  const candidates: Candidate[] = []
  for (const anchor of anchors) {
    const at = anchorValue(box, anchor)
    for (const line of linesWithin(lines[anchor], at, reach)) {
      const delta = line.value - at
      const next = apply(box, line.axis, delta)
      if (!fits(next) || (line.isValid && !line.isValid(next))) continue
      candidates.push({ line, delta })
    }
  }
  return candidates
}

function moved(box: VisualBox, axis: Axis, delta: number): VisualBox {
  return axis === 'x'
    ? { ...box, x: box.x + delta }
    : { ...box, y: box.y + delta }
}

function better(a: Candidate, b: Candidate): Candidate {
  const priority = KIND_PRIORITY[a.line.kind] - KIND_PRIORITY[b.line.kind]
  if (priority !== 0) return priority > 0 ? a : b
  return Math.abs(b.delta) < Math.abs(a.delta) ? b : a
}

function pick(
  candidates: Candidate[],
  threshold: SnapThreshold,
  attached: SnapLine | undefined
): Candidate | undefined {
  const entering = candidates.filter(
    (c) => Math.abs(c.delta) <= threshold.enter
  )
  const best = entering.length ? entering.reduce(better) : undefined
  const held = candidates.find((c) => c.line === attached)
  if (!held) return best
  if (best && KIND_PRIORITY[best.line.kind] > KIND_PRIORITY[held.line.kind])
    return best
  return held
}

const MOVE_ANCHORS: Record<Axis, readonly Anchor[]> = {
  x: ['left', 'center', 'right'],
  y: ['top', 'body', 'middle', 'bottom']
}

export interface SnapResult {
  attachment: SnapAttachment
  box: VisualBox
  guides: SmartGuide[]
}

function nearestAlignment(
  index: SnapIndex,
  line: SnapLine,
  target: VisualBox,
  box: VisualBox
): SnapLine {
  let nearest = line
  let nearestDistance = crossDistance(box, target, line.axis)
  const sameValue = linesWithin(
    index.lines[line.axis][line.anchor],
    line.value,
    ALIGNED_EPSILON
  )
  for (const other of sameValue) {
    if (!other.alignedWith) continue
    const distance = crossDistance(box, other.alignedWith, line.axis)
    if (distance < nearestDistance)
      [nearest, nearestDistance] = [other, distance]
  }
  return nearest
}

function winnerGuides(
  index: SnapIndex,
  { line }: Candidate,
  box: VisualBox
): SmartGuide[] {
  const shown = line.alignedWith
    ? nearestAlignment(index, line, line.alignedWith, box)
    : line
  return shown.guides(box)
}

function holdsAt(winner: Candidate, box: VisualBox) {
  return !winner.line.isValid || winner.line.isValid(box)
}

function solve(
  index: SnapIndex,
  box: VisualBox,
  { threshold, attachment = {} }: SnapFrame,
  anchors: Record<Axis, readonly Anchor[]>,
  apply: ApplyDelta,
  fits: Fits = () => true
): SnapResult {
  let snapped = box
  const winners: Partial<Record<Axis, Candidate>> = {}
  function pickFor(axis: Axis, rejected?: SnapLine) {
    const candidates = candidatesFor(
      index.lines[axis],
      snapped,
      anchors[axis],
      threshold.exit,
      apply,
      fits
    ).filter((c) => c.line !== rejected)
    const winner = pick(candidates, threshold, attachment[axis])
    if (!winner) return
    snapped = apply(snapped, axis, winner.delta)
    winners[axis] = winner
  }
  pickFor('x')
  pickFor('y')

  const stale = winners.x
  if (stale && !holdsAt(stale, snapped)) {
    snapped = apply(snapped, 'x', -stale.delta)
    delete winners.x
    pickFor('x', stale.line)
    if (winners.y && !holdsAt(winners.y, snapped)) {
      snapped = apply(snapped, 'y', -winners.y.delta)
      delete winners.y
    }
  }

  const chosen = [winners.x, winners.y].filter((w) => w !== undefined)
  const nextAttachment: SnapAttachment = {}
  if (winners.x) nextAttachment.x = winners.x.line
  if (winners.y) nextAttachment.y = winners.y.line

  const guides = chosen.flatMap((w) => winnerGuides(index, w, snapped))
  return { box: snapped, attachment: nextAttachment, guides }
}

/** Snaps a moving box: returns the snapped box, the attachment to feed back next frame, and guides to draw. */
export function snapMove(
  index: SnapIndex,
  box: VisualBox,
  frame: SnapFrame
): SnapResult {
  return solve(index, box, frame, MOVE_ANCHORS, moved)
}

const RESIZE_ANCHORS = {
  left: ['left'],
  right: ['right'],
  top: ['top', 'body'],
  bottom: ['bottom']
} as const satisfies Record<string, readonly Anchor[]>

function resizedEdge(edges: ResizeEdges): ApplyDelta {
  return (box, axis, delta) => {
    if (axis === 'x') {
      return edges.x === 'left'
        ? { ...box, x: box.x + delta, width: box.width - delta }
        : { ...box, width: box.width + delta }
    }
    return edges.y === 'top'
      ? { ...box, y: box.y + delta, height: box.height - delta }
      : { ...box, height: box.height + delta }
  }
}

/** Snaps the dragged edges of a resizing box, rejecting snaps that would shrink it below `min`. */
export function snapResize(
  index: SnapIndex,
  box: VisualBox,
  edges: ResizeEdges,
  frame: SnapFrame,
  min: Size2D = { width: 0, height: 0 }
): SnapResult {
  const anchors = {
    x: edges.x ? RESIZE_ANCHORS[edges.x] : [],
    y: edges.y ? RESIZE_ANCHORS[edges.y] : []
  }
  return solve(
    index,
    box,
    frame,
    anchors,
    resizedEdge(edges),
    (next) => next.width >= min.width && next.height >= min.height
  )
}

const SEARCH_MARGIN = 0.5
const EXIT_RATIO = 14 / 8

/** The area to collect snap targets from: the visible area grown by half its size on every side. */
export function snapSearchArea([
  x,
  y,
  width,
  height
]: ReadOnlyRect): ReadOnlyRect {
  const mx = width * SEARCH_MARGIN
  const my = height * SEARCH_MARGIN
  return [x - mx, y - my, width + 2 * mx, height + 2 * my]
}

/** Enter and exit distances in canvas units for a screen-pixel `distance` at zoom `scale`. */
export function thresholdAt(scale: number, distance: number): SnapThreshold {
  const zoom = scale || 1
  return {
    enter: distance / zoom,
    exit: Math.round(distance * EXIT_RATIO) / zoom
  }
}

/** The box edges a drag of `corner` moves. */
export function resizeEdgesOf(corner: CompassCorners): ResizeEdges {
  return {
    x: hasWestEdge(corner) ? 'left' : 'right',
    y: hasNorthEdge(corner) ? 'top' : 'bottom'
  }
}
