import { BATCHABLE_OPS } from '@comfyorg/comfy-multi-player'
import type { Op } from '@comfyorg/comfy-multi-player'
import * as fc from 'fast-check'
import { assert, describe, expect, it } from 'vitest'

import type { GraphOperation } from './graphOperations'
import type { SizedOp } from './opEnvelope'
import { chunkWireOps, measureWireOp, mintWireOps } from './opEnvelope'

const MINT = { actor: 'human:pbt-user:tab-1', baseVersion: 7 }

function addNode(id: number): GraphOperation {
  return {
    op: 'add_node',
    node_id: id,
    class_type: 'TestNode',
    pos: [id, id],
    node: {
      id,
      type: 'TestNode',
      pos: [id, id],
      inputs: [],
      outputs: [],
      widgets_values: []
    }
  }
}

function setWidget(id: number, value: unknown): GraphOperation {
  return { op: 'set_widget', node_id: id, widget: 'text', value }
}

function deleteNode(id: number): GraphOperation {
  return { op: 'delete_node', node_id: id, removed_links: [] }
}

function clear(ids: number[]): GraphOperation {
  return { op: 'clear', removed_nodes: ids }
}

function sizedOf(op: Op): SizedOp {
  const measured = measureWireOp(op)
  assert(measured.admitted)
  return measured.sized
}

function isBatchable(sized: SizedOp): boolean {
  return BATCHABLE_OPS.some((kind) => kind === sized.op.op)
}

function batchesBelowCaps(ops: SizedOp[]): SizedOp[][] {
  const batches: SizedOp[][] = []
  for (const op of ops) {
    const last = batches.at(-1)
    if (last && isBatchable(op) && isBatchable(last[0])) last.push(op)
    else batches.push([op])
  }
  return batches
}

const operationsArb = fc.array(
  fc.oneof(
    { arbitrary: fc.integer({ min: 0, max: 40 }).map(addNode), weight: 4 },
    {
      arbitrary: fc
        .tuple(fc.integer({ min: 0, max: 40 }), fc.string({ maxLength: 32 }))
        .map(([id, value]) => setWidget(id, value)),
      weight: 4
    },
    { arbitrary: fc.integer({ min: 0, max: 40 }).map(deleteNode), weight: 2 },
    {
      arbitrary: fc
        .array(fc.integer({ min: 0, max: 40 }), { maxLength: 4 })
        .map(clear),
      weight: 1
    }
  ),
  { maxLength: 40 }
)

describe('chunkWireOps (property)', () => {
  it('below the caps, batches each batchable run and isolates the rest', () => {
    fc.assert(
      fc.property(operationsArb, (operations) => {
        const ops = mintWireOps(operations, MINT).map(sizedOf)

        expect(chunkWireOps(ops)).toEqual(batchesBelowCaps(ops))
      })
    )
  })
})

describe('mintWireOps (property)', () => {
  it('adds only a unique envelope to each operation', () => {
    fc.assert(
      fc.property(
        operationsArb,
        fc.string({ minLength: 1, maxLength: 24 }),
        fc.nat(),
        (operations, actor, baseVersion) => {
          const minted = mintWireOps(operations, { actor, baseVersion })

          expect(minted).toEqual(
            operations.map((operation) => ({
              ...operation,
              op_id: expect.stringMatching(/^[0-9a-f]{32}$/),
              actor,
              base_version: baseVersion,
              stamp: [baseVersion, actor]
            }))
          )
          expect(new Set(minted.map((op) => op.op_id)).size).toBe(minted.length)
        }
      )
    )
  })
})
