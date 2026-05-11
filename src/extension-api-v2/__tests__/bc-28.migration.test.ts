// Category: BC.28 — Subgraph fan-out via set/get virtual nodes
// DB cross-ref: S9.SG1
// Exemplar: https://github.com/kijai/ComfyUI-KJNodes/blob/main/web/js/setgetnodes.js#L1406
// blast_radius: 4.97
// compat-floor: blast_radius ≥ 2.0
// migration: isVirtualNode=true + graphToPrompt monkey-patch → defineNodeExtension({ virtual: true, resolveConnections })
// Decision: I-UWF.5 (2026-05-08) — S8.P1 → virtual: true (mechanical rename); S9.SG1 → add resolveConnections.
// Classified uwf-resolved per I-PG.B2 — UWF Phase 3 is the migration path.

import { describe, it } from 'vitest'

describe('BC.28 migration — subgraph fan-out via set/get virtual nodes', () => {
  describe('S8.P1 — isVirtualNode flag migration', () => {
    it.todo(
      'v1 class-level isVirtualNode=true is replaced by defineNodeExtension({ virtual: true, resolveConnections })'
    )
    it.todo(
      'v2 compat shim recognizes isVirtualNode=true on a registered class and emits a migration warning'
    )
    it.todo(
      'migration is mechanical: rename isVirtualNode=true to virtual: true and add resolveConnections stub'
    )
  })

  describe('S9.SG1 — graphToPrompt monkey-patch migration', () => {
    it.todo(
      'v1 graphToPrompt patch that rewrites link.target_id is replaced by resolveConnections returning ResolvedEdges'
    )
    it.todo(
      'v2 resolveConnections receives the same graph state that v1 graphToPrompt received, as a read-only view'
    )
    it.todo(
      'v2 compat shim logs a deprecation warning when graphToPrompt is monkey-patched for virtual node resolution'
    )
    it.todo(
      'for cg-use-everywhere topology inference (graph-wide, not per-type): ctx.on("beforePrompt") is the bridge until UWF Phase 3'
    )
  })
})
