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
import { LiteGraph } from '@/lib/litegraph/src/litegraph'

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
