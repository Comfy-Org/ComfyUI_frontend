import type {
  Bounds,
  Point2D,
  ReadOnlyRect
} from '@comfyorg/shared-frontend-utils/geometry'
import type { Positionable } from '@comfyorg/graph-model/interfaces'
import type { LinkId } from '@comfyorg/graph-model/linkId'

import type {
  GestureSnapProvider,
  MoveSnap,
  ResizeSnap
} from '@/lib/litegraph/src/canvas/gestureSnap'
import { getLinkEndpointPositions } from '@/lib/litegraph/src/canvas/linkGeometry'
import type { LGraph, LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import { LGraphNode, LLink } from '@/lib/litegraph/src/litegraph'
import { containsRect, overlapBounding } from '@/lib/litegraph/src/measure'
import { SubgraphInputNode } from '@/lib/litegraph/src/subgraph/SubgraphInputNode'
import { SubgraphOutputNode } from '@/lib/litegraph/src/subgraph/SubgraphOutputNode'
import { positionableBox, unionBox } from '@/lib/litegraph/src/utils/arrange'
import type { VisualBox } from '@comfyorg/graph-model/arrange/arrange'

import { activeGuides } from './smartGuidesState'
import {
  buildSnapIndex,
  resizeEdgesOf,
  snapMove,
  snapResize,
  snapSearchArea,
  thresholdAt
} from '@comfyorg/graph-model/arrange/snapSolver'
import type {
  SnapAttachment,
  SnapIndex,
  SnapOptions,
  WireAnchor
} from '@comfyorg/graph-model/arrange/snapSolver'

export interface SmartGuidesConfig extends SnapOptions {
  distance: number
  enabled: boolean
}

function targetsIn(
  graph: LGraph,
  area: ReadOnlyRect,
  excluded: ReadonlySet<unknown>
): VisualBox[] {
  return [...graph.nodes, ...graph.groups]
    .filter(
      (item) => !excluded.has(item) && overlapBounding(area, item.boundingRect)
    )
    .map(positionableBox)
}

function toPoint(point: ArrayLike<number>): Point2D {
  return {
    x: point[0],
    y: point[1]
  }
}

function wireAnchor(
  graph: LGraph,
  link: LLink,
  side: 'input' | 'output',
  moving: ReadonlySet<unknown>
): WireAnchor | undefined {
  const endpoints = getLinkEndpointPositions(graph, link)
  if (!endpoints) return
  const [start, end] = endpoints
  const resolved = link.resolve(graph)
  const [mine, theirs, reroute, far] =
    side === 'input'
      ? [
          end,
          start,
          graph.getReroute(link.parentId),
          resolved.outputNode ?? resolved.subgraphInput?.parent
        ]
      : [
          start,
          end,
          LLink.getFirstReroute(graph, link),
          resolved.inputNode ?? resolved.subgraphOutput?.parent
        ]
  const anchor = reroute ?? far
  if (!anchor || moving.has(anchor)) return
  return { mine: toPoint(mine), theirs: toPoint(reroute?.pos ?? theirs) }
}

function linksOf(graph: LGraph, ids: (LinkId | null | undefined)[]) {
  return ids.flatMap((id) => (id == null ? [] : (graph.links.get(id) ?? [])))
}

function wiresOf(
  graph: LGraph,
  node: LGraphNode,
  moving: ReadonlySet<unknown>
): WireAnchor[] {
  return [
    ...linksOf(
      graph,
      node.inputs.map((input) => input.link)
    ).map((link) => wireAnchor(graph, link, 'input', moving)),
    ...linksOf(
      graph,
      node.outputs.flatMap((output) => output.links ?? [])
    ).map((link) => wireAnchor(graph, link, 'output', moving))
  ].filter((wire) => wire !== undefined)
}

function ioWiresOf(
  graph: LGraph,
  ioNode: SubgraphInputNode | SubgraphOutputNode,
  moving: ReadonlySet<unknown>
): WireAnchor[] {
  ioNode.arrange()
  const side = ioNode instanceof SubgraphInputNode ? 'output' : 'input'
  const slots: readonly { linkIds: LinkId[] }[] = ioNode.slots
  return linksOf(
    graph,
    slots.flatMap((slot) => slot.linkIds)
  )
    .map((link) => wireAnchor(graph, link, side, moving))
    .filter((wire) => wire !== undefined)
}

function clearGuides() {
  activeGuides.value = []
}

function moveSnap(
  config: SmartGuidesConfig,
  canvas: LGraphCanvas,
  items: Positionable[]
): MoveSnap | undefined {
  const { graph } = canvas
  const movingItems = items.filter((item) => !item.pinned)
  if (!config.enabled || !graph) return

  const start = unionBox(movingItems)
  if (!start) return
  const moving = new Set<unknown>(movingItems)
  const ioNodes = movingItems.filter(
    (item) =>
      item instanceof SubgraphInputNode || item instanceof SubgraphOutputNode
  )
  const wires = [
    ...graph.nodes
      .filter((node) => moving.has(node))
      .flatMap((node) => wiresOf(graph, node, moving)),
    ...ioNodes.flatMap((ioNode) => ioWiresOf(graph, ioNode, moving))
  ]
  const options =
    ioNodes.length > 0 ? { ...config, edges: false, spacing: false } : config
  function buildScene(
    graph: LGraph,
    start: VisualBox
  ): { area: ReadOnlyRect; index: SnapIndex } {
    const area = snapSearchArea(canvas.visible_area)
    return {
      area,
      index: buildSnapIndex(targetsIn(graph, area, moving), options, {
        movingStart: start,
        wires
      })
    }
  }
  let scene = buildScene(graph, start)
  let attachment: SnapAttachment = {}

  return {
    offset(raw, { snapToGrid }) {
      if (snapToGrid) {
        attachment = {}
        clearGuides()
        return raw
      }
      if (!containsRect(scene.area, canvas.visible_area)) {
        scene = buildScene(graph, start)
        attachment = {}
      }
      const box = { ...start, x: start.x + raw.x, y: start.y + raw.y }
      const result = snapMove(scene.index, box, {
        threshold: thresholdAt(canvas.ds.scale, config.distance),
        attachment
      })
      attachment = result.attachment
      activeGuides.value = result.guides
      return { x: result.box.x - start.x, y: result.box.y - start.y }
    },
    stop: clearGuides
  }
}

function resizeSnap(
  config: SmartGuidesConfig,
  canvas: LGraphCanvas,
  item: Positionable
): ResizeSnap | undefined {
  const { graph } = canvas
  if (!config.enabled || !graph) return

  const shift = item instanceof LGraphNode ? item.boundingOffset[1] : 0
  const { titleHeight } = positionableBox(item)
  const index = buildSnapIndex(
    targetsIn(graph, snapSearchArea(canvas.visible_area), new Set([item])),
    { ...config, spacing: false, wires: false }
  )
  let attachment: SnapAttachment = {}

  return {
    resize(bounds, corner, { snapToGrid, min }): Bounds {
      if (snapToGrid) {
        attachment = {}
        clearGuides()
        return bounds
      }
      const box = {
        x: bounds.x,
        y: bounds.y - shift,
        width: bounds.width,
        height: bounds.height + shift,
        titleHeight
      }
      const result = snapResize(
        index,
        box,
        resizeEdgesOf(corner),
        {
          threshold: thresholdAt(canvas.ds.scale, config.distance),
          attachment
        },
        { width: min.width, height: min.height + shift }
      )
      attachment = result.attachment
      activeGuides.value = result.guides
      const { x, y, width, height } = result.box
      return { x, y: y + shift, width, height: height - shift }
    },
    stop: clearGuides
  }
}

/** Snaps drag and resize gestures in both renderers, reading `readConfig` at each gesture start. */
export function createSmartGuidesProvider(
  readConfig: () => SmartGuidesConfig
): GestureSnapProvider {
  return {
    move: (canvas, items) => moveSnap(readConfig(), canvas, items),
    resize: (canvas, item) => resizeSnap(readConfig(), canvas, item)
  }
}
