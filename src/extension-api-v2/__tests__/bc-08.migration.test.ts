// Category: BC.08 — Programmatic linking
// DB cross-ref: S10.D2
// Exemplar: https://github.com/goodtab/ComfyUI-Custom-Scripts/blob/main/web/js/quickNodes.js#L138
// Migration: v1 node.connect/disconnectInput → v2 NodeHandle.connect/disconnectInput (typed handles)

import { describe, it } from 'vitest'

describe('BC.08 migration — programmatic linking', () => {
  describe('connect() equivalence', () => {
    it.todo(
      'v1 node.connect(srcSlot, targetNode, dstSlot) and v2 NodeHandle.connect(srcSlot, targetHandle, dstSlot) produce identical graph link state'
    )
    it.todo(
      'link id returned by v2 connect() matches the id on the underlying LGraph link created by an equivalent v1 call'
    )
    it.todo(
      'v2 connect() with a type-incompatible pair raises a typed error; v1 returns null — callers must handle both forms during migration'
    )
  })

  describe('disconnectInput() equivalence', () => {
    it.todo(
      'v1 node.disconnectInput(slot) and v2 NodeHandle.disconnectInput(slotIndex) both leave the graph with no link on that slot'
    )
    it.todo(
      'onConnectionsChange (v1) and on(\'connectionChange\') (v2) both fire for the same disconnect operation with equivalent payload data'
    )
  })

  describe('handle vs. raw node reference', () => {
    it.todo(
      'v2 NodeHandle.connect() accepts a NodeHandle for targetHandle; passing a raw LGraphNode instance throws a deprecation error'
    )
    it.todo(
      'NodeHandle obtained from v2 nodeCreated correctly wraps the same node that v1 connect() would operate on'
    )
  })
})
