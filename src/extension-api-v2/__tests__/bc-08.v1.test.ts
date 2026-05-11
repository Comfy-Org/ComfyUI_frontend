// Category: BC.08 — Programmatic linking
// DB cross-ref: S10.D2
// Exemplar: https://github.com/goodtab/ComfyUI-Custom-Scripts/blob/main/web/js/quickNodes.js#L138
// blast_radius: 5.99 — compat-floor: blast_radius ≥ 2.0 — MUST pass before v2 ships
// v1 contract: node.connect(srcSlot, targetNode, dstSlot)
//              node.disconnectInput(slot)

import { describe, it } from 'vitest'

describe('BC.08 v1 contract — programmatic linking', () => {
  describe('S10.D2 — node.connect(srcSlot, targetNode, dstSlot)', () => {
    it.todo(
      'node.connect(srcSlot, targetNode, dstSlot) creates a link between the source output slot and the target input slot'
    )
    it.todo(
      'connect() returns the newly created link object with a stable numeric id'
    )
    it.todo(
      'connect() on an already-occupied input slot replaces the existing link without leaving a dangling reference'
    )
    it.todo(
      'connect() with a type-incompatible slot pair is rejected and returns null without modifying the graph'
    )
    it.todo(
      'onConnectionsChange fires on both the source and target node after a successful connect() call'
    )
  })

  describe('S10.D2 — node.disconnectInput(slot)', () => {
    it.todo(
      'node.disconnectInput(slot) removes the link on the specified input slot and updates both endpoint nodes'
    )
    it.todo(
      'disconnectInput() on an empty slot is a no-op and does not throw'
    )
    it.todo(
      'onConnectionsChange fires on both the source and target node after disconnectInput() removes a link'
    )
  })
})
