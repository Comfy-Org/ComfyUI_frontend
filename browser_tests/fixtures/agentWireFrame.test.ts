import { applyOps, mint, nodesMap } from '@comfyorg/comfy-multi-player'
import type { Op, WireOp } from '@comfyorg/comfy-multi-player'
import { describe, expect, it } from 'vitest'

import {
  mintOpId,
  mintWireOps
} from '@/workbench/extensions/agent/crdt/opEnvelope'
import type { GraphOperation } from '@/workbench/extensions/agent/crdt/graphOperations'

import { isValidDocOpsBatch, parseWireOps } from '@e2e/fixtures/agentWireFrame'
import type { WireOpEnvelope } from '@e2e/fixtures/agentWireFrame'

const MINT = { actor: 'human:test-user:tab-1', baseVersion: 7 }

function addNode(id: number): GraphOperation {
  return {
    op: 'add_node',
    node_id: id,
    class_type: 'TestNode',
    pos: [10, 20],
    node: { id, type: 'TestNode', pos: [10, 20] }
  }
}

describe('parseWireOps', () => {
  const resetDoc: WireOp = {
    op: 'reset_doc',
    op_id: mintOpId(),
    actor: MINT.actor,
    base_version: MINT.baseVersion,
    stamp: [MINT.baseVersion, MINT.actor],
    workflow: { nodes: [], links: [] }
  }

  it('reports a valid empty batch as ok for a frame that carries no ops', () => {
    expect(parseWireOps(undefined)).toEqual({ ok: true, ops: [] })
  })

  it('reports invalid_frame for a non-array value', () => {
    expect(parseWireOps('not-an-array')).toEqual({
      ok: false,
      reason: 'invalid_frame'
    })
  })

  it('reports invalid_frame for the whole batch when any member is not wire-shaped', () => {
    const [addOp] = mintWireOps([addNode(1)], MINT)
    expect(parseWireOps([addOp, { op: 'add_node' }])).toEqual({
      ok: false,
      reason: 'invalid_frame'
    })
  })

  it('passes every declared kind through unfiltered, including a deferred one', () => {
    const [addOp] = mintWireOps([addNode(1)], MINT)
    expect(parseWireOps([resetDoc, addOp])).toEqual({
      ok: true,
      ops: [resetDoc, addOp]
    })
  })

  it('reaches the real applier intact: a leading reset_doc defers and aborts the batch', () => {
    const doc = mint({ nodes: [], links: [] }, { types: {} })
    const [addOp] = mintWireOps([addNode(1)], MINT)

    const parsed = parseWireOps([resetDoc, addOp])
    if (!parsed.ok) throw new Error('expected a valid batch')
    const result = applyOps(doc, parsed.ops as Op[])

    expect(result.outcomes).toEqual([
      {
        op_id: resetDoc.op_id,
        outcome: 'rejected',
        reason: expect.objectContaining({ code: 'op_deferred' })
      },
      {
        op_id: addOp.op_id,
        outcome: 'rejected',
        reason: expect.objectContaining({ code: 'batch_aborted' })
      }
    ])
    expect(nodesMap(doc).has('1')).toBe(false)
  })
})

describe('isValidDocOpsBatch', () => {
  const envelope = (opId: string): WireOpEnvelope => ({
    op: 'add_node',
    op_id: opId
  })

  it.for([
    { label: 'empty', ops: [] },
    {
      label: 'duplicate op_ids',
      ops: [envelope('a'.repeat(32)), envelope('a'.repeat(32))]
    }
  ])('rejects a batch that is $label', ({ ops }) => {
    expect(isValidDocOpsBatch(ops)).toBe(false)
  })

  it('accepts a non-empty batch with unique op_ids', () => {
    expect(
      isValidDocOpsBatch([envelope('a'.repeat(32)), envelope('b'.repeat(32))])
    ).toBe(true)
  })
})
