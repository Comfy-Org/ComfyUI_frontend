import { clampZoom } from '@comfyorg/mask-editor/panZoomUtils'
import { minBy } from 'es-toolkit'
import type {
  Point2D as Point,
  Size2D as Size
} from '@comfyorg/shared-frontend-utils/geometry'

import type {
  PortRef,
  SuperGraphDocument,
  SuperNode
} from '@/renderer/extensions/superComfy/engine/documentSchema'
import { portsOf } from '@/renderer/extensions/superComfy/engine/graphTopology'

export interface Camera {
  x: number
  y: number
  zoom: number
}

export type PortSide = 'in' | 'out'

export const HEADER_H = 24
export const HEADER_GAP = 4
export const PORT_TOP = 24
export const PORT_PITCH = 28
export const PORT_HIT_RADIUS = 14
export const NODE_WIDTH: Record<SuperNode['kind'], number> = {
  io: 240,
  generate: 280,
  app: 280
}
const NODE_EST_HEIGHT = 260

const FIT_PADDING = 64
const MIN_LINK_BEND = 48
const PLACEMENT_GAP = 80
const GRID_SPACING = 24
const MIN_GRID_SPACING = 12

export function portAnchor(
  node: SuperNode,
  side: PortSide,
  index: number
): Point {
  return {
    x: side === 'out' ? node.x + node.width : node.x,
    y: node.y + PORT_TOP + index * PORT_PITCH
  }
}

export function linkPath(a: Point, b: Point): string {
  const bend = Math.max(MIN_LINK_BEND, Math.abs(b.x - a.x) / 2)
  return `M ${a.x} ${a.y} C ${a.x + bend} ${a.y}, ${b.x - bend} ${b.y}, ${b.x} ${b.y}`
}

function portsOnSide(node: SuperNode, side: PortSide) {
  const { inputs, outputs } = portsOf(node)
  return side === 'in' ? inputs : outputs
}

export function portIndex(
  node: SuperNode,
  side: PortSide,
  port: string
): number {
  return portsOnSide(node, side).findIndex(({ name }) => name === port)
}

export function hitPort(
  doc: SuperGraphDocument,
  world: Point,
  radius: number,
  side: PortSide = 'in'
): PortRef | null {
  const candidates = doc.nodes.flatMap((node) =>
    portsOnSide(node, side).map((port, index) => {
      const anchor = portAnchor(node, side, index)
      return {
        ref: { node: node.id, port: port.name },
        distance: Math.hypot(anchor.x - world.x, anchor.y - world.y)
      }
    })
  )
  const nearest = minBy(
    candidates.filter(({ distance }) => distance <= radius),
    ({ distance }) => distance
  )
  return nearest?.ref ?? null
}

export function screenToWorld(p: Point, camera: Camera): Point {
  return {
    x: (p.x - camera.x) / camera.zoom,
    y: (p.y - camera.y) / camera.zoom
  }
}

export function fitView(doc: SuperGraphDocument, viewport: Size): Camera {
  if (doc.nodes.length === 0) return { x: 0, y: 0, zoom: 1 }
  const top = (node: SuperNode) => node.y - HEADER_H - HEADER_GAP
  const minX = Math.min(...doc.nodes.map((node) => node.x))
  const minY = Math.min(...doc.nodes.map(top))
  const maxX = Math.max(...doc.nodes.map((node) => node.x + node.width))
  const maxY = Math.max(...doc.nodes.map((node) => node.y + NODE_EST_HEIGHT))
  const width = maxX - minX + FIT_PADDING * 2
  const height = maxY - minY + FIT_PADDING * 2
  const zoom = clampZoom(
    Math.min(viewport.width / width, viewport.height / height, 1)
  )
  return {
    x: viewport.width / 2 - ((minX + maxX) / 2) * zoom,
    y: viewport.height / 2 - ((minY + maxY) / 2) * zoom,
    zoom
  }
}

/** Moves a new node of `width` right of any node it would land on. */
export function placeNode(
  doc: SuperGraphDocument,
  at: Point,
  width: number
): Point {
  const blocker = doc.nodes.find(
    (node) =>
      node.x < at.x + width &&
      at.x < node.x + node.width &&
      node.y < at.y + NODE_EST_HEIGHT &&
      at.y < node.y + NODE_EST_HEIGHT
  )
  return blocker
    ? placeNode(
        doc,
        { x: blocker.x + blocker.width + PLACEMENT_GAP, y: at.y },
        width
      )
    : at
}

/** Screen distance between background grid dots, doubled until they are not crowded. */
export function gridSpacing(zoom: number): number {
  const spacing = GRID_SPACING * zoom
  return spacing >= MIN_GRID_SPACING ? spacing : gridSpacing(zoom * 2)
}

export function cardMinHeight(rows: number): number {
  return 2 * PORT_TOP + (Math.max(rows, 1) - 1) * PORT_PITCH
}
