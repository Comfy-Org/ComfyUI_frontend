import { layoutStore } from '@/renderer/core/layout/store/layoutStore'

import type { LGraphCanvas } from '../LGraphCanvas'
import type { LGraphGroup } from '../LGraphGroup'
import type { Reroute } from '../Reroute'
import { LinkRenderType } from '../types/globalEnums'

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

  let reroute: Reroute | undefined
  if (canvas.links_render_mode !== LinkRenderType.HIDDEN_LINK) {
    const layoutHit = layoutStore.queryRerouteAtPoint({ x, y })
    reroute = layoutHit
      ? graph.getReroute(layoutHit.id)
      : graph.getRerouteOnPos(
          x,
          y,
          (canvas as unknown as { _visibleReroutes: Iterable<Reroute> })
            ._visibleReroutes
        )
  }

  return { reroute, group: graph.getGroupOnPos(x, y) }
}
