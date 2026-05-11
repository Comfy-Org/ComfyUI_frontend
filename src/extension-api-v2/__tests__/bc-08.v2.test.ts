// Category: BC.08 — Programmatic linking
// DB cross-ref: S10.D2
// Exemplar: https://github.com/goodtab/ComfyUI-Custom-Scripts/blob/main/web/js/quickNodes.js#L138
// blast_radius: 5.99 — compat-floor: blast_radius ≥ 2.0 — MUST pass before v2 ships
// v2 replacement: NodeHandle.connect(slotIndex, targetHandle, dstSlot) — same semantics, typed handles

import { describe, it } from 'vitest'

describe('BC.08 v2 contract — programmatic linking', () => {
  describe('NodeHandle.connect(slotIndex, targetHandle, dstSlot) — create links', () => {
    it.todo(
      'NodeHandle.connect(slotIndex, targetHandle, dstSlot) creates a link between the source output slot and the target input slot'
    )
    it.todo(
      'connect() returns a LinkHandle with a stable id that matches the underlying graph link id'
    )
    it.todo(
      'connect() on an already-occupied input slot replaces the existing link and the old LinkHandle becomes invalid'
    )
    it.todo(
      'connect() with a type-incompatible slot pair throws a typed error and leaves the graph unchanged'
    )
    it.todo(
      'on(\'connectionChange\') fires on both NodeHandles after a successful connect() call'
    )
  })

  describe('NodeHandle.disconnectInput(slotIndex) — remove links', () => {
    it.todo(
      'NodeHandle.disconnectInput(slotIndex) removes the link on the specified input slot and the returned LinkHandle becomes invalid'
    )
    it.todo(
      'disconnectInput() on an empty slot is a no-op and does not throw'
    )
    it.todo(
      'on(\'connectionChange\') fires on both source and target NodeHandles after disconnectInput() removes a link'
    )
  })
})
