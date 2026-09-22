import { describe, expect, it } from 'vitest'

import type { GraphOperation } from '@/workbench/extensions/agent/crdt/graphOperations'
import { mintWireOps } from '@/workbench/extensions/agent/crdt/opEnvelope'

import { HostDoc } from '@e2e/fixtures/agentConversationHostDoc'

describe('HostDoc.applyClient', () => {
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

    const frames = host.applyClient(ops)

    expect(frames[0].data).toMatchObject({
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

    const first = host.applyClient(ops)
    const duplicate = host.applyClient(ops)

    expect(first).toHaveLength(2)
    expect(first[0].data).toMatchObject({
      applied: [ops[0].op_id],
      skipped: []
    })
    expect(duplicate).toEqual([
      expect.objectContaining({
        type: 'doc_ops_result',
        data: expect.objectContaining({
          ok: true,
          applied: [],
          skipped: [ops[0].op_id]
        })
      })
    ])
  })
})
