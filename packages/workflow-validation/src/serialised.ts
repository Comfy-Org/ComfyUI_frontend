/**
 * Minimal structural types for serialised workflow JSON.
 *
 * The validation/repair code in this package operates on plain JSON
 * (parsed `.json` workflow files) — it does NOT need the runtime
 * `LGraph`/`LGraphNode` classes from litegraph. Defining the shapes
 * locally keeps this package free of frontend/litegraph coupling so
 * it can be consumed by Node.js CI scripts and a future backend
 * validator.
 *
 * These types intentionally mirror the relevant fields used by
 * `validateLinkTopology` and `repairLinks`. They are a subset of the
 * `ISerialisedGraph` / `ISerialisedNode` shapes from
 * `@/lib/litegraph/src/types/serialisation` and stay structurally
 * compatible with them.
 */

/** Schema version 0.4 link tuple: `[id, originId, originSlot, targetId, targetSlot, type]`. */
export type SerialisedLinkArray = [
  number,
  string | number,
  number,
  string | number,
  number,
  string | string[] | number
]

/** Object form of a link (schema version 1, or after live-graph hydration). */
export interface SerialisedLinkObject {
  id: number
  origin_id: string | number
  origin_slot: number
  target_id: string | number
  target_slot: number
  type?: string | string[] | number
}

export interface SerialisedNodeInput {
  name?: string
  type?: string | string[] | number
  link?: number | null
}

export interface SerialisedNodeOutput {
  name?: string
  type?: string | string[] | number
  links?: number[] | null
}

export interface SerialisedNode {
  id: string | number
  type?: string
  inputs?: SerialisedNodeInput[]
  outputs?: SerialisedNodeOutput[]
}

export interface SerialisedGraph {
  nodes: SerialisedNode[]
  links: Array<SerialisedLinkArray | SerialisedLinkObject | null>
}
