import { applyOps, mint, nodesMap } from '@comfyorg/comfy-multi-player'
import type { Op, WireOp } from '@comfyorg/comfy-multi-player'
import { describe, expect, it } from 'vitest'

import type { GraphOperation } from './graphOperations'
import {
  WIRE_MAX_BATCH_BYTES,
  WIRE_MAX_OPS_PER_BATCH,
  chunkWireOps,
  mintOpId,
  mintWireOps,
  parseWireOps
} from './opEnvelope'

const MINT = { actor: 'human:test-user:tab-1', baseVersion: 7 }

// The mint seam's vocabulary is the five implemented kinds only: the deferred
// reset_doc stays outside GraphOperation (plan §2), pinned at compile time -
// if the derivation ever admits it, this @ts-expect-error goes unused and
// typecheck fails.
// @ts-expect-error reset_doc is DeferredOp, not a mintable GraphOperation
const REJECTED_RESET_DOC: GraphOperation = { op: 'reset_doc' }
void REJECTED_RESET_DOC

function addNode(id: number): GraphOperation {
  return {
    op: 'add_node',
    node_id: id,
    class_type: 'TestNode',
    pos: [10, 20],
    node: { id, type: 'TestNode', pos: [10, 20] }
  }
}

describe('mintOpId', () => {
  it('mints 32 lowercase hex chars, unique per call', () => {
    const a = mintOpId()
    const b = mintOpId()
    expect(a).toMatch(/^[0-9a-f]{32}$/)
    expect(b).toMatch(/^[0-9a-f]{32}$/)
    expect(a).not.toBe(b)
  })
})

describe('mintWireOps', () => {
  it('attaches the full envelope and preserves the payload verbatim', () => {
    const [op] = mintWireOps([addNode(1)], MINT)

    expect(op.op_id).toMatch(/^[0-9a-f]{32}$/)
    expect(op.actor).toBe(MINT.actor)
    expect(op.base_version).toBe(7)
    expect(op.stamp).toEqual([7, MINT.actor])
    expect(op.op).toBe('add_node')
    expect(op).toMatchObject(addNode(1))
  })

  it('mints a distinct op_id per operation in one batch', () => {
    const ops = mintWireOps([addNode(1), addNode(2), addNode(3)], MINT)
    const ids = new Set(ops.map((op) => op.op_id))
    expect(ids.size).toBe(3)
  })

  it('produces ops the real applier accepts and applies', () => {
    const doc = mint({ nodes: [], links: [] }, { types: {} })
    const ops = mintWireOps([addNode(1)], MINT)

    const result = applyOps(doc, ops)

    expect(result.outcomes).toEqual([
      { op_id: ops[0].op_id, outcome: 'applied' }
    ])
    expect(nodesMap(doc).has('1')).toBe(true)
  })

  it('re-sending the same minted ops is idempotent at the applier', () => {
    const doc = mint({ nodes: [], links: [] }, { types: {} })
    const ops = mintWireOps([addNode(1)], MINT)

    applyOps(doc, ops)
    const retry = applyOps(doc, ops)

    expect(retry.outcomes).toEqual([{ op_id: ops[0].op_id, outcome: 'no-op' }])
    expect(nodesMap(doc).has('1')).toBe(true)
  })
})

describe('chunkWireOps', () => {
  it('splits on the per-batch op cap, order preserved', () => {
    const ops = mintWireOps(
      Array.from({ length: 600 }, (_, i) => addNode(i)),
      MINT
    )
    const batches = chunkWireOps(ops)

    expect(batches.map((b) => b.length)).toEqual([256, 256, 88])
    expect(batches.flat()).toEqual(ops)
    expect(WIRE_MAX_OPS_PER_BATCH).toBe(256)
  })

  it('isolates clear in a batch of exactly one', () => {
    const clear: GraphOperation = { op: 'clear', removed_nodes: [1, 2] }
    const ops = mintWireOps([addNode(1), clear, addNode(2)], MINT)

    const batches = chunkWireOps(ops)

    expect(batches.map((b) => b.map((op) => op.op))).toEqual([
      ['add_node'],
      ['clear'],
      ['add_node']
    ])
  })

  it('splits on the per-batch byte cap', () => {
    const bigValue = 'x'.repeat(Math.ceil(WIRE_MAX_BATCH_BYTES / 2))
    const setWidget = (id: number): GraphOperation => ({
      op: 'set_widget',
      node_id: id,
      widget: 'text',
      value: bigValue
    })
    const ops = mintWireOps([setWidget(1), setWidget(2), setWidget(3)], MINT)

    const batches = chunkWireOps(ops)

    expect(batches.length).toBe(3)
    expect(batches.every((b) => b.length === 1)).toBe(true)
  })

  it('ships a single oversize op alone rather than dropping it', () => {
    const huge: GraphOperation = {
      op: 'set_widget',
      node_id: 1,
      widget: 'text',
      value: 'x'.repeat(WIRE_MAX_BATCH_BYTES + 16)
    }
    const ops: Op[] = mintWireOps([huge], MINT)

    expect(chunkWireOps(ops)).toEqual([ops])
  })
})

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
