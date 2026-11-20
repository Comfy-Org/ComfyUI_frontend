import type { Bounds, Point2D } from '@comfyorg/shared-frontend-utils/geometry'

export type Axis = 'x' | 'y'

/** A visual box in canvas units; `titleHeight` is the title band above the body. */
export interface SnapBox extends Bounds {
  titleHeight: number
}

export interface ResizeEdges {
  x?: 'left' | 'right'
  y?: 'top' | 'bottom'
}

type XAnchor = 'left' | 'center' | 'right'
type YAnchor = 'top' | 'body' | 'middle' | 'bottom'
type Anchor = XAnchor | YAnchor

type SnapKind = 'wire' | 'spacing' | 'edge'

export interface WireAnchor {
  theirs: Point2D
  mine: Point2D
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
  key: string
  axis: Axis
  anchor: Anchor
  value: number
  kind: SnapKind
  isValid?: (box: SnapBox) => boolean
  guides: (box: SnapBox) => SmartGuide[]
}

export interface SnapOptions {
  edges: boolean
  wires: boolean
  spacing: boolean
  gap: number
}

export interface SnapThreshold {
  enter: number
  exit: number
}

export type SnapAttachment = Partial<Record<Axis, string>>

export interface SnapIndex {
  lines: Record<Axis, SnapLine[]>
  targets: SnapBox[]
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

export const ALIGNED_EPSILON = 0.5
const MAX_SPACING_TARGETS = 400

const right = (b: SnapBox) => b.x + b.width
const bottom = (b: SnapBox) => b.y + b.height
const bodyTop = (b: SnapBox) => b.y + b.titleHeight

function anchorValue(box: SnapBox, anchor: Anchor): number {
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

function crossRange(box: SnapBox, axis: Axis): [number, number] {
  return axis === 'x' ? [box.y, bottom(box)] : [box.x, right(box)]
}

function overlapsAcross(a: SnapBox, b: SnapBox, axis: Axis): boolean {
  const [a0, a1] = crossRange(a, axis)
  const [b0, b1] = crossRange(b, axis)
  return a0 < b1 && b0 < a1
}

function spanLine(axis: Axis, at: number, boxes: SnapBox[]): SmartGuide {
  const ranges = boxes.map((b) => crossRange(b, axis))
  return {
    kind: 'line',
    axis,
    at,
    from: Math.min(...ranges.map(([start]) => start)),
    to: Math.max(...ranges.map(([, end]) => end))
  }
}

function gapGuide(axis: Axis, first: SnapBox, second: SnapBox): SmartGuide {
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

function orderedAlong(a: SnapBox, b: SnapBox, axis: Axis): [SnapBox, SnapBox] {
  return (axis === 'x' ? a.x <= b.x : a.y <= b.y) ? [a, b] : [b, a]
}

function edgeLines(target: SnapBox, id: string, gap: number): SnapLine[] {
  const align = (
    axis: Axis,
    anchor: Anchor,
    value: number,
    name: string
  ): SnapLine => ({
    key: `${id}:${name}`,
    axis,
    anchor,
    value,
    kind: 'edge',
    guides: () => []
  })
  const abut = (
    axis: Axis,
    anchor: Anchor,
    value: number,
    name: string
  ): SnapLine => ({
    key: `${id}:${name}`,
    axis,
    anchor,
    value,
    kind: 'edge',
    isValid: (box) => overlapsAcross(box, target, axis),
    guides: (box) => [gapGuide(axis, ...orderedAlong(box, target, axis))]
  })

  return [
    align('x', 'left', target.x, 'left'),
    align('x', 'right', right(target), 'right'),
    align('x', 'center', target.x + target.width / 2, 'center'),
    abut('x', 'left', right(target) + gap, 'rightOf'),
    abut('x', 'right', target.x - gap, 'leftOf'),
    align('y', 'body', bodyTop(target), 'body'),
    align('y', 'bottom', bottom(target), 'bottom'),
    align('y', 'middle', target.y + target.height / 2, 'middle'),
    abut('y', 'top', bottom(target) + gap, 'below'),
    abut('y', 'bottom', target.y - gap, 'above')
  ]
}

function spacingLinesFor(
  first: SnapBox,
  second: SnapBox,
  key: string,
  axis: Axis
): SnapLine[] {
  const start = axis === 'x' ? 'left' : 'top'
  const end = axis === 'x' ? 'right' : 'bottom'
  const center = axis === 'x' ? 'center' : 'middle'
  const firstEnd = anchorValue(first, end)
  const secondStart = anchorValue(second, start)
  const room = secondStart - firstEnd
  if (room <= 0) return []

  const overlapsBoth = (box: SnapBox) =>
    overlapsAcross(box, first, axis) && overlapsAcross(box, second, axis)
  const size = (box: SnapBox) => (axis === 'x' ? box.width : box.height)

  return [
    {
      key: `${key}:fill`,
      axis,
      anchor: center,
      value: (firstEnd + secondStart) / 2,
      kind: 'spacing',
      isValid: (box) => size(box) < room && overlapsBoth(box),
      guides: (box) => [gapGuide(axis, first, box), gapGuide(axis, box, second)]
    },
    {
      key: `${key}:after`,
      axis,
      anchor: start,
      value: anchorValue(second, end) + room,
      kind: 'spacing',
      isValid: (box) => overlapsAcross(box, second, axis),
      guides: (box) => [
        gapGuide(axis, first, second),
        gapGuide(axis, second, box)
      ]
    },
    {
      key: `${key}:before`,
      axis,
      anchor: end,
      value: anchorValue(first, start) - room,
      kind: 'spacing',
      isValid: (box) => overlapsAcross(box, first, axis),
      guides: (box) => [
        gapGuide(axis, box, first),
        gapGuide(axis, first, second)
      ]
    }
  ]
}

function spacingLines(targets: SnapBox[]): SnapLine[] {
  if (targets.length > MAX_SPACING_TARGETS) return []
  const lines: SnapLine[] = []
  for (const axis of ['x', 'y'] as const) {
    const sorted = targets
      .map((box, index) => ({ box, index }))
      .sort(
        (a, b) =>
          anchorValue(a.box, axis === 'x' ? 'left' : 'top') -
          anchorValue(b.box, axis === 'x' ? 'left' : 'top')
      )
    for (const [i, { box: first, index }] of sorted.entries()) {
      const next = sorted
        .slice(i + 1)
        .find(
          ({ box }) =>
            overlapsAcross(first, box, axis) &&
            anchorValue(box, axis === 'x' ? 'left' : 'top') >=
              anchorValue(first, axis === 'x' ? 'right' : 'bottom')
        )
      if (!next) continue
      lines.push(
        ...spacingLinesFor(
          first,
          next.box,
          `s${axis}${index}-${next.index}`,
          axis
        )
      )
    }
  }
  return lines
}

function wireLines(movingStart: SnapBox, wires: WireAnchor[]): SnapLine[] {
  return wires.map((wire, index) => {
    const offset = {
      x: wire.mine.x - movingStart.x,
      y: wire.mine.y - movingStart.y
    }
    return {
      key: `w${index}`,
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
  targets: SnapBox[],
  options: SnapOptions,
  wiring?: { movingStart: SnapBox; wires: WireAnchor[] }
): SnapIndex {
  const all = [
    ...(options.edges
      ? targets.flatMap((target, i) => edgeLines(target, `t${i}`, options.gap))
      : []),
    ...(options.spacing ? spacingLines(targets) : []),
    ...(options.wires && wiring
      ? wireLines(wiring.movingStart, wiring.wires)
      : [])
  ]
  return {
    lines: {
      x: all.filter((line) => line.axis === 'x'),
      y: all.filter((line) => line.axis === 'y')
    },
    targets
  }
}

interface Candidate {
  line: SnapLine
  delta: number
}

type ApplyDelta = (box: SnapBox, axis: Axis, delta: number) => SnapBox

function candidatesFor(
  lines: SnapLine[],
  box: SnapBox,
  anchors: readonly Anchor[],
  reach: number,
  apply: ApplyDelta
): Candidate[] {
  const candidates: Candidate[] = []
  for (const line of lines) {
    if (!anchors.includes(line.anchor)) continue
    const delta = line.value - anchorValue(box, line.anchor)
    if (Math.abs(delta) > reach) continue
    if (line.isValid && !line.isValid(apply(box, line.axis, delta))) continue
    candidates.push({ line, delta })
  }
  return candidates
}

function moved(box: SnapBox, axis: Axis, delta: number): SnapBox {
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
  attachedKey: string | undefined
): Candidate | undefined {
  const entering = candidates.filter(
    (c) => Math.abs(c.delta) <= threshold.enter
  )
  const best = entering.length ? entering.reduce(better) : undefined
  const attached = candidates.find((c) => c.line.key === attachedKey)
  if (!attached) return best
  if (best && KIND_PRIORITY[best.line.kind] > KIND_PRIORITY[attached.line.kind])
    return best
  return attached
}

const MOVE_ANCHORS: Record<Axis, readonly Anchor[]> = {
  x: ['left', 'center', 'right'],
  y: ['top', 'body', 'middle', 'bottom']
}

export interface SnapResult {
  box: SnapBox
  attachment: SnapAttachment
  guides: SmartGuide[]
}

const ALIGNABLE: Record<Anchor, readonly Anchor[]> = {
  left: ['left', 'right'],
  right: ['left', 'right'],
  center: ['center'],
  top: ['bottom'],
  body: ['body'],
  middle: ['middle'],
  bottom: ['top', 'bottom']
}

function alignedGuides(
  box: SnapBox,
  targets: SnapBox[],
  anchors: Record<Axis, readonly Anchor[]>
): SmartGuide[] {
  const guides: SmartGuide[] = []
  for (const axis of ['x', 'y'] as const) {
    const aligned = new Map<number, SnapBox[]>()
    for (const anchor of anchors[axis]) {
      const value = anchorValue(box, anchor)
      for (const target of targets) {
        const matches = ALIGNABLE[anchor].some(
          (other) =>
            Math.abs(anchorValue(target, other) - value) <= ALIGNED_EPSILON
        )
        if (!matches) continue
        const at = Math.round(value * 2) / 2
        aligned.set(at, [...(aligned.get(at) ?? [box]), target])
      }
    }
    for (const [at, boxes] of aligned) guides.push(spanLine(axis, at, boxes))
  }
  return guides
}

function solve(
  index: SnapIndex,
  box: SnapBox,
  { threshold, attachment = {} }: SnapFrame,
  anchors: Record<Axis, readonly Anchor[]>,
  apply: ApplyDelta
): SnapResult {
  let snapped = box
  const nextAttachment: SnapAttachment = {}
  const winners: Candidate[] = []
  for (const axis of ['x', 'y'] as const) {
    const candidates = candidatesFor(
      index.lines[axis],
      snapped,
      anchors[axis],
      threshold.exit,
      apply
    )
    const winner = pick(candidates, threshold, attachment[axis])
    if (!winner) continue
    snapped = apply(snapped, axis, winner.delta)
    nextAttachment[axis] = winner.line.key
    winners.push(winner)
  }

  const flatWires = index.lines.y.filter(
    (line) =>
      line.kind === 'wire' &&
      Math.abs(line.value - snapped.y) <= ALIGNED_EPSILON
  )
  const guides = [
    ...alignedGuides(snapped, index.targets, anchors),
    ...winners.flatMap((w) =>
      w.line.kind === 'wire' ? [] : w.line.guides(snapped)
    ),
    ...flatWires.flatMap((line) => line.guides(snapped))
  ]
  return { box: snapped, attachment: nextAttachment, guides }
}

/** Snaps a moving box: returns the snapped box, the attachment to feed back next frame, and guides to draw. */
export function snapMove(
  index: SnapIndex,
  box: SnapBox,
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

export function snapResize(
  index: SnapIndex,
  box: SnapBox,
  edges: ResizeEdges,
  frame: SnapFrame
): SnapResult {
  const anchors = {
    x: edges.x ? RESIZE_ANCHORS[edges.x] : [],
    y: edges.y ? RESIZE_ANCHORS[edges.y] : []
  }
  return solve(index, box, frame, anchors, resizedEdge(edges))
}
