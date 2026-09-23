import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { WorkflowNode } from '@comfyorg/comfy-multi-player'

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
/** The root graph of the document these tests keep activated. */
const ROOT = 'root'

function createNodeChange(
  id: string,
  actor: string = LOCAL_ACTOR
): LayoutChangeView {
  return {
    operation: {
      type: 'createNode',
      actor,
      graphId: ROOT,
      ownerGraphId: ROOT,
      nodeId: id,
      layout: { position: { x: 128, y: 96 } }
    }
  }
}

function clearChange(actor: string = LOCAL_ACTOR): LayoutChangeView {
  return { operation: { type: 'clearGraph', actor, graphId: ROOT } }
}

function deleteChange(
  id: string,
  actor: string = LOCAL_ACTOR
): LayoutChangeView {
  return {
    operation: {
      type: 'deleteNode',
      actor,
      graphId: ROOT,
      ownerGraphId: ROOT,
      nodeId: id
    }
  }
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
  let activeRootGraphId: RootGraphId | null

  function deliver(change: LayoutChangeView): void {
    for (const listener of listeners) listener(change)
  }

  beforeEach(() => {
    minted = []
    enabled = true
    bound = true
    activeRootGraphId = toRootGraphId(ROOT)
    listeners = new Set()
    session = createMintSession()
    severed = new Map()
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
      activeRootGraphId: () => activeRootGraphId,
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
    const withoutOwner = (change: LayoutChangeView): LayoutChangeView => {
      const { ownerGraphId: _ownerGraphId, ...operation } = change.operation
      return { operation }
    }

    deliver(withoutOwner(createNodeChange('1')))
    deliver(withoutOwner(deleteChange('1')))

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
        graphId: ROOT,
        ownerGraphId: ROOT
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
        graphId: ROOT,
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

  describe('activation-scoped targeting', () => {
    const ACTIVATED = toRootGraphId('graph-activated')
    const OTHER = toRootGraphId('graph-other')

    function rootScoped(
      type: 'createNode' | 'deleteNode' | 'clearGraph',
      graphId: RootGraphId,
      nodeId = '1'
    ): LayoutChangeView {
      return {
        operation: {
          type,
          actor: LOCAL_ACTOR,
          graphId,
          ...(type === 'clearGraph'
            ? {}
            : {
                ownerGraphId: graphId,
                nodeId,
                layout: { position: { x: 1, y: 2 } }
              })
        }
      }
    }

    it('mints a root-scoped create for the activated document', () => {
      activeRootGraphId = ACTIVATED

      deliver(rootScoped('createNode', ACTIVATED))

      expect(minted).toHaveLength(1)
    })

    // ACTIVATED/OTHER stand in for real UUIDs seen in a 2026-09-22
    // cloud-frontend-staging Sentry report (27ca8666-fa2b-4ef9-99bc-e005182fadc6 /
    // 84826d7d-1b25-4cfb-9d59-2747a4b09a19); the guard is a plain string
    // comparison, so the placeholders exercise the same path.
    it.for(['createNode', 'deleteNode', 'clearGraph'] as const)(
      'drops a root-scoped %s naming a graph the activated document does not own',
      (type) => {
        activeRootGraphId = ACTIVATED

        if (type === 'clearGraph') port.runIntentionalClear(() => {})
        deliver(rootScoped(type, OTHER))

        expect(minted).toEqual([])
        expect(reportError).toHaveBeenCalledWith(
          expect.any(Error),
          expect.objectContaining({
            errorType: 'agent_crdt_op_for_inactive_document'
          })
        )
      }
    )

    it('reports a repeated foreign-graph drop once per tick', () => {
      activeRootGraphId = ACTIVATED

      deliver(rootScoped('createNode', OTHER, '1'))
      deliver(rootScoped('createNode', OTHER, '2'))

      expect(reportError).toHaveBeenCalledOnce()
    })

    it('mints again once the other graph becomes the activated one', () => {
      activeRootGraphId = ACTIVATED
      deliver(rootScoped('createNode', OTHER))
      expect(minted).toEqual([])

      activeRootGraphId = OTHER
      deliver(rootScoped('createNode', OTHER))

      expect(minted).toHaveLength(1)
    })

    it('a foreign clear never consumes the intentional-clear capture', () => {
      port.runIntentionalClear(() => {
        // The outgoing tab's clear drains into the window opened for the
        // genuine one; borrowing the capture would leave the real clear
        // looking like teardown and minting nothing.
        deliver(rootScoped('clearGraph', OTHER))
        deliver(clearChange())
      })

      expect(minted).toEqual([{ op: 'clear', removed_nodes: ['1'] }])
    })

    it('mints the clear that reminted the root graph id under it', () => {
      port.runIntentionalClear(() => {
        // What `app.clean()` does: `LGraph.clear()` mints a fresh root id and
        // the host rebinds the same document onto it, all before the store's
        // queued clearGraph - which still names the pre-clear id - drains.
        activeRootGraphId = OTHER
        deliver(clearChange())
      })

      expect(minted).toEqual([{ op: 'clear', removed_nodes: ['1'] }])
    })

    it('drops an intentional clear captured while nothing was activated', () => {
      activeRootGraphId = null

      port.runIntentionalClear(() => deliver(clearChange()))

      expect(minted).toEqual([])
    })

    it('drops a root-scoped change while no document is activated', () => {
      activeRootGraphId = null

      deliver(rootScoped('createNode', ACTIVATED))

      expect(minted).toEqual([])
    })
  })
})
