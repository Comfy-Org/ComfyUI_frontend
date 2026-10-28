import type { Op } from '@comfyorg/comfy-multi-player'
import { applyOps, mint, nodesMap } from '@comfyorg/comfy-multi-player'
import { assert, describe, expect, it } from 'vitest'

import type { GraphOperation } from './graphOperations'
import type { SizedOp } from './opEnvelope'
import {
  WIRE_MAX_BATCH_BYTES,
  WIRE_MAX_OPS_PER_BATCH,
  chunkWireOps,
  measureWireOp,
  mintOpId,
  mintWireOps
} from './opEnvelope'

const MINT = { actor: 'human:test-user:tab-1', baseVersion: 7 }

// The mint seam's vocabulary is the five implemented kinds only: the deferred
// reset_doc stays outside GraphOperation (plan §2), pinned at compile time -
// if the derivation ever admits it, this @ts-expect-error goes unused and
// typecheck fails.
// @ts-expect-error reset_doc is DeferredOp, not a mintable GraphOperation
const REJECTED_RESET_DOC: GraphOperation = { op: 'reset_doc' }
void REJECTED_RESET_DOC

function sizedOf(op: Op): SizedOp {
  const measured = measureWireOp(op)
  assert(measured.admitted)
  return measured.sized
}

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
    const batches = chunkWireOps(ops.map(sizedOf))

    expect(batches.map((b) => b.length)).toEqual([256, 256, 88])
    expect(batches.flat().map((sized) => sized.op)).toEqual(ops)
    expect(WIRE_MAX_OPS_PER_BATCH).toBe(256)
  })

  it('isolates clear in a batch of exactly one', () => {
    const clear: GraphOperation = { op: 'clear', removed_nodes: [1, 2] }
    const ops = mintWireOps([addNode(1), clear, addNode(2)], MINT)

    const batches = chunkWireOps(ops.map(sizedOf))

    expect(batches.map((b) => b.map((sized) => sized.op.op))).toEqual([
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

    const batches = chunkWireOps(ops.map(sizedOf))

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
    const sized = mintWireOps([huge], MINT).map(sizedOf)

    expect(chunkWireOps(sized)).toEqual([sized])
  })
})

describe('measureWireOp', () => {
  it('reports the UTF-8 wire size, not the UTF-16 length, of the op', () => {
    const threeByteChars = '日本語'
    const [op] = mintWireOps(
      [{ op: 'set_widget', node_id: 1, widget: 'text', value: threeByteChars }],
      MINT
    )
    const json = JSON.stringify(op)
    const extraBytesPerChar = 2

    expect(measureWireOp(op)).toEqual({
      admitted: true,
      sized: {
        op,
        wire: JSON.parse(json),
        bytes: json.length + threeByteChars.length * extraBytesPerChar
      }
    })
  })

  it('accepts an op whose toJSON still yields a wire object with its op_id', () => {
    const [op] = mintWireOps([addNode(1)], MINT)
    const wire = { ...op }
    Object.assign(op, { toJSON: () => wire })

    expect(measureWireOp(op)).toEqual({
      admitted: true,
      sized: { op, wire, bytes: JSON.stringify(wire).length }
    })
  })

  it('rejects an op whose toJSON returns undefined', () => {
    const [op] = mintWireOps([addNode(1)], MINT)
    Object.assign(op, { toJSON: () => undefined })

    expect(measureWireOp(op)).toEqual({
      admitted: false,
      op,
      cause: new TypeError('Operation did not serialize to JSON')
    })
  })

  it.for([
    { label: 'null', serialized: null },
    { label: 'a number', serialized: 42 },
    { label: 'a string', serialized: 'not-an-operation' },
    { label: 'an array', serialized: [] },
    { label: 'an object without op_id', serialized: { op: 'add_node' } }
  ])('rejects an op whose toJSON returns $label', ({ serialized }) => {
    const [op] = mintWireOps([addNode(1)], MINT)
    Object.assign(op, { toJSON: () => serialized })

    expect(measureWireOp(op)).toEqual({
      admitted: false,
      op,
      cause: new TypeError('Operation did not serialize to a wire object')
    })
  })

  it.for([
    { label: 'kind', patch: { op: 'clear' } },
    { label: 'op_id', patch: { op_id: mintOpId() } },
    { label: 'actor', patch: { actor: 'human:other-user:tab-9' } },
    { label: 'base_version', patch: { base_version: 999 } },
    { label: 'stamp version', patch: { stamp: [999, MINT.actor] } },
    { label: 'stamp actor', patch: { stamp: [7, 'human:other-user:tab-9'] } }
  ])('rejects an op whose toJSON rewrites the envelope $label', ({ patch }) => {
    const [op] = mintWireOps([addNode(1)], MINT)
    Object.assign(op, { toJSON: () => ({ ...op, ...patch }) })

    expect(measureWireOp(op)).toEqual({
      admitted: false,
      op,
      cause: new TypeError('Operation serialized with a different envelope')
    })
  })

  it.for([
    {
      label: 'serializes the moved envelope',
      toJSON(this: Op) {
        this.base_version = 9
        this.stamp = [9, MINT.actor]
        return { ...this }
      },
      message: 'Operation serialized with a different envelope'
    },
    {
      label: 'serializes the minted envelope',
      toJSON(this: Op) {
        const wire = { ...this, stamp: [...this.stamp] }
        this.base_version = 9
        this.stamp[0] = 9
        return wire
      },
      message: 'Operation changed its envelope while serializing'
    }
  ])(
    'rejects an op whose toJSON moves its own envelope and $label',
    ({ toJSON, message }) => {
      const [op] = mintWireOps([addNode(1)], MINT)
      Object.assign(op, { toJSON })

      expect(measureWireOp(op)).toEqual({
        admitted: false,
        op,
        cause: new TypeError(message)
      })
    }
  )

  it('rejects an op whose toJSON throws, carrying the thrown value as the cause', () => {
    const [op] = mintWireOps([addNode(1)], MINT)
    const thrown = new Error('serializer boom')
    Object.assign(op, {
      toJSON: () => {
        throw thrown
      }
    })

    expect(measureWireOp(op)).toEqual({ admitted: false, op, cause: thrown })
  })
})
