/**
 * Watching nodes move, without touching the canvas.
 *
 * Three kjnodes features — swap two nodes by dragging one onto another, insert
 * a node into a link, shake a node to disconnect it — are editing gestures, and
 * each hand-rolled one from document-level pointer listeners plus canvas
 * internals because nothing published reports that a node is being moved.
 *
 * The source is the layout store rather than either renderer. Both route node
 * movement through `layoutMutations.moveNode` — the canvas from `LGraphNode`'s
 * position setter, Nodes 2.0 from `useNodeLayout` — so one subscription covers
 * both and no pack needs to know which is active.
 *
 * Deliberately not a gesture framework. A pack observes movement and decides
 * for itself what a shake or a swap is; making "gesture" a feature type would
 * make every pack's idea of one our problem.
 *
 * Two things it deliberately does not claim:
 *
 * - **Whether a person did it.** `LayoutChange.source` names the subsystem that
 *   wrote — `LGraphNode._positionUpdated` sets `Canvas` unconditionally — so it
 *   answers "which renderer", not "was this a user". A pack that moves nodes as
 *   part of its own gesture must guard its own re-entry.
 * - **When a drag starts or ends.** There is no renderer-agnostic drag
 *   lifecycle; `isDraggingVueNodes` exists only for Nodes 2.0. A gesture that
 *   must commit on release cannot be built on this alone.
 */
import { ComfyApiError } from './errors'
import type { NodeHandle } from './nodeHandle'
import type { Unsubscribe } from './widgetHandle'

export interface NodeMoveEvent {
  readonly node: NodeHandle
  readonly position: { readonly x: number; readonly y: number }
}

/**
 * Where movement comes from, supplied by the renderer.
 *
 * `platform/` cannot import `renderer/`, and the layout store lives there. This
 * is the same seam `registerBadgeRowsProvider` uses so litegraph never reaches
 * into the store: the upper layer pushes the source down at boot.
 */
export type NodeMoveSource = (
  onMove: (nodeId: string, position: { x: number; y: number }) => void
) => Unsubscribe

let source: NodeMoveSource | undefined

export function provideNodeMoveSource(provider: NodeMoveSource): void {
  source = provider
}

/** Test seam. */
export function resetNodeMoveSource(): void {
  source = undefined
}

export function createNodeMoveObserver(
  handleFor: (nodeId: string) => NodeHandle | undefined
) {
  return function onNodeMoved(
    listener: (event: NodeMoveEvent) => void
  ): Unsubscribe {
    // Loud rather than a silent no-op. A capability that accepts listeners and
    // never calls them is how `onPreview` shipped broken for weeks.
    if (!source) {
      throw new ComfyApiError(
        'Node movement is unavailable: the host has not provided a source.'
      )
    }
    return source((nodeId, position) => {
      const node = handleFor(nodeId)
      // The node may have gone between the move and this fan-out, which is
      // queued.
      if (!node || node.isDeleted) return
      listener({ node, position })
    })
  }
}
