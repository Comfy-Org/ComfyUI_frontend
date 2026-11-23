import type { NodeId } from '@comfyorg/graph-model/nodeId'

import type { LGraph } from '@/lib/litegraph/src/LGraph'
import type { LGraphCanvas } from '@/lib/litegraph/src/LGraphCanvas'

/** A node's new top-left corner, in graph space. */
export interface NodeMove {
  readonly nodeId: NodeId
  readonly x: number
  readonly y: number
}

/** What the renderer tells the API about the canvas. Every read is reactive. */
export interface CanvasSource {
  /** The graph on screen. */
  visibleGraph(): LGraph | null
  canvas(): LGraphCanvas | null
  /** Passes each layout change that moves nodes to `moved` until stopped. */
  followMoves(
    moved: (rootGraphId: string, moves: readonly NodeMove[]) => void
  ): () => void
  /** Calls `ended` each time a drag ends, under either renderer, until stopped. */
  followDragEnds(ended: () => void): () => void
}
