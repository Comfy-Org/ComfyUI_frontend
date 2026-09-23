import type { WorkflowNode } from '@comfyorg/comfy-multi-player'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { reportError } from '@/platform/telemetry/reportError'
import type { RootGraphId } from '@/types/graphScopeId'
import { toRootGraphId } from '@/types/graphScopeId'

import type { GraphOperation } from './graphOperations'
import { attachLayoutMintPort } from './layoutMintPort'
import type { LayoutChangeView, LayoutMintPort } from './layoutMintPort'
import { createMintSession } from './mintSession'
import type { MintSession } from './mintSession'

vi.mock(import('@/platform/telemetry/reportError'), () => ({
  reportError: vi.fn()
}))

const LOCAL_PREFIX = 'user-'
const LOCAL_ACTOR = 'user-abc123def'

function createNodeChange(
  id: string,
  actor: string = LOCAL_ACTOR
): LayoutChangeView {
  return {
    operation: {
      type: 'createNode',
      actor,
      nodeId: id,
      layout: { position: { x: 128, y: 96 } }
    }
  }
}

function clearChange(
  actor: string = LOCAL_ACTOR,
  graphId?: string
): LayoutChangeView {
  return { operation: { type: 'clearGraph', actor, graphId } }
}

function deleteChange(
  id: string,
  actor: string = LOCAL_ACTOR
): LayoutChangeView {
  return { operation: { type: 'deleteNode', actor, nodeId: id } }
}

describe('attachLayoutMintPort', () => {
  let minted: GraphOperation[]
  let port: LayoutMintPort
  let enabled: boolean
  let bound: boolean
  let graphNodes: Map<string, WorkflowNode>
  let listeners: Set<(change: LayoutChangeView) => void>
  let session: MintSession
  let severed: Map<string, (string | number)[]>
  let currentRoot: RootGraphId | null

  function deliver(change: LayoutChangeView): void {
    for (const listener of listeners) listener(change)
  }

  beforeEach(() => {
    minted = []
    enabled = true
    bound = true
    listeners = new Set()
    session = createMintSession()
    severed = new Map()
    currentRoot = toRootGraphId('root')
    graphNodes = new Map([
      ['1', { id: 1, type: 'TestNode', pos: [128, 96], widgets_values: [7] }]
    ])
    port = attachLayoutMintPort({
      changes: {
        onChange: (listener) => {
          listeners.add(listener)
          return () => listeners.delete(listener)
        }
      },
      session,
      severedLinks: { take: (nodeId) => severed.get(nodeId) ?? [] },
      localActorPrefix: LOCAL_PREFIX,
      isEnabled: () => enabled,
      isDocBound: () => bound,
      boundRootGraphId: () => currentRoot,
      source: {
        serializeNode: (id) => graphNodes.get(id) ?? null,
        nodeIds: () => [...graphNodes.keys()]
      },
      enqueue: (operations) => minted.push(...operations)
    })
  })

  it('mints add_node with the mint-time snapshot for a local createNode', () => {
    deliver(createNodeChange('1'))

    expect(minted).toEqual([
      {
        op: 'add_node',
        node_id: '1',
        class_type: 'TestNode',
        pos: [128, 96],
        node: { id: 1, type: 'TestNode', pos: [128, 96], widgets_values: [7] }
      }
    ])
  })

  it('skips a redo that recreates an already-minted node instead of re-minting add_node', () => {
    // Simulate litegraph's own undo/redo stack: a redo re-delivers the same
    // createNode shape a genuine new node would, for a node this port
    // already relayed. Without a delete_node in between, the second
    // createNode is a replay, not a new node, and must not mint again.
    deliver(createNodeChange('1'))
    minted.length = 0

    deliver(createNodeChange('1'))

    expect(minted).toEqual([])
  })

  it('mints add_node again for the same id after a delete_node clears it', () => {
    deliver(createNodeChange('1'))
    deliver(deleteChange('1'))
    minted.length = 0

    deliver(createNodeChange('1'))

    expect(minted).toHaveLength(1)
  })

  it('clears the dedupe entry on a same-root delete_node', () => {
    const rootCreate = {
      operation: {
        ...createNodeChange('1').operation,
        graphId: 'root',
        ownerGraphId: 'root'
      }
    }
    const rootDelete = {
      operation: {
        ...deleteChange('1').operation,
        graphId: 'root',
        ownerGraphId: 'root'
      }
    }

    deliver(rootCreate)
    deliver(rootDelete)
    deliver(rootCreate)

    expect(minted.filter((op) => op.op === 'add_node')).toHaveLength(2)
  })

  it("does not let a foreign root graph's delete clear the dedupe entry for the bound graph (regression)", () => {
    // Mint node 1 for the bound graph (root), then a root-scoped delete for
    // a different graph (other) sharing the same node id - a workflow load
    // still in flight, per reportOpForUnboundGraph's own scenario. That
    // foreign delete must still be reported and dropped as a wire op, but it
    // must not clear the dedupe entry `mintedNodeIds` holds for root's node
    // 1: a replayed create for root must not re-mint.
    const rootCreate = {
      operation: {
        ...createNodeChange('1').operation,
        graphId: 'root',
        ownerGraphId: 'root'
      }
    }
    const foreignDelete = {
      operation: {
        ...deleteChange('1').operation,
        graphId: 'other',
        ownerGraphId: 'other'
      }
    }

    deliver(rootCreate)
    deliver(foreignDelete)
    deliver(rootCreate)

    expect(minted.filter((op) => op.op === 'add_node')).toHaveLength(1)
    expect(reportError).toHaveBeenCalledWith(expect.any(Error), {
      errorType: 'agent_crdt_op_for_unbound_graph',
      context: { graphId: 'other', boundRootGraphId: 'root', nodeId: '1' }
    })
  })

  it('mints add_node for a rebound root graph reusing a node id already minted under the previous root (regression)', () => {
    // Node ids are graph-scoped, so a create for graph B's node 1 is not a
    // replay of graph A's node 1, even though the accessor once named A when
    // that mint happened.
    deliver({
      operation: {
        ...createNodeChange('1').operation,
        graphId: 'root',
        ownerGraphId: 'root'
      }
    })
    currentRoot = toRootGraphId('other')
    minted.length = 0

    deliver({
      operation: {
        ...createNodeChange('1').operation,
        graphId: 'other',
        ownerGraphId: 'other'
      }
    })

    expect(minted.filter((op) => op.op === 'add_node')).toHaveLength(1)
  })

  it("mints B's own create while B is bound, then survives switching back to A without re-minting A's replay (regression)", () => {
    // A clear-on-transition strategy would let this A -> B -> A round trip
    // re-mint A's node 1, the exact id-collision replay the dedupe exists to
    // prevent - so rebinding away from and back to a root must leave its
    // dedupe entries untouched. Delivering B's own create while B is bound
    // (rather than switching straight back to A) proves production actually
    // reads the accessor in the B state, not just at the two endpoints.
    const rootACreate = {
      operation: {
        ...createNodeChange('1').operation,
        graphId: 'root',
        ownerGraphId: 'root'
      }
    }
    const rootBCreate = {
      operation: {
        ...createNodeChange('1').operation,
        graphId: 'other',
        ownerGraphId: 'other'
      }
    }

    deliver(rootACreate)
    currentRoot = toRootGraphId('other')
    minted.length = 0
    deliver(rootBCreate)

    expect(minted.filter((op) => op.op === 'add_node')).toHaveLength(1)

    currentRoot = toRootGraphId('root')
    minted.length = 0

    deliver(rootACreate)

    expect(minted).toEqual([])
  })

  it("does not let a foreign root graph's clear reset the bound graph's dedupe entry (regression)", () => {
    // Mint node 1 for the bound graph (root), then a root-scoped clear for a
    // different graph (other) sharing node ids - a workflow load still in
    // flight, per reportOpForUnboundGraph's own scenario. That foreign clear
    // must still be reported and dropped as a wire op, but it must not erase
    // root's dedupe entry for node 1: a replayed create for root must not
    // re-mint.
    const rootCreate = {
      operation: {
        ...createNodeChange('1').operation,
        graphId: 'root',
        ownerGraphId: 'root'
      }
    }
    const foreignClear = clearChange(LOCAL_ACTOR, 'other')

    deliver(rootCreate)
    deliver(foreignClear)
    deliver(rootCreate)

    expect(minted.filter((op) => op.op === 'add_node')).toHaveLength(1)
    expect(reportError).toHaveBeenCalledWith(expect.any(Error), {
      errorType: 'agent_crdt_op_for_unbound_graph',
      context: { graphId: 'other', boundRootGraphId: 'root', nodeId: undefined }
    })
  })

  it('does not let an incidental same-root clearGraph reset the dedupe bucket (regression)', () => {
    // A tab switch reconfigures the shared canvas graph in place: LGraph's
    // own clear() fires a root-scoped clearGraph for the outgoing root
    // before rebinding, so its graphId still equals the bound root here.
    // Outside runIntentionalClear this is not a human clear - it must not
    // forget the bound root's dedupe entries for nodes the doc still holds,
    // or a return to that root re-mints them (id_collision).
    const rootCreate = {
      operation: {
        ...createNodeChange('1').operation,
        graphId: 'root',
        ownerGraphId: 'root'
      }
    }
    const incidentalClear = clearChange(LOCAL_ACTOR, 'root')

    deliver(rootCreate)
    deliver(incidentalClear)
    deliver(rootCreate)

    expect(minted.filter((op) => op.op === 'add_node')).toHaveLength(1)
  })

  it('does not share dedupe state between two graphs while the bound root graph id is unknown (regression)', () => {
    // Both graphs mint their own node 1 while boundRootGraphId() cannot
    // report which one is bound (e.g. a tab already bound before its
    // changeTracker hydrates) - keying the bucket off the accessor would
    // have both graphs share the same null-keyed bucket and wrongly
    // suppress the second graph's genuine create.
    currentRoot = null

    deliver({
      operation: {
        ...createNodeChange('1').operation,
        graphId: 'doc-a',
        ownerGraphId: 'doc-a'
      }
    })
    deliver({
      operation: {
        ...createNodeChange('1').operation,
        graphId: 'doc-b',
        ownerGraphId: 'doc-b'
      }
    })

    expect(minted.filter((op) => op.op === 'add_node')).toHaveLength(2)
  })

  it('does not let a subgraph-interior delete clear the root bucket for a colliding node id (regression)', () => {
    // Layout ops are always root-scoped, so a subgraph-interior delete
    // carries the root's own graphId with a different ownerGraphId. Node
    // ids are not unique across a root and its subgraphs, so this must not
    // forget the root's own dedupe entry for a numerically-colliding id.
    const rootCreate = {
      operation: {
        ...createNodeChange('1').operation,
        graphId: 'root',
        ownerGraphId: 'root'
      }
    }
    const interiorDelete = {
      operation: {
        ...deleteChange('1').operation,
        graphId: 'root',
        ownerGraphId: 'subgraph'
      }
    }

    deliver(rootCreate)
    deliver(interiorDelete)
    deliver(rootCreate)

    expect(minted.filter((op) => op.op === 'add_node')).toHaveLength(1)
  })

  it('a foreign clearGraph does not consume an active intentional-clear capture (regression)', () => {
    // A foreign clear (a local actor, so only its graphId is wrong - the
    // in-flight workflow-load case) reaching the store mid-capture must be
    // rejected before it can null out or otherwise consume the pending
    // intentional-clear capture. Otherwise the genuine local clear that
    // follows finds the capture already gone and mints nothing at all for it.
    const foreignClear = clearChange(LOCAL_ACTOR, 'other')

    port.runIntentionalClear(() => {
      graphNodes.clear()
      deliver(foreignClear)
      deliver(clearChange())
    })

    expect(minted).toEqual([{ op: 'clear', removed_nodes: ['1'] }])
  })

  it('mints add_node again for the same id after an intentional clear', () => {
    deliver(createNodeChange('1'))
    port.runIntentionalClear(() => {
      graphNodes.clear()
      deliver(clearChange())
    })
    graphNodes.set('1', {
      id: 1,
      type: 'TestNode',
      pos: [128, 96],
      widgets_values: [7]
    })
    minted.length = 0

    deliver(createNodeChange('1'))

    expect(minted).toHaveLength(1)
  })

  it('mints add_node without the ghost flag of a node still being placed', () => {
    graphNodes.set('1', {
      id: 1,
      type: 'TestNode',
      pos: [128, 96],
      flags: { ghost: true, pinned: true },
      widgets_values: [7]
    })

    deliver(createNodeChange('1'))

    expect(minted).toEqual([
      {
        op: 'add_node',
        node_id: '1',
        class_type: 'TestNode',
        pos: [128, 96],
        node: {
          id: 1,
          type: 'TestNode',
          pos: [128, 96],
          flags: { pinned: true },
          widgets_values: [7]
        }
      }
    ])
  })

  it('surfaces interior create and delete without minting root operations', () => {
    const interior = {
      graphId: 'root',
      ownerGraphId: 'subgraph'
    }

    deliver({
      operation: { ...createNodeChange('1').operation, ...interior }
    })
    deliver({
      operation: { ...deleteChange('1').operation, ...interior }
    })

    expect(minted).toEqual([])
    expect(reportError).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        message: expect.stringContaining('Subgraph-interior node create')
      }),
      {
        errorType: 'agent_crdt_unrepresentable_subgraph_node_create',
        context: {
          graphId: 'root',
          ownerGraphId: 'subgraph',
          nodeId: '1'
        }
      }
    )
    expect(reportError).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        message: expect.stringContaining('Subgraph-interior node delete')
      }),
      {
        errorType: 'agent_crdt_unrepresentable_subgraph_node_delete',
        context: {
          graphId: 'root',
          ownerGraphId: 'subgraph',
          nodeId: '1'
        }
      }
    )
  })

  it('reports one interior-delete error per subgraph per tick', async () => {
    for (let index = 0; index < 30; index++) {
      deliver({
        operation: {
          ...deleteChange(String(index)).operation,
          graphId: 'root',
          ownerGraphId: 'subgraph-a'
        }
      })
    }

    expect(reportError).toHaveBeenCalledOnce()
    expect(reportError).toHaveBeenLastCalledWith(expect.any(Error), {
      errorType: 'agent_crdt_unrepresentable_subgraph_node_delete',
      context: {
        graphId: 'root',
        ownerGraphId: 'subgraph-a',
        nodeId: '0'
      }
    })

    deliver({
      operation: {
        ...deleteChange('30').operation,
        graphId: 'root',
        ownerGraphId: 'subgraph-b'
      }
    })
    expect(reportError).toHaveBeenCalledTimes(2)

    await Promise.resolve()
    deliver({
      operation: {
        ...deleteChange('31').operation,
        graphId: 'root',
        ownerGraphId: 'subgraph-a'
      }
    })
    expect(reportError).toHaveBeenCalledTimes(3)
  })

  it('fails closed on a graphId with no ownerGraphId instead of minting as root', () => {
    deliver({
      operation: { ...createNodeChange('1').operation, graphId: 'root' }
    })
    deliver({
      operation: { ...deleteChange('1').operation, graphId: 'root' }
    })

    expect(minted).toEqual([])
    expect(reportError).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        message: expect.stringContaining('createNode has no ownerGraphId')
      }),
      {
        errorType: 'agent_crdt_missing_owner_graph_id_create',
        context: { graphId: 'root', nodeId: '1' }
      }
    )
    expect(reportError).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        message: expect.stringContaining('deleteNode has no ownerGraphId')
      }),
      {
        errorType: 'agent_crdt_missing_owner_graph_id_delete',
        context: { graphId: 'root', nodeId: '1' }
      }
    )
  })

  it('mints a root createNode when ownerGraphId equals graphId', () => {
    deliver({
      operation: {
        ...createNodeChange('1').operation,
        graphId: 'root',
        ownerGraphId: 'root'
      }
    })

    expect(minted).toEqual([
      {
        op: 'add_node',
        node_id: '1',
        class_type: 'TestNode',
        pos: [128, 96],
        node: { id: 1, type: 'TestNode', pos: [128, 96], widgets_values: [7] }
      }
    ])
  })

  it.for([
    [
      'create',
      {
        ...createNodeChange('1').operation,
        graphId: 'other',
        ownerGraphId: 'other'
      }
    ],
    [
      'delete',
      {
        ...deleteChange('1').operation,
        graphId: 'other',
        ownerGraphId: 'other'
      }
    ]
  ] as const)(
    "drops a root %s whose graph is not the bound document's root graph",
    ([_action, operation]) => {
      deliver({ operation })

      expect(minted).toEqual([])
      expect(reportError).toHaveBeenCalledOnce()
      expect(reportError).toHaveBeenLastCalledWith(expect.any(Error), {
        errorType: 'agent_crdt_op_for_unbound_graph',
        context: { graphId: 'other', boundRootGraphId: 'root', nodeId: '1' }
      })
    }
  )

  it('reports an unbound-graph createNode only once per tick', async () => {
    const operation = {
      ...createNodeChange('1').operation,
      graphId: 'other',
      ownerGraphId: 'other'
    }
    deliver({ operation })
    deliver({ operation: { ...operation, nodeId: '2' } })

    expect(reportError).toHaveBeenCalledOnce()

    await Promise.resolve()
    deliver({ operation: { ...operation, nodeId: '3' } })
    expect(reportError).toHaveBeenCalledTimes(2)
  })

  it('mints a root createNode when there is no stored bound root graph id (untracked, not restricted)', () => {
    port.detach()
    port = attachLayoutMintPort({
      changes: {
        onChange: (listener) => {
          listeners.add(listener)
          return () => listeners.delete(listener)
        }
      },
      session,
      severedLinks: { take: (nodeId) => severed.get(nodeId) ?? [] },
      localActorPrefix: LOCAL_PREFIX,
      isEnabled: () => enabled,
      isDocBound: () => bound,
      boundRootGraphId: () => null,
      source: {
        serializeNode: (id) => graphNodes.get(id) ?? null,
        nodeIds: () => [...graphNodes.keys()]
      },
      enqueue: (operations) => minted.push(...operations)
    })

    deliver({
      operation: {
        ...createNodeChange('1').operation,
        graphId: 'other',
        ownerGraphId: 'other'
      }
    })

    expect(minted).toHaveLength(1)
  })

  it.for([
    ['create', createNodeChange('1', LOCAL_ACTOR)],
    ['delete', deleteChange('1', LOCAL_ACTOR)]
  ] as const)(
    'uses call-carried source to suppress an echoed %s',
    ([_operation, change]) => {
      change.operation.source = 'agent-remote'

      deliver(change)

      expect(minted).toEqual([])
    }
  )

  it('never mints an actor-less change (no call-carried provenance)', () => {
    const change = createNodeChange('1')
    delete change.operation.actor
    deliver(change)

    expect(minted).toEqual([])
  })

  it('never mints with the product flag off', () => {
    enabled = false
    deliver(createNodeChange('1'))

    expect(minted).toEqual([])
  })

  it('never mints without a bound doc', () => {
    bound = false
    deliver(createNodeChange('1'))

    expect(minted).toEqual([])
  })

  it('never mints inside a graph-teardown bracket', () => {
    session.beginGraphTeardown()
    deliver(createNodeChange('1'))
    session.endGraphTeardown()

    expect(minted).toEqual([])
  })

  it('mints again after the teardown bracket closes', () => {
    session.beginGraphTeardown()
    session.endGraphTeardown()
    deliver(createNodeChange('1'))

    expect(minted).toHaveLength(1)
  })

  it('mints delete_node carrying the severed link ids from the capture', () => {
    severed.set('1', [17, 18])
    deliver(deleteChange('1'))

    expect(minted).toEqual([
      { op: 'delete_node', node_id: '1', removed_links: [17, 18] }
    ])
  })

  it('mints delete_node with no severances as an empty removed_links', () => {
    deliver(deleteChange('1'))

    expect(minted).toEqual([
      { op: 'delete_node', node_id: '1', removed_links: [] }
    ])
  })

  it('never mints a teardown-bracketed deleteNode', () => {
    session.beginGraphTeardown()
    deliver(deleteChange('1'))
    session.endGraphTeardown()

    expect(minted).toEqual([])
  })

  it('drops a snapshot-less mint observably, never silently', () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    graphNodes.clear()
    deliver(createNodeChange('1'))

    expect(minted).toEqual([])
    expect(consoleError).toHaveBeenCalledOnce()
    consoleError.mockRestore()
  })

  it('treats a bare clearGraph as teardown (a tab switch mints no clear storm)', () => {
    deliver(clearChange())

    expect(minted).toEqual([])
  })

  it('mints clear with the pre-captured node set for an intentional clear', () => {
    port.runIntentionalClear(() => {
      graphNodes.clear()
      deliver(clearChange())
    })

    expect(minted).toEqual([{ op: 'clear', removed_nodes: ['1'] }])
  })

  it('drops the intentional-clear capture if no clear reaches the store', async () => {
    port.runIntentionalClear(() => {})
    await Promise.resolve()

    deliver(clearChange())

    expect(minted).toEqual([])
  })

  it.for([
    'moveNode',
    'resizeNode',
    'setNodeZIndex',
    'batchUpdateBounds',
    'createReroute',
    'deleteReroute',
    'moveReroute',
    'createGroup',
    'setGroupBounds',
    'deleteGroup'
  ] as const)('never mints the non-semantic %s operation', (type) => {
    deliver({
      operation: {
        type,
        actor: LOCAL_ACTOR,
        nodeId: '1',
        layout: { position: { x: 1, y: 2 } }
      }
    })
    expect(minted).toEqual([])
  })

  it('stops minting after detach', () => {
    port.detach()
    deliver(createNodeChange('1'))

    expect(minted).toEqual([])
  })
})
