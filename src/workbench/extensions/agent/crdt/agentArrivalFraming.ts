import { visibleCanvasViewport } from '@/composables/canvas/visibleCanvasViewport'
import type { ReadOnlyRect } from '@/lib/litegraph/src/interfaces'
import type { LGraphCanvas, LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { NodeId } from '@/types/nodeId'
import { anyItemOverlapsRect } from '@/utils/mathUtil'
import { createPositionBounds } from '@/utils/positionBounds'

/** Graph units left around the framed nodes so none sits flush with an edge. */
const FRAME_PADDING = 40

/**
 * The geometry this module reads. `pos`/`size` is what litegraph maintains for
 * canvas and Vue nodes alike, and is the pair `anyItemOverlapsRect` and
 * `animateToBounds` already work in.
 */
interface FramableNode {
  pos: readonly [number, number]
  size: readonly [number, number]
}

/**
 * The part of the canvas the user can actually see, in graph units.
 *
 * `canvas.ds.visible_area` spans the whole canvas element, which on this
 * surface includes the strip behind the docked agent panel: a node materialized
 * under the panel is painted but not visible, and judging arrival against
 * `visible_area` would call it "already on screen". `visibleCanvasViewport`
 * subtracts the panel, and this is `DragAndScale.computeVisibleArea`'s own
 * viewport arithmetic applied to that rect - computed rather than read so
 * nothing mutates render state a draw in the same tick is about to use.
 *
 * `null` when there is no visible area to speak of (an unsized canvas, or a
 * panel covering all of it); there is no camera decision to make then.
 */
function visibleGraphRect(canvas: LGraphCanvas): ReadOnlyRect | null {
  const [x, y, width, height] = visibleCanvasViewport(canvas)
  const { scale, offset } = canvas.ds
  if (!(width > 0) || !(height > 0) || !(scale > 0)) return null
  return [
    -offset[0] + x / scale,
    -offset[1] + y / scale,
    width / scale,
    height / scale
  ]
}

/**
 * Whether the camera has to move for `nodes` to be seen.
 *
 * Same shape as the restored-view check in `app.ts`: one node in view is
 * enough. The user is then looking at the place the work landed, and moving
 * the camera under them would be the more surprising behaviour.
 */
function needsFraming(
  canvas: LGraphCanvas,
  nodes: readonly FramableNode[]
): boolean {
  if (nodes.length === 0) return false
  const visible = visibleGraphRect(canvas)
  if (!visible) return false
  return !anyItemOverlapsRect(nodes, visible)
}

export interface AgentArrivalFramer {
  /**
   * Take the nodes a frame materialized into the current build, then select
   * and, if it landed off screen, frame that build.
   *
   * @param options `select: false` leaves the canvas selection untouched, for
   * when it is not ours to replace.
   */
  reveal: (
    canvas: LGraphCanvas,
    nodes: readonly LGraphNode[],
    options?: { select?: boolean }
  ) => void
  /** Forget the build in progress, e.g. when the document lineage breaks. */
  reset: () => void
}

/**
 * Point the user at what the agent just built.
 *
 * Agent operations carry graph-relative positions, which can place new nodes
 * outside the current viewport.
 *
 * Two things happen, both off the ids the reconcile pass already reports:
 *
 * - The build becomes the selection, which is what makes the shipped
 *   "Fit view to selected nodes" command frame the new work rather than the
 *   whole graph.
 * - When the nodes that just landed are not on screen, the camera animates to
 *   the build. When they did land in view it stays put: an agent editing what
 *   the user is looking at must not yank the camera.
 *
 * The unit is the build, not the frame. One turn commonly materializes over
 * several frames, and framing each one on its own would leave the turn's
 * earlier nodes behind the moment the agent placed something further out -
 * which is the complaint, one frame later. `currentTurnId` is what bounds it:
 * arrivals join the build until the turn changes, so a build is never framed
 * together with the previous turn's work. A null id means no new turn has
 * started (it is cleared between turns), so it never splits a build.
 */
export function createAgentArrivalFramer(
  currentTurnId: () => string | null,
  resolveNode: (id: NodeId, canvas: LGraphCanvas) => LGraphNode | undefined = (
    id,
    canvas
  ) => canvas.graph?._nodes_by_id[id]
): AgentArrivalFramer {
  let buildTurnId: string | null = null
  let build: NodeId[] = []

  return {
    reveal(canvas, nodes, options = {}) {
      if (nodes.length === 0) return
      const turnId = currentTurnId()
      if (turnId !== null && turnId !== buildTurnId) {
        buildTurnId = turnId
        build = []
      }
      build = [...build, ...nodes.map((node) => node.id)]
      const liveBuild = build
        .map((id) => resolveNode(id, canvas))
        .filter((node) => node !== undefined)
      build = liveBuild.map((node) => node.id)
      if (options.select !== false) canvas.selectItems(liveBuild)
      if (!needsFraming(canvas, nodes)) return

      const bounds = createPositionBounds(liveBuild, FRAME_PADDING)
      if (!bounds) return
      canvas.animateToBounds(bounds, {
        viewport: visibleCanvasViewport(canvas)
      })
    },
    reset() {
      buildTurnId = null
      build = []
    }
  }
}
