import type { LGraphCanvas } from '../LGraphCanvas'
import type { LGraphGroup } from '../LGraphGroup'
import type { Reroute } from '../Reroute'
import { LinkRenderType } from '../types/globalEnums'
import { findRerouteAtPoint } from './findRerouteAtPoint'

interface CanvasContextMenuTarget {
  reroute?: Reroute
  group?: LGraphGroup
}

/** Resolves the reroute and group under a canvas-space point for a right-click. */
export function getCanvasContextMenuTarget(
  canvas: LGraphCanvas,
  x: number,
  y: number
): CanvasContextMenuTarget {
  const { graph } = canvas
  if (!graph) return {}

  const reroute =
    canvas.links_render_mode === LinkRenderType.HIDDEN_LINK
      ? undefined
      : findRerouteAtPoint(graph, x, y, canvas._visibleReroutes)

  return { reroute, group: graph.getGroupOnPos(x, y) }
}
