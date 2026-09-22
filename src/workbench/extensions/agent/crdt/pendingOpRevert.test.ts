import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { NodeId, Op, OpBase } from '@comfyorg/comfy-multi-player'

import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { reportError } from '@/platform/telemetry/reportError'
import { toNodeId } from '@/types/nodeId'

import type {
  PendingRevertNodeRegistry,
  PendingRevertRemoval,
  RevertableGraph
} from './pendingOpRevert'
import {
  PENDING_REVERT_ACTOR,
  applyPendingOpRevert,
  createPendingRevertNodeRegistry,
  createRevertNotifier
} from './pendingOpRevert'
import type { PendingOpTrackerEvent } from './pendingOpTracker'

vi.mock(import('@/platform/telemetry/reportError'), () => ({
  reportError: vi.fn()
}))

const ACTOR = 'human:test-user:tab-1'

function envelope(opId: string): OpBase {
  return { op_id: opId, actor: ACTOR, base_version: 41, stamp: [41, ACTOR] }
}

function addNode(opId: string, nodeId: number): Op {
  return {
    ...envelope(opId),
    op: 'add_node',
    node_id: nodeId,
    class_type: 'TestNode',
    pos: [0, 0],
    node: { id: nodeId, type: 'TestNode' }
  }
}

function deleteNode(opId: string, nodeId: number): Op {
  return {
    ...envelope(opId),
    op: 'delete_node',
    node_id: nodeId,
    removed_links: []
  }
}

function reverted(ops: Op[]): PendingOpTrackerEvent {
  return {
    type: 'reverted',
    reason: 'failed',
    opIds: ops.map((op) => op.op_id),
    ops
  }
}

function registry(
  removeNode: (id: NodeId) => PendingRevertRemoval
): PendingRevertNodeRegistry {
  return {
    onBatchMinted: vi.fn(),
    removeNode: (_opId, nodeId) => removeNode(nodeId),
    release: vi.fn()
  }
}

describe('applyPendingOpRevert', () => {
  beforeEach(() => {
    vi.mocked(reportError).mockClear()
  })

  it('removes only the reverted add_node targets', () => {
    const removeNode = vi.fn<(id: unknown) => PendingRevertRemoval>(
      () => 'removed'
    )

    const removedNodeIds = applyPendingOpRevert(
      reverted([addNode('op-1', 1), deleteNode('op-2', 2), addNode('op-3', 3)]),
      registry(removeNode)
    )

    expect(removeNode.mock.calls).toEqual([[1], [3]])
    expect(removedNodeIds).toEqual([1, 3])
    expect(reportError).not.toHaveBeenCalled()
  })

  it('ignores every event kind other than reverted', () => {
    const removeNode = vi.fn<(id: unknown) => PendingRevertRemoval>(
      () => 'removed'
    )

    const removedNodeIds = applyPendingOpRevert(
      { type: 'cleared', opIds: ['op-1'] },
      registry(removeNode)
    )

    expect(removeNode).not.toHaveBeenCalled()
    expect(removedNodeIds).toEqual([])
  })

  it('retains node identity while delivery remains unknown', () => {
    const pendingNodes = registry(() => 'removed')

    applyPendingOpRevert(
      { type: 'delivery_unknown', opIds: ['op-1'] },
      pendingNodes
    )

    expect(pendingNodes.release).not.toHaveBeenCalled()
  })

  it('a throwing removal is reported and does not strand later ops', () => {
    const failure = new Error('onRemoved threw')
    const removeNode = vi.fn<(id: unknown) => PendingRevertRemoval>((id) => {
      if (id === 1) throw failure
      return 'removed'
    })

    const removedNodeIds = applyPendingOpRevert(
      reverted([addNode('op-1', 1), addNode('op-2', 2)]),
      registry(removeNode)
    )

    expect(removedNodeIds).toEqual([2])
    expect(reportError).toHaveBeenCalledWith(failure, {
      errorType: 'agent_crdt_pending_revert_remove_failed',
      context: { opId: 'op-1', nodeId: '1' }
    })
  })

  it('a refused removal is reported and never counted as undone', () => {
    const removedNodeIds = applyPendingOpRevert(
      reverted([addNode('op-1', 1)]),
      registry(() => 'refused')
    )

    expect(removedNodeIds).toEqual([])
    expect(reportError).toHaveBeenCalledWith(expect.any(Error), {
      errorType: 'agent_crdt_pending_revert_remove_refused',
      context: { opId: 'op-1', nodeId: '1' }
    })
  })

  it('a missing target is already the desired end state', () => {
    const removedNodeIds = applyPendingOpRevert(
      reverted([addNode('op-1', 1)]),
      registry(() => 'missing')
    )

    expect(removedNodeIds).toEqual([])
    expect(reportError).not.toHaveBeenCalled()
  })

  it('no live graph reports once and stops instead of failing silently', () => {
    const removeNode = vi.fn<(id: unknown) => PendingRevertRemoval>(
      () => 'unavailable'
    )

    const removedNodeIds = applyPendingOpRevert(
      reverted([addNode('op-1', 1), addNode('op-2', 2)]),
      registry(removeNode)
    )

    expect(removedNodeIds).toEqual([])
    expect(removeNode).toHaveBeenCalledTimes(1)
    expect(reportError).toHaveBeenCalledExactlyOnceWith(expect.any(Error), {
      errorType: 'agent_crdt_pending_revert_graph_unavailable',
      context: { opId: 'op-1', nodeId: '1' }
    })
  })
})

describe('createPendingRevertNodeRegistry', () => {
  function fakeGraph(nodes: Map<string, { id: unknown }>): RevertableGraph {
    return {
      get _nodes_by_id() {
        return Object.fromEntries(nodes) as RevertableGraph['_nodes_by_id']
      },
      remove(node) {
        nodes.delete(String(node.id))
      }
    }
  }

  it('reports unavailable when no graph is live', () => {
    const pendingNodes = createPendingRevertNodeRegistry({
      getGraph: () => null,
      withLayoutActor: (_actor, fn) => fn()
    })

    expect(pendingNodes.removeNode('op-1', 1)).toBe('unavailable')
  })

  it('reports missing when the target already left the graph', () => {
    const pendingNodes = createPendingRevertNodeRegistry({
      getGraph: () => fakeGraph(new Map()),
      withLayoutActor: (_actor, fn) => fn()
    })

    expect(pendingNodes.removeNode('op-1', 1)).toBe('missing')
  })

  it('removes the live target under the pending-revert layout actor', () => {
    const nodes = new Map([['1', { id: toNodeId(1) }]])
    const actors: string[] = []
    const pendingNodes = createPendingRevertNodeRegistry({
      getGraph: () => fakeGraph(nodes),
      withLayoutActor: (actor, fn) => {
        actors.push(actor)
        return fn()
      }
    })

    pendingNodes.onBatchMinted([addNode('op-1', 1)])
    expect(pendingNodes.removeNode('op-1', 1)).toBe('removed')
    expect(nodes.size).toBe(0)
    expect(actors).toEqual([PENDING_REVERT_ACTOR])
  })

  it('does not remove a newer node that reused the rejected add node id', () => {
    const original = { id: toNodeId(1) }
    const nodes = new Map([['1', original]])
    const pendingNodes = createPendingRevertNodeRegistry({
      getGraph: () => fakeGraph(nodes),
      withLayoutActor: (_actor, fn) => fn()
    })
    pendingNodes.onBatchMinted([addNode('op-1', 1)])
    const replacement = { id: toNodeId(1) }
    nodes.set('1', replacement)

    expect(pendingNodes.removeNode('op-1', 1)).toBe('missing')
    expect(nodes.get('1')).toBe(replacement)
  })

  it('reports refused when the graph declines the removal', () => {
    const node = { id: toNodeId(1) } as unknown as LGraphNode
    const pendingNodes = createPendingRevertNodeRegistry({
      getGraph: () => ({
        _nodes_by_id: { [toNodeId(1)]: node },
        remove: () => undefined
      }),
      withLayoutActor: (_actor, fn) => fn()
    })

    pendingNodes.onBatchMinted([addNode('op-1', 1)])
    expect(pendingNodes.removeNode('op-1', 1)).toBe('refused')
  })
})

describe('createRevertNotifier', () => {
  it('coalesces the reverted events of one settle into a single notification', async () => {
    const notify = vi.fn()
    const onReverted = createRevertNotifier(notify)

    onReverted(reverted([addNode('op-1', 1)]), [1])
    onReverted(reverted([deleteNode('op-2', 2)]), [])
    expect(notify).not.toHaveBeenCalled()

    await Promise.resolve()
    expect(notify).toHaveBeenCalledExactlyOnceWith(true)
  })

  it('notifies without the undone claim when nothing was removed', async () => {
    const notify = vi.fn()
    const onReverted = createRevertNotifier(notify)

    onReverted(reverted([deleteNode('op-1', 1)]), [])
    await Promise.resolve()

    expect(notify).toHaveBeenCalledExactlyOnceWith(false)
  })

  it('stays silent for non-revert events', async () => {
    const notify = vi.fn()
    const onReverted = createRevertNotifier(notify)

    onReverted({ type: 'cleared', opIds: ['op-1'] }, [])
    await Promise.resolve()

    expect(notify).not.toHaveBeenCalled()
  })

  it('claims undone for a mixed add_node + delete_node revert that actually removed the add', async () => {
    const notify = vi.fn()
    const onReverted = createRevertNotifier(notify)

    onReverted(reverted([addNode('op-1', 1), deleteNode('op-2', 2)]), [1])
    await Promise.resolve()

    expect(notify).toHaveBeenCalledExactlyOnceWith(true)
  })

  it('never claims an undo for a non-add_node revert, even if a node id was somehow removed', async () => {
    const notify = vi.fn()
    const onReverted = createRevertNotifier(notify)

    // "Could have undone an add" is derived from event.ops (false for a
    // delete_node-only batch); a nonzero removedNodeIds must not override
    // that (F7).
    onReverted(reverted([deleteNode('op-1', 1)]), [1])
    await Promise.resolve()

    expect(notify).toHaveBeenCalledExactlyOnceWith(false)
  })
})
