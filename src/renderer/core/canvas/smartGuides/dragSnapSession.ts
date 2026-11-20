import type {
  Bounds,
  CompassCorners,
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
import {
  hasNorthEdge,
  hasWestEdge
} from '@/lib/litegraph/src/canvas/cornerResize'
import { getLinkEndpointPositions } from '@/lib/litegraph/src/canvas/linkGeometry'
import type { LGraph, LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import { LGraphGroup, LGraphNode, LLink } from '@/lib/litegraph/src/litegraph'
import { containsRect, overlapBounding } from '@/lib/litegraph/src/measure'
import { nodeBox } from '@/lib/litegraph/src/utils/arrange'
import type { VisualBox } from '@comfyorg/graph-model/arrange/arrange'
import { computeUnionBounds } from '@/utils/mathUtil'

import { activeGuides } from './smartGuidesState'
import { buildSnapIndex, snapMove, snapResize } from './snapSolver'
import type {
  ResizeEdges,
  SnapAttachment,
  SnapIndex,
  SnapOptions,
  SnapThreshold,
  WireAnchor
} from './snapSolver'

export interface SmartGuidesConfig extends SnapOptions {
  enabled: boolean
  distance: number
}

const VIEWPORT_MARGIN = 0.5
const EXIT_RATIO = 14 / 8

function snapBoxOf(item: Positionable): VisualBox {
  if (item instanceof LGraphNode) return nodeBox(item)
  const [x, y, width, height] = item.boundingRect
  const titleHeight = item instanceof LGraphGroup ? item.titleHeight : 0
  return {
    x,
    y,
    width,
    height,
    titleHeight: Math.max(0, Math.min(height, titleHeight))
  }
}

function unionBox(items: Positionable[]): VisualBox | undefined {
  const bounds = computeUnionBounds(items.map((item) => item.boundingRect))
  if (!bounds) return
  const top = items.reduce((a, b) =>
    b.boundingRect[1] < a.boundingRect[1] ? b : a
  )
  return { ...bounds, titleHeight: snapBoxOf(top).titleHeight }
}

function searchArea(canvas: LGraphCanvas): ReadOnlyRect {
  const [vx, vy, vw, vh] = canvas.visible_area
  const mx = vw * VIEWPORT_MARGIN
  const my = vh * VIEWPORT_MARGIN
  return [vx - mx, vy - my, vw + 2 * mx, vh + 2 * my]
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
    .map(snapBoxOf)
}

const toPoint = (point: ArrayLike<number>): Point2D => ({
  x: point[0],
  y: point[1]
})

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

function wiresOf(
  graph: LGraph,
  node: LGraphNode,
  moving: ReadonlySet<unknown>
): WireAnchor[] {
  const links = (ids: (LinkId | null | undefined)[]) =>
    ids.flatMap((id) => (id == null ? [] : (graph.links.get(id) ?? [])))
  return [
    ...links(node.inputs.map((input) => input.link)).map((link) =>
      wireAnchor(graph, link, 'input', moving)
    ),
    ...links(node.outputs.flatMap((output) => output.links ?? [])).map((link) =>
      wireAnchor(graph, link, 'output', moving)
    )
  ].filter((wire) => wire !== undefined)
}

function thresholdAt(scale: number, distance: number): SnapThreshold {
  const zoom = scale || 1
  return {
    enter: distance / zoom,
    exit: Math.round(distance * EXIT_RATIO) / zoom
  }
}

function edgesOf(corner: CompassCorners): ResizeEdges {
  return {
    x: hasWestEdge(corner) ? 'left' : 'right',
    y: hasNorthEdge(corner) ? 'top' : 'bottom'
  }
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
  const wires = graph.nodes
    .filter((node) => moving.has(node))
    .flatMap((node) => wiresOf(graph, node, moving))
  const buildScene = (): { area: ReadOnlyRect; index: SnapIndex } => {
    const area = searchArea(canvas)
    return {
      area,
      index: buildSnapIndex(targetsIn(graph, area, moving), config, {
        movingStart: start,
        wires
      })
    }
  }
  let scene = buildScene()
  let attachment: SnapAttachment = {}

  return {
    offset(raw, { snapToGrid }) {
      if (snapToGrid) {
        attachment = {}
        clearGuides()
        return raw
      }
      if (!containsRect(scene.area, canvas.visible_area)) {
        scene = buildScene()
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
  const { titleHeight } = snapBoxOf(item)
  const index = buildSnapIndex(
    targetsIn(graph, searchArea(canvas), new Set([item])),
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
        edgesOf(corner),
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
