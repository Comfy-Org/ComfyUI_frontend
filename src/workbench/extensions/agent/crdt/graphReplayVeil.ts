/**
 * mm3-21 follow-up to the Option-B PoC (bbc #285): draws a translucent veil
 * over the bounds of nodes the replay queue has not yet revealed, so the
 * honest loading/partial state is visible on the canvas itself and not only
 * in the dev panel. Presentation-only - reads `pendingNodeIds` off the queue
 * and paints over node bounds; it never mutates the graph, the Y.Doc, or
 * node state. Per-link veiling is out of scope for the PoC (queue paces link
 * ids but LiteGraph renders links in one pass); see mm3-23.
 */
import type { LGraphCanvas, Rectangle } from '@/lib/litegraph/src/litegraph'
import type { Rect } from '@/lib/litegraph/src/interfaces'
import { toNodeId } from '@/types/nodeId'

export const REPLAY_VEIL_FILL = 'rgba(0, 0, 0, 0.45)'
const VEIL_PADDING = 4

/** Draws a rounded veil over one node's bounds. Pure - no graph/doc access. */
export function drawNodeVeil(
  ctx: CanvasRenderingContext2D,
  bounds: Rect,
  scale: number
): void {
  const [x, y, width, height] = bounds
  const padding = VEIL_PADDING / scale
  ctx.save()
  ctx.fillStyle = REPLAY_VEIL_FILL
  ctx.beginPath()
  ctx.roundRect(
    x - padding,
    y - padding,
    width + padding * 2,
    height + padding * 2,
    8 / scale
  )
  ctx.fill()
  ctx.restore()
}

/**
 * Paints a veil over every pending node that currently resolves on the
 * canvas. Nodes the replay queue is pacing but that no longer exist (already
 * covered by the queue's own `failed` force-reveal) are silently skipped
 * rather than drawn at a stale location.
 */
export function drawReplayVeil(
  ctx: CanvasRenderingContext2D,
  canvas: LGraphCanvas,
  pendingNodeIds: ReadonlySet<string>
): void {
  if (pendingNodeIds.size === 0) return
  const graph = canvas.graph
  if (!graph) return
  for (const id of pendingNodeIds) {
    const node = graph.getNodeById(toNodeId(id))
    if (!node) continue
    const bounds = node.getBounding()
    drawNodeVeil(ctx, bounds, canvas.ds.scale)
  }
}

export interface ReplayVeilHandle {
  /** Removes the draw hook, restoring whatever `onDrawForeground` was before. */
  uninstall: () => void
}

/**
 * Installs a veil-drawing hook on `canvas.onDrawForeground`, chaining after
 * any handler already installed (same convention as
 * `extensions/core/selectionBorder.ts`). `getPendingNodeIds` is read fresh on
 * every draw so the veil always reflects the queue's current state without
 * needing its own re-render trigger.
 */
export function installReplayVeil(
  canvas: LGraphCanvas,
  getPendingNodeIds: () => ReadonlySet<string>
): ReplayVeilHandle {
  const previous = canvas.onDrawForeground
  canvas.onDrawForeground = function (
    this: LGraphCanvas,
    ctx: CanvasRenderingContext2D,
    visibleArea: Rectangle
  ) {
    previous?.call(this, ctx, visibleArea)
    drawReplayVeil(ctx, this, getPendingNodeIds())
  }
  return {
    uninstall: () => {
      if (canvas.onDrawForeground === undefined) return
      // Only restore if we are still the installed hook - a later installer
      // (e.g. panel remount) may have already chained past us.
      canvas.onDrawForeground = previous
    }
  }
}
