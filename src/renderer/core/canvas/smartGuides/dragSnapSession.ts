import type { Point2D } from '@comfyorg/shared-frontend-utils/geometry'
import type { Positionable } from '@comfyorg/graph-model/interfaces'
import type { RerouteId } from '@comfyorg/graph-model/rerouteId'

import type {
  LGraph,
  LGraphCanvas,
  LGraphGroup,
  LGraphNode
} from '@/lib/litegraph/src/litegraph'

import { activeGuides, smartGuidesConfig } from './smartGuidesState'
import { buildSnapIndex, snapMove, snapResize } from './snapSolver'
import type {
  GestureSnapProvider,
  MoveSnap,
  ResizeSnap,
  SnapBox
} from '@/lib/litegraph/src/canvas/gestureSnap'

import type {
  SnapAttachment,
  SnapIndex,
  SnapThreshold,
  WireAnchor
} from './snapSolver'

const VIEWPORT_MARGIN = 0.5
const EXIT_RATIO = 14 / 8

interface SnapScene {
  index: SnapIndex
  targets: SnapBox[]
  threshold: () => SnapThreshold
}

function rectBox(item: Positionable, head: number): SnapBox {
  const [x, y, width, height] = item.boundingRect
  return { x, y, width, height, head: Math.max(0, Math.min(height, head)) }
}

/** The visual box of a node, with its title band as `head`. */
export function nodeBox(node: LGraphNode): SnapBox {
  return rectBox(node, node.pos[1] - node.boundingRect[1])
}

function groupBox(group: LGraphGroup): SnapBox {
  return rectBox(group, group.titleHeight)
}

function itemBoxes(items: Positionable[], graph: LGraph): SnapBox[] {
  const wanted = new Set<unknown>(items)
  const nodes = graph.nodes.filter((node) => wanted.has(node))
  const groups = graph.groups.filter((group) => wanted.has(group))
  const known = new Set<unknown>([...nodes, ...groups])
  return [
    ...nodes.map(nodeBox),
    ...groups.map(groupBox),
    ...items.filter((item) => !known.has(item)).map((item) => rectBox(item, 0))
  ]
}

function unionBox(boxes: SnapBox[]): SnapBox {
  const x = Math.min(...boxes.map((b) => b.x))
  const y = Math.min(...boxes.map((b) => b.y))
  const top = boxes.reduce((a, b) => (b.y < a.y ? b : a))
  return {
    x,
    y,
    width: Math.max(...boxes.map((b) => b.x + b.width)) - x,
    height: Math.max(...boxes.map((b) => b.y + b.height)) - y,
    head: top.head
  }
}

function visibleTargets(
  canvas: LGraphCanvas,
  graph: LGraph,
  excluded: ReadonlySet<unknown>
): SnapBox[] {
  const [vx, vy, vw, vh] = canvas.visible_area
  const mx = vw * VIEWPORT_MARGIN
  const my = vh * VIEWPORT_MARGIN
  const inView = (b: SnapBox) =>
    b.x < vx + vw + mx &&
    b.x + b.width > vx - mx &&
    b.y < vy + vh + my &&
    b.y + b.height > vy - my
  return [
    ...graph.nodes.filter((node) => !excluded.has(node)).map(nodeBox),
    ...graph.groups.filter((group) => !excluded.has(group)).map(groupBox)
  ].filter(inView)
}

function rootReroutePos(graph: LGraph, rerouteId: RerouteId | undefined) {
  let reroute = graph.getReroute(rerouteId)
  while (reroute?.parentId != null) {
    const parent = graph.getReroute(reroute.parentId)
    if (!parent) break
    reroute = parent
  }
  return reroute?.pos
}

function toPoint(point: ArrayLike<number>): Point2D {
  return { x: point[0], y: point[1] }
}

function inputWires(
  graph: LGraph,
  node: LGraphNode,
  moving: ReadonlySet<unknown>
): WireAnchor[] {
  return node.inputs.flatMap((input, slot) => {
    const link = input.link == null ? undefined : graph.links.get(input.link)
    if (!link) return []
    const reroute = graph.getReroute(link.parentId)
    if (reroute) {
      if (moving.has(reroute)) return []
      return [
        { theirs: toPoint(reroute.pos), mine: toPoint(node.getInputPos(slot)) }
      ]
    }
    const origin = graph.getNodeById(link.origin_id)
    if (!origin || moving.has(origin)) return []
    return [
      {
        theirs: toPoint(origin.getOutputPos(link.origin_slot)),
        mine: toPoint(node.getInputPos(slot))
      }
    ]
  })
}

function outputWires(
  graph: LGraph,
  node: LGraphNode,
  moving: ReadonlySet<unknown>
): WireAnchor[] {
  return node.outputs.flatMap((output, slot) =>
    (output.links ?? []).flatMap((linkId) => {
      const link = graph.links.get(linkId)
      if (!link) return []
      const mine = toPoint(node.getOutputPos(slot))
      if (link.parentId != null) {
        const pos = rootReroutePos(graph, link.parentId)
        return pos ? [{ theirs: toPoint(pos), mine }] : []
      }
      const target = graph.getNodeById(link.target_id)
      if (!target || moving.has(target)) return []
      return [{ theirs: toPoint(target.getInputPos(link.target_slot)), mine }]
    })
  )
}

function withDescendants(items: Iterable<Positionable>, graph: LGraph) {
  const all = new Set<unknown>(items)
  for (const group of graph.groups) {
    if (!all.has(group)) continue
    for (const child of group.children) all.add(child)
  }
  return all
}

function thresholdFor(canvas: LGraphCanvas): () => SnapThreshold {
  return () => {
    const scale = canvas.ds.scale || 1
    const px = smartGuidesConfig.distance
    return {
      enter: px / scale,
      exit: Math.round(px * EXIT_RATIO) / scale
    }
  }
}

function snapOptions() {
  const { edges, wires, spacing, gap } = smartGuidesConfig
  return { edges, wires, spacing, gap }
}

const passthroughMove: MoveSnap = { offset: (raw) => raw, stop: () => {} }
const passthroughResize: ResizeSnap = { resize: (box) => box, stop: () => {} }

function moveSnap(canvas: LGraphCanvas, items: Positionable[]): MoveSnap {
  const { graph } = canvas
  const movingItems = items.filter((item) => !item.pinned)
  if (!smartGuidesConfig.enabled || !graph || movingItems.length === 0)
    return passthroughMove

  const moving = withDescendants(movingItems, graph)
  const start = unionBox(itemBoxes(movingItems, graph))
  const wires = graph.nodes
    .filter((node) => moving.has(node))
    .flatMap((node) => [
      ...inputWires(graph, node, moving),
      ...outputWires(graph, node, moving)
    ])
  const targets = visibleTargets(canvas, graph, moving)
  const scene: SnapScene = {
    index: buildSnapIndex(targets, snapOptions(), {
      movingStart: start,
      wires
    }),
    targets,
    threshold: thresholdFor(canvas)
  }
  let attachment: SnapAttachment = {}

  return {
    offset(raw, { suspended }) {
      if (suspended) {
        attachment = {}
        activeGuides.value = []
        return raw
      }
      const box = { ...start, x: start.x + raw.x, y: start.y + raw.y }
      const result = snapMove(
        scene.index,
        box,
        scene.targets,
        scene.threshold(),
        attachment
      )
      attachment = result.attachment
      activeGuides.value = result.guides
      return { x: result.box.x - start.x, y: result.box.y - start.y }
    },
    stop() {
      activeGuides.value = []
    }
  }
}

function resizeSnap(canvas: LGraphCanvas, item: Positionable): ResizeSnap {
  const { graph } = canvas
  if (!smartGuidesConfig.enabled || !graph) return passthroughResize

  const targets = visibleTargets(canvas, graph, withDescendants([item], graph))
  const index = buildSnapIndex(targets, {
    ...snapOptions(),
    spacing: false,
    wires: false
  })
  const threshold = thresholdFor(canvas)
  let attachment: SnapAttachment = {}

  return {
    resize(box, edges, { suspended }) {
      if (suspended) {
        attachment = {}
        activeGuides.value = []
        return box
      }
      const result = snapResize(
        index,
        box,
        edges,
        targets,
        threshold(),
        attachment
      )
      attachment = result.attachment
      activeGuides.value = result.guides
      return result.box
    },
    stop() {
      activeGuides.value = []
    }
  }
}

/** Smart guide snapping for drag and resize gestures in both renderers. */
export const smartGuidesProvider: GestureSnapProvider = {
  move: moveSnap,
  resize: resizeSnap
}
