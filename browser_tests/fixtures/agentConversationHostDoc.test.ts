import { project } from '@comfyorg/comfy-multi-player'
import { describe, expect, it } from 'vitest'
import * as Y from 'yjs'

import type { GraphOperation } from '@/workbench/extensions/agent/crdt/graphOperations'
import { mintWireOps } from '@/workbench/extensions/agent/crdt/opEnvelope'

import { HostDoc } from '@e2e/fixtures/agentConversationHostDoc'
import type { HostFrame } from '@e2e/fixtures/agentConversationHostDoc'

describe('HostDoc.applyWire', () => {
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

  it('broadcasts the delta of an overwritten write so later updates still integrate', () => {
    const host = new HostDoc(
      'workflow-1',
      { nodes: [], links: [] },
      { types: {} }
    )
    const replica = new Y.Doc()
    const integrate = (frame: HostFrame | null) => {
      if (frame === null) return
      const { update_b64 } = frame.data as { update_b64: string }
      Y.applyUpdate(replica, new Uint8Array(Buffer.from(update_b64, 'base64')))
    }
    host.initialSync().forEach((frame) => {
      if (frame.type === 'doc_update') integrate(frame)
    })
    const addNode = (nodeId: number, actor: string, baseVersion: number) =>
      mintWireOps(
        [
          {
            op: 'add_node',
            node_id: nodeId,
            class_type: 'TestNode',
            pos: [nodeId, nodeId],
            node: { id: nodeId, type: 'TestNode', pos: [nodeId, nodeId] }
          }
        ],
        { actor, baseVersion }
      )

    integrate(host.applyWire(addNode(1, 'agent:test', 5)).update)
    const lost = host.applyWire(addNode(1, 'human:test-user:tab-1', 1))
    integrate(lost.update)
    integrate(host.applyWire(addNode(2, 'human:test-user:tab-1', 6)).update)

    expect(lost.result.data).toMatchObject({
      applied: [],
      lww_dropped: [lost.outcomes[0].op_id]
    })
    expect(replica.store.pendingStructs).toBeNull()
    const nodeIds = project(replica, { types: {} }).nodes.map((node) =>
      String(node.id)
    )
    expect(nodeIds).toHaveLength(2)
    expect(nodeIds).toEqual(expect.arrayContaining(['1', '2']))
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
