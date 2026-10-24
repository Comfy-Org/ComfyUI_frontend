import {
  applyOps,
  inspectOps,
  mint,
  nodesMap
} from '@comfyorg/comfy-multi-player'
import type { Op } from '@comfyorg/comfy-multi-player'
import { describe, expect, it } from 'vitest'

import type { GraphOperation } from './graphOperations'
import { chunkWireOps, mintWireOps } from './opEnvelope'

const MINT = { actor: 'human:test-user:tab-1', baseVersion: 7 }

function sizedOf(op: Op) {
  return { op, bytes: inspectOps([op])[0].canonical_op.byteLength }
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

describe('mintWireOps', () => {
  it('produces ops the real applier applies once across retries', () => {
    const doc = mint({ nodes: [], links: [] }, { types: {} })
    const ops = mintWireOps([addNode(1)], MINT)

    expect(applyOps(doc, ops).outcomes).toEqual([
      { op_id: ops[0].op_id, outcome: 'applied' }
    ])
    expect(applyOps(doc, ops).outcomes).toEqual([
      { op_id: ops[0].op_id, outcome: 'no-op' }
    ])
    expect(nodesMap(doc).has('1')).toBe(true)
    doc.destroy()
  })
})

describe('chunkWireOps', () => {
  it('splits on the per-batch op cap, preserving order', () => {
    const ops = mintWireOps(
      Array.from({ length: 600 }, (_, i) => addNode(i)),
      MINT
    )
    const batches = chunkWireOps(ops.map(sizedOf))

    expect(batches.map((batch) => batch.length)).toEqual([256, 256, 88])
    expect(batches.flat().map((sized) => sized.op)).toEqual(ops)
  })

  it('splits at the byte cap and ships a single oversize op alone', () => {
    const ops = mintWireOps([addNode(1), addNode(2), addNode(3)], MINT)
    const sized = ops.map((op, index) => ({
      op,
      bytes: [2 * 1024 * 1024, 2 * 1024 * 1024, 4 * 1024 * 1024 + 1][index]
    }))

    expect(chunkWireOps(sized)).toEqual([sized.slice(0, 2), sized.slice(2)])
  })
})
