import { describe, expect, it } from 'vitest'

import type { GraphOperation } from '@/workbench/extensions/agent/crdt/graphOperations'
import { mintWireOps } from '@/workbench/extensions/agent/crdt/opEnvelope'

import { HostDoc } from '@e2e/fixtures/agentConversationHostDoc'

describe('HostDoc.applyWire', () => {
  it('applies a coalesced canvas clear to the host document', () => {
    const host = new HostDoc(
      'workflow-1',
      {
        nodes: [
          { id: 1, type: 'TestNode', pos: [0, 0] },
          { id: 2, type: 'TestNode', pos: [100, 100] }
        ],
        links: []
      },
      { types: {} }
    )
    const ops = mintWireOps(
      [
        { op: 'delete_node', node_id: 1, removed_links: [] },
        { op: 'delete_node', node_id: 2, removed_links: [] }
      ],
      {
        actor: 'human:test-user:tab-1',
        baseVersion: 1
      }
    )

    const { result } = host.applyWire(ops)

    expect(result.data).toMatchObject({
      ok: true,
      applied: ops.map((op) => op.op_id),
      skipped: []
    })
    expect(host.projection().nodes).toEqual([])
  })

  it('acknowledges a duplicate operation as skipped without broadcasting an update', () => {
    const host = new HostDoc(
      'workflow-1',
      { nodes: [], links: [] },
      { types: {} }
    )
    const operation: GraphOperation = {
      op: 'add_node',
      node_id: 1,
      class_type: 'TestNode',
      pos: [137, 283],
      node: { id: 1, type: 'TestNode', pos: [137, 283] }
    }
    const ops = mintWireOps([operation], {
      actor: 'human:test-user:tab-1',
      baseVersion: 1
    })

    const first = host.applyWire(ops)
    const duplicate = host.applyWire(ops)

    expect(first.update).not.toBeNull()
    expect(first.result.data).toMatchObject({
      applied: [ops[0].op_id],
      skipped: []
    })
    expect(duplicate.update).toBeNull()
    expect(duplicate.result).toEqual(
      expect.objectContaining({
        type: 'doc_ops_result',
        data: expect.objectContaining({
          ok: true,
          applied: [],
          skipped: [ops[0].op_id]
        })
      })
    )
  })

  it('classifies a same-batch duplicate op_id as skipped, not applied twice', () => {
    const host = new HostDoc(
      'workflow-1',
      { nodes: [], links: [] },
      { types: {} }
    )
    const operation: GraphOperation = {
      op: 'add_node',
      node_id: 1,
      class_type: 'TestNode',
      pos: [137, 283],
      node: { id: 1, type: 'TestNode', pos: [137, 283] }
    }
    const [op] = mintWireOps([operation], {
      actor: 'human:test-user:tab-1',
      baseVersion: 1
    })

    const { result } = host.applyWire([op, op])

    expect(result.data).toMatchObject({
      applied: [op.op_id],
      skipped: [op.op_id]
    })
  })
})
