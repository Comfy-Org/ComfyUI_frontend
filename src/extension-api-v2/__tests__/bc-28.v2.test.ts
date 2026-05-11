// Category: BC.28 — Subgraph fan-out via set/get virtual nodes
// DB cross-ref: S9.SG1
// Exemplar: https://github.com/kijai/ComfyUI-KJNodes/blob/main/web/js/setgetnodes.js#L1406
// blast_radius: 4.97
// compat-floor: blast_radius ≥ 2.0
// v2 contract: defineNodeExtension({ virtual: true, resolveConnections(node, graph) → ResolvedEdges })
// Decision: I-UWF.5 (2026-05-08) — Option (b) accepted. Phase B only.
// resolveConnections is pure; runtime materializes edges at save time (UWF Phase 3).

import { describe, it } from 'vitest'

describe('BC.28 v2 contract — subgraph fan-out via set/get virtual nodes', () => {
  describe('S9.SG1 — virtual: true declaration', () => {
    it.todo(
      'defineNodeExtension({ virtual: true }) excludes the node from spec.edges in the serialized prompt'
    )
    it.todo(
      'virtual nodes do not appear in the serialized workflow output keyed by node id'
    )
    it.todo(
      'virtual: true without resolveConnections is a type error at registration time'
    )
  })

  describe('S9.SG1 — resolveConnections(node, graph) → ResolvedEdges', () => {
    it.todo(
      'resolveConnections receives a read-only view of the virtual node and the full graph'
    )
    it.todo(
      'resolveConnections returns an array of { from: NodeSlotRef, to: NodeSlotRef } real edges'
    )
    it.todo(
      'runtime calls resolveConnections for every virtual node during spec materialization at save time'
    )
    it.todo(
      'resolveConnections returning an empty array removes this virtual node from the spec entirely'
    )
    it.todo(
      'resolveConnections must be pure — mutations to node or graph throw in development mode'
    )
  })
})
