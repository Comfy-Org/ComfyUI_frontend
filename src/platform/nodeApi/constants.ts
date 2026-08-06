/**
 * Renderer values a pack needs to lay itself out, so it never reads
 * `LiteGraph.*`.
 *
 * Packs need these for honest reasons — a slot's row height to place a label, a
 * title height to leave room above a mounted element. Reading them off the
 * `LiteGraph` global means the pack breaks when a constant is renamed, and it
 * keeps the legacy object alive in an otherwise converted file.
 *
 * Returned by value, and frozen. Handing back the renderer's own object would
 * let a pack write to it, and would make every field a public contract.
 */
import { LGraphCanvas, LiteGraph } from '@/lib/litegraph/src/litegraph'

export interface ApiConstants {
  /** Height of one widget/slot row, in graph units. */
  readonly slotHeight: number
  /** Height of the node title bar, in graph units. */
  readonly titleHeight: number
  /** Corner radius the renderer draws nodes with. */
  readonly cornerRadius: number
  /**
   * Whether the DOM renderer is active rather than the canvas one.
   *
   * Exposed reluctantly: a pack should not usually care, because `widgets.mount`
   * and `widgets.canvas` work under both. It is here for the cases that must
   * pick a strategy — an animation driven by CSS versus one driven by repaint.
   */
  readonly domRenderer: boolean
}

export function apiConstants(): ApiConstants {
  return Object.freeze({
    slotHeight: LiteGraph.NODE_SLOT_HEIGHT,
    titleHeight: LiteGraph.NODE_TITLE_HEIGHT,
    cornerRadius: LiteGraph.ROUND_RADIUS,
    domRenderer: LiteGraph.vueNodesMode === true
  })
}

/**
 * Whether the editor is already in the middle of a gesture — dragging a link,
 * resizing a node, or dragging a widget.
 *
 * A pack that runs its own pointer gesture must stand down while this is true,
 * or it fires in the middle of the user doing something else. Two kjnodes files
 * read `connecting_links`, `resizing_node` and `node_widget` off the canvas to
 * ask exactly this, and they are the same question, not three.
 *
 * A boolean rather than the state itself: which gestures exist, and what they
 * are called, is the editor's business and will change.
 */
export function isInteracting(): boolean {
  const canvas = LGraphCanvas.active_canvas
  if (!canvas) return false
  return (
    canvas.connecting_links != null ||
    canvas.resizing_node != null ||
    canvas.node_widget != null
  )
}
