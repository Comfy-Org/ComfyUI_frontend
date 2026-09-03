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
 * - **Whether a person did it.** See above; guard your own writes.
 *
 * `onNodeDragEnd` is **Nodes 2.0 only**. The legacy canvas renderer has no drag
 * lifecycle to hang it on, so under it the listener never fires and a gesture
 * that commits on release will not run. Movement itself (`onNodeMoved`) works
 * under both.
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

/** Reports a completed drag with the ids of every node it moved. */
export type NodeDragEndSource = (
  onDragEnd: (nodeIds: readonly string[]) => void
) => Unsubscribe

let source: NodeMoveSource | undefined
let dragEndSource: NodeDragEndSource | undefined

export function provideNodeMoveSource(provider: NodeMoveSource): void {
  source = provider
}

export function provideNodeDragEndSource(provider: NodeDragEndSource): void {
  dragEndSource = provider
}

/** Test seam. */
export function resetNodeMoveSource(): void {
  source = undefined
  dragEndSource = undefined
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

/**
 * A drag finished; here is everything it moved.
 *
 * The release is where an editing gesture commits — swap the two nodes, insert
 * into the link under the cursor. Without it a pack can only watch movement and
 * never act on it.
 *
 * **Nodes 2.0 only.** The legacy canvas renderer exposes no drag lifecycle, so
 * this never fires under it.
 */
export function createNodeDragEndObserver(
  handleFor: (nodeId: string) => NodeHandle | undefined
) {
  return function onNodeDragEnd(
    listener: (nodes: readonly NodeHandle[]) => void
  ): Unsubscribe {
    if (!dragEndSource) {
      throw new ComfyApiError(
        'Drag completion is unavailable: the host has not provided a source.'
      )
    }
    return dragEndSource((nodeIds) => {
      const nodes = nodeIds
        .map(handleFor)
        .filter((node): node is NodeHandle => !!node && !node.isDeleted)
      if (nodes.length) listener(nodes)
    })
  }
}
