import {
  applyOps,
  linksMap,
  mint,
  nodesMap
} from '@comfyorg/comfy-multi-player'
import type {
  Op,
  WidgetCatalog,
  WorkflowJSON
} from '@comfyorg/comfy-multi-player'
import { describe, expect, it, onTestFinished, vi } from 'vitest'
import * as Y from 'yjs'

import { createGraphMutations } from './graphMutations'
import { inertPlacementPort } from './__fixtures__/inertPlacementPort'
import type { GraphMutations, GraphMutationsDeps } from './graphMutations'
import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useLinkStore } from '@/stores/linkStore'
import { useNodeDataStore } from '@/stores/nodeDataStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { useAgentCrdtDocHistoryStore } from '@/workbench/extensions/agent/stores/agent/agentCrdtDocHistoryStore'
import { toOwningGraphId, toRootGraphId } from '@/types/graphScopeId'
import { toLinkId } from '@/types/linkId'
import type { NodeId } from '@/types/nodeId'
import { toNodeId } from '@/types/nodeId'
import { widgetId } from '@/types/widgetId'

import type { DocUpdate } from './docFrameClient'
import { EcsFollowerAdapter } from './ecsFollowerAdapter'
import type { LocalOnlyGraphIds } from './ecsFollowerAdapter'
import { FollowerDoc } from './followerDoc'
import { computeLocalOnlyGraphIds } from './agentLocalOnlyGraphIds'

const catalog: WidgetCatalog = {
  types: {
    Source: { widget_order: ['seed', 'stale'] },
    Sink: { widget_order: [] }
  }
}
const scope = {
  rootGraphId: toRootGraphId('root'),
  owningGraphId: toOwningGraphId('root')
}
interface TestLayout {
  position: { x: number; y: number }
  size: { width: number; height: number }
}

function op(id: string, baseVersion: number, payload: object) {
  return {
    op_id: id,
    actor: 'agent:test',
    base_version: baseVersion,
    stamp: [baseVersion, 'agent:test'],
    ...payload
  }
}

describe('EcsFollowerAdapter integration', () => {
  it('retires a previously valid link when its replacement targets an incompatible slot', () => {
    const host = mint(
      {
        nodes: [
          {
            id: 1,
            type: 'Source',
            outputs: [{ name: 'out', type: 'IMAGE', links: [9] }]
          },
          {
            id: 2,
            type: 'Sink',
            inputs: [{ name: 'image', type: 'IMAGE', link: 9 }]
          },
          {
            id: 3,
            type: 'Sink',
            inputs: [{ name: 'prompt', type: 'STRING', link: null }]
          }
        ],
        links: [[9, 1, 0, 2, 0, 'IMAGE']]
      },
      catalog
    )
    const follower = new FollowerDoc()
    const adapter = new EcsFollowerAdapter(
      createGraphMutations({
        placement: inertPlacementPort,
        getScope: () => scope,
        layout: { createNode: vi.fn(), deleteNodes: vi.fn() }
      })
    )
    adapter.bind('wf', follower)
    try {
      const initial = Y.encodeStateAsUpdate(host)
      follower.applyRemoteUpdate(initial)
      expect(
        adapter.applyFrame({ workflowId: 'wf', seq: 1, update: initial })
      ).toBe(true)
      expect(
        useLinkStore().getTopology(scope.rootGraphId, toLinkId(9))
      ).toMatchObject({ targetNodeId: '2' })

      const before = Y.encodeStateVector(host)
      const replacement = new Y.Array<unknown>()
      replacement.push([9, 1, 0, 3, 0, 'STRING'])
      linksMap(host).set('9', replacement)
      const update = Y.encodeStateAsUpdate(host, before)
      follower.applyRemoteUpdate(update)
      expect(adapter.applyFrame({ workflowId: 'wf', seq: 2, update })).toBe(
        true
      )
      const retainedLink = linksMap(follower.doc).get('9')
      expect(retainedLink).toBeInstanceOf(Y.Array)
      if (!(retainedLink instanceof Y.Array)) throw new Error('link is missing')
      expect(retainedLink.toJSON()).toEqual([9, 1, 0, 3, 0, 'STRING'])
      expect(
        useLinkStore().getTopology(scope.rootGraphId, toLinkId(9))
      ).toBeUndefined()
    } finally {
      adapter.destroy()
      follower.destroy()
      host.destroy()
    }
  })

  it('reconciles a full seeded snapshot with existing and server-ahead entities', () => {
    const layouts = new Map<NodeId, TestLayout>()
    const createLayout = vi.fn(
      (_scope: typeof scope, nodeId: NodeId, layout: TestLayout) => {
        layouts.set(nodeId, structuredClone(layout))
      }
    )
    const deleteLayouts = vi.fn(
      (_scope: typeof scope, nodeIds: readonly NodeId[]) => {
        for (const nodeId of nodeIds) layouts.delete(nodeId)
      }
    )
    const mutations = createGraphMutations({
      placement: inertPlacementPort,
      getScope: () => scope,
      layout: { createNode: createLayout, deleteNodes: deleteLayouts }
    })
    mutations.addNode(
      {
        id: 1,
        type: 'Source',
        title: 'Local baseline',
        pos: [37, 41],
        size: [100, 80],
        inputs: [],
        outputs: [{ name: 'out', type: 'IMAGE', links: [] }],
        widgets_values: { seed: 1, stale: 9 }
      },
      {
        source: 'agent-remote',
        actor: 'bootstrap',
        opId: 'local-seed'
      }
    )
    const [existing] = useNodeDataStore().getGraphNodesFor('root', 'root')
    createLayout.mockClear()

    const host = mint(
      {
        nodes: [
          {
            id: 1,
            type: 'Source',
            title: 'Host baseline',
            pos: [10, 20],
            size: [180, 90],
            inputs: [],
            outputs: [{ name: 'out', type: 'IMAGE', links: [9] }],
            widgets_values: { seed: 42 }
          },
          {
            id: 2,
            type: 'Sink',
            pos: [300, 20],
            inputs: [{ name: 'in', type: 'IMAGE', link: 9 }],
            outputs: []
          }
        ],
        links: [[9, 1, 0, 2, 0, 'IMAGE']]
      },
      catalog
    )
    const follower = new FollowerDoc()
    const adapter = new EcsFollowerAdapter(mutations)
    adapter.bind('wf', follower)
    const update = Y.encodeStateAsUpdate(host)
    follower.applyRemoteUpdate(update)

    expect(
      adapter.applyFrame({
        workflowId: 'wf',
        seq: 1,
        update,
        actor: 'agent:test',
        opIds: ['bootstrap']
      })
    ).toBe(true)

    const nodes = useNodeDataStore().getGraphNodesFor('root', 'root')
    expect(nodes.map(({ id }) => id)).toEqual([toNodeId(1), toNodeId(2)])
    expect(nodes.find(({ id }) => id === toNodeId(1))).toBe(existing)
    expect(existing.title).toBe('Host baseline')
    expect(
      useWidgetValueStore().getWidget(widgetId('root', toNodeId(1), 'seed'))
        ?.value
    ).toBe(42)
    expect(
      useWidgetValueStore().getWidget(widgetId('root', toNodeId(1), 'stale'))
        ?.value
    ).toBe(9)
    expect(
      useLinkStore().getTopology(scope.rootGraphId, toLinkId(9))
    ).toMatchObject({ originNodeId: toNodeId(1), targetNodeId: toNodeId(2) })
    expect(layouts.get(toNodeId(1))).toEqual({
      position: { x: 37, y: 41 },
      size: { width: 100, height: 80 }
    })
    expect(layouts.get(toNodeId(2))).toMatchObject({
      position: { x: 300, y: 20 }
    })
    expect(deleteLayouts).not.toHaveBeenCalled()
    expect(createLayout).toHaveBeenCalledOnce()

    adapter.destroy()
    follower.destroy()
    host.destroy()
  })

  it('removes local-only state from the first authoritative snapshot', () => {
    const deleteLayouts = vi.fn()
    const mutations = createGraphMutations({
      placement: inertPlacementPort,
      getScope: () => scope,
      layout: { createNode: vi.fn(), deleteNodes: deleteLayouts }
    })
    const context = {
      source: 'agent-remote' as const,
      actor: 'local-hydration',
      opId: 'local-seed'
    }
    mutations.addNode(
      {
        id: 1,
        type: 'Source',
        inputs: [{ name: 'in', type: 'IMAGE', link: 98 }],
        outputs: [{ name: 'out', type: 'IMAGE', links: [98, 99] }]
      },
      context
    )
    mutations.addNode(
      {
        id: 99,
        type: 'Sink',
        widgets_values: { stale: 9 },
        inputs: [{ name: 'in', type: 'IMAGE', link: 99 }],
        outputs: []
      },
      context
    )
    mutations.connect(
      {
        id: 98,
        originNodeId: 1,
        originSlot: 0,
        targetNodeId: 1,
        targetSlot: 0,
        type: 'IMAGE'
      },
      context
    )
    mutations.connect(
      {
        id: 99,
        originNodeId: 1,
        originSlot: 0,
        targetNodeId: 99,
        targetSlot: 0,
        type: 'IMAGE'
      },
      context
    )
    deleteLayouts.mockClear()

    const host = mint(
      {
        nodes: [{ id: 1, type: 'Source', inputs: [], outputs: [] }],
        links: []
      },
      catalog
    )
    const follower = new FollowerDoc()
    const adapter = new EcsFollowerAdapter(mutations)
    adapter.bind('wf', follower)
    const update = Y.encodeStateAsUpdate(host)
    follower.applyRemoteUpdate(update)

    expect(adapter.applyFrame({ workflowId: 'wf', seq: 1, update })).toBe(true)
    expect(
      useNodeDataStore()
        .getGraphNodesFor('root', 'root')
        .map(({ id }) => id)
    ).toEqual([toNodeId(1)])
    expect(useLinkStore().getTopology(scope.rootGraphId, toLinkId(99))).toBe(
      undefined
    )
    expect(useLinkStore().getTopology(scope.rootGraphId, toLinkId(98))).toBe(
      undefined
    )
    expect(
      useWidgetValueStore().getWidget(widgetId('root', toNodeId(99), 'stale'))
    ).toBeUndefined()
    expect(deleteLayouts).toHaveBeenCalledWith(
      scope,
      [toNodeId(99)],
      expect.objectContaining({ opId: 'replay' })
    )

    adapter.destroy()
    follower.destroy()
    host.destroy()
  })

  it.fails('retypes a same-id node even when its old link is stale', () => {
    const host = mint(
      {
        nodes: [
          {
            id: 1,
            type: 'Source',
            widgets_values: { seed: 1, stale: 9 },
            inputs: [],
            outputs: [{ name: 'out', type: 'IMAGE', links: [9] }]
          },
          {
            id: 2,
            type: 'Sink',
            inputs: [{ name: 'in', type: 'IMAGE', link: 9 }],
            outputs: []
          }
        ],
        links: [[9, 1, 0, 2, 0, 'IMAGE']]
      },
      catalog
    )
    const follower = new FollowerDoc()
    const mutations = createGraphMutations({
      placement: inertPlacementPort,
      getScope: () => scope,
      layout: { createNode: vi.fn(), deleteNodes: vi.fn() }
    })
    const adapter = new EcsFollowerAdapter(mutations)
    adapter.bind('wf', follower)
    onTestFinished(() => {
      adapter.destroy()
      follower.destroy()
      host.destroy()
    })
    const bootstrap = Y.encodeStateAsUpdate(host)
    follower.applyRemoteUpdate(bootstrap)
    expect(
      adapter.applyFrame({ workflowId: 'wf', seq: 1, update: bootstrap })
    ).toBe(true)

    const before = Y.encodeStateVector(host)
    const operations: Parameters<typeof applyOps>[1] = [
      {
        op_id: 'retype',
        actor: 'agent:test',
        base_version: 2,
        stamp: [2, 'agent:test'],
        op: 'add_node',
        node_id: 1,
        class_type: 'Sink',
        pos: [0, 0],
        node: {
          id: 1,
          type: 'Sink',
          inputs: [{ name: 'in', type: 'IMAGE', link: null }],
          outputs: []
        }
      }
    ]
    expect(applyOps(host, operations, catalog).outcomes).toEqual([
      { op_id: 'retype', outcome: 'applied' }
    ])
    const update = Y.encodeStateAsUpdate(host, before)
    follower.applyRemoteUpdate(update)
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    adapter.applyFrame({ workflowId: 'wf', seq: 2, update })
    consoleError.mockRestore()

    const retyped = useNodeDataStore()
      .getGraphNodesFor('root', 'root')
      .find(({ id }) => id === toNodeId(1))
    expect(retyped).toMatchObject({
      type: 'Sink',
      inputs: [{ name: 'in', type: 'IMAGE', link: null }],
      outputs: []
    })
    expect(
      useWidgetValueStore().getWidget(widgetId('root', toNodeId(1), 'seed'))
    ).toBeUndefined()
    expect(
      useLinkStore().getTopology(scope.rootGraphId, toLinkId(9))
    ).toBeUndefined()
    expect(
      useNodeDataStore()
        .getGraphNodesFor('root', 'root')
        .find(({ id }) => id === toNodeId(2))
    ).toMatchObject({
      inputs: [{ name: 'in', type: 'IMAGE', link: null }]
    })
  })

  it('retries authoritative reconciliation after a rejected first batch', () => {
    const deleteLayouts = vi.fn()
    let scopeAvailable = false
    const mutations = createGraphMutations({
      placement: inertPlacementPort,
      getScope: () => (scopeAvailable ? scope : null),
      layout: { createNode: vi.fn(), deleteNodes: deleteLayouts }
    })
    const context = {
      source: 'agent-remote' as const,
      actor: 'local-hydration',
      opId: 'local-seed'
    }
    scopeAvailable = true
    mutations.addNode(
      {
        id: 99,
        type: 'Sink',
        widgets_values: { stale: 9 },
        inputs: [],
        outputs: []
      },
      context
    )

    const host = mint({ nodes: [], links: [] }, catalog)
    const follower = new FollowerDoc()
    const adapter = new EcsFollowerAdapter(mutations)
    adapter.bind('wf', follower)
    const update = Y.encodeStateAsUpdate(host)
    follower.applyRemoteUpdate(update)

    // First frame: the batch is rejected (no scope available), so the
    // reconciliation must not be consumed — local-only node 99 survives.
    scopeAvailable = false
    deleteLayouts.mockClear()
    expect(adapter.applyFrame({ workflowId: 'wf', seq: 1, update })).toBe(false)
    expect(
      useNodeDataStore()
        .getGraphNodesFor('root', 'root')
        .map(({ id }) => id)
    ).toEqual([toNodeId(99)])
    expect(deleteLayouts).not.toHaveBeenCalled()

    // Second frame: scope is available again, so the retried reconciliation
    // clears the stale local-only node instead of falling through to
    // incremental handling.
    scopeAvailable = true
    expect(adapter.applyFrame({ workflowId: 'wf', seq: 2, update })).toBe(true)
    expect(useNodeDataStore().getGraphNodesFor('root', 'root')).toEqual([])
    expect(deleteLayouts).toHaveBeenCalledWith(
      scope,
      [toNodeId(99)],
      expect.objectContaining({ opId: 'replay' })
    )

    adapter.destroy()
    follower.destroy()
    host.destroy()
  })

  it('replays authoritative state through real mutations after a batch throws', () => {
    const mutations = createGraphMutations({
      placement: inertPlacementPort,
      getScope: () => scope,
      layout: { createNode: vi.fn(), deleteNodes: vi.fn() }
    })
    const realBatch = mutations.batch.bind(mutations)
    const failure = new Error('projection failed')
    let throwNextBatch = true
    const throwingMutations: GraphMutations = {
      ...mutations,
      batch: (context, define) => {
        if (throwNextBatch) {
          throwNextBatch = false
          throw failure
        }
        return realBatch(context, define)
      }
    }
    const host = mint(
      { nodes: [{ id: 1, type: 'Source' }], links: [] },
      catalog
    )
    const follower = new FollowerDoc()
    const adapter = new EcsFollowerAdapter(throwingMutations)
    adapter.bind('wf', follower)
    const update = Y.encodeStateAsUpdate(host)
    follower.applyRemoteUpdate(update)

    expect(() =>
      adapter.applyFrame({ workflowId: 'wf', seq: 1, update })
    ).toThrow(failure)
    expect(useNodeDataStore().getGraphNodesFor('root', 'root')).toEqual([])

    expect(adapter.applyFrame({ workflowId: 'wf', seq: 2, update })).toBe(true)
    expect(
      useNodeDataStore()
        .getGraphNodesFor('root', 'root')
        .map(({ id }) => id)
    ).toEqual([toNodeId(1)])

    adapter.destroy()
    follower.destroy()
    host.destroy()
  })

  // `connect` refuses an IMAGE output wired into a STRING input (see
  // graphMutations.test.ts's "rejects connecting an incompatible slot type
  // pair"). Before that check existed the host-owned document could already
  // carry such a link, and `GraphMutations.batch` validates a whole batch
  // atomically, so an unfiltered full reconciliation that replays every
  // retained link would fail on that one link and take every other node it
  // was reconciling down with it — including one added afterwards, since a
  // failed batch re-arms `reconcileNextFrame` and the very next full
  // reconciliation reads the identical bad link from the doc and fails
  // again. Nothing ever cleans that link up, so this repeats forever.
  it('does not let an already-invalid retained link block reconciliation of unrelated valid state', () => {
    let scopeAvailable = true
    const mutations = createGraphMutations({
      placement: inertPlacementPort,
      getScope: () => (scopeAvailable ? scope : null),
      layout: { createNode: vi.fn(), deleteNodes: vi.fn() }
    })

    // The document is already invalid by the time this follower binds: an
    // IMAGE output (node 1) wired straight into a STRING input (node 2).
    const host = mint(
      {
        nodes: [
          {
            id: 1,
            type: 'Source',
            inputs: [],
            outputs: [{ name: 'out', type: 'IMAGE', links: [9] }]
          },
          {
            id: 2,
            type: 'Sink',
            inputs: [{ name: 'prompt', type: 'STRING', link: 9 }],
            outputs: []
          }
        ],
        links: [[9, 1, 0, 2, 0, 'IMAGE']]
      },
      catalog
    )
    const follower = new FollowerDoc()
    const adapter = new EcsFollowerAdapter(mutations)
    adapter.bind('wf', follower)
    const seedUpdate = Y.encodeStateAsUpdate(host)
    follower.applyRemoteUpdate(seedUpdate)

    // Frame 1 (the initial full reconciliation): both otherwise-valid nodes
    // must land even though the document's only link cannot be
    // materialized — the type check must still refuse it.
    expect(
      adapter.applyFrame({ workflowId: 'wf', seq: 1, update: seedUpdate })
    ).toBe(true)
    expect(
      useNodeDataStore()
        .getGraphNodesFor('root', 'root')
        .map(({ id }) => id)
    ).toEqual([toNodeId(1), toNodeId(2)])
    expect(
      useLinkStore().getTopology(scope.rootGraphId, toLinkId(9))
    ).toBeUndefined()

    // Grow the doc with a third, valid, unrelated node, but land it while
    // scope is unavailable so the batch is rejected for a reason that has
    // nothing to do with the link — this is what arms another FULL
    // reconciliation for the next frame, which is the exact mechanism that
    // replays the still-present incompatible link.
    const before = Y.encodeStateVector(host)
    const ops = [
      op('add-node-3', 1, {
        op: 'add_node',
        node_id: 3,
        class_type: 'Sink',
        pos: [500, 0],
        node: { id: 3, type: 'Sink', inputs: [], outputs: [] }
      })
    ] as Parameters<typeof applyOps>[1]
    const result = applyOps(host, ops, catalog)
    expect(result.outcomes[0]?.outcome).toBe('applied')
    const growUpdate = Y.encodeStateAsUpdate(host, before)
    follower.applyRemoteUpdate(growUpdate)

    scopeAvailable = false
    expect(
      adapter.applyFrame({ workflowId: 'wf', seq: 2, update: growUpdate })
    ).toBe(false)
    expect(
      useNodeDataStore()
        .getGraphNodesFor('root', 'root')
        .map(({ id }) => id)
    ).toEqual([toNodeId(1), toNodeId(2)])

    // Frame 3: scope is back, and `reconcileNextFrame` is armed, so this is
    // a full reconciliation replaying the STILL-invalid link from the doc
    // alongside the new node. The follower must not rewrite the document to
    // "fix" the link — it is still present, unresolved, in the doc — but
    // the new, unrelated, valid node must land this time instead of the
    // batch failing again forever.
    scopeAvailable = true
    expect(
      adapter.applyFrame({ workflowId: 'wf', seq: 3, update: growUpdate })
    ).toBe(true)
    expect(
      useNodeDataStore()
        .getGraphNodesFor('root', 'root')
        .map(({ id }) => id)
    ).toEqual([toNodeId(1), toNodeId(2), toNodeId(3)])
    expect(
      useLinkStore().getTopology(scope.rootGraphId, toLinkId(9))
    ).toBeUndefined()
    // The follower must not rewrite the shared document to "recover": link
    // 9 is still exactly as invalid in the doc as it always was.
    expect(linksMap(follower.doc).has('9')).toBe(true)

    adapter.destroy()
    follower.destroy()
    host.destroy()
  })

  it('clears only the target owner for an empty authoritative snapshot', () => {
    const targetScope = scope
    const siblingScope = {
      rootGraphId: scope.rootGraphId,
      owningGraphId: toOwningGraphId('sibling')
    }
    let activeScope = targetScope
    const mutations = createGraphMutations({
      placement: inertPlacementPort,
      getScope: () => activeScope,
      layout: { createNode: vi.fn(), deleteNodes: vi.fn() }
    })
    const context = {
      source: 'agent-remote' as const,
      actor: 'local-hydration',
      opId: 'local-seed'
    }
    mutations.addNode({ id: 1, type: 'Source' }, context)
    activeScope = siblingScope
    mutations.addNode({ id: 2, type: 'Sink' }, context)
    activeScope = targetScope

    const host = mint({ nodes: [], links: [] }, catalog)
    const follower = new FollowerDoc()
    const adapter = new EcsFollowerAdapter(mutations)
    adapter.bind('wf', follower)
    const update = Y.encodeStateAsUpdate(host)
    follower.applyRemoteUpdate(update)

    expect(adapter.applyFrame({ workflowId: 'wf', seq: 1, update })).toBe(true)
    expect(useNodeDataStore().getGraphNodesFor('root', 'root')).toEqual([])
    expect(
      useNodeDataStore()
        .getGraphNodesFor('root', 'sibling')
        .map(({ id }) => id)
    ).toEqual([toNodeId(2)])

    adapter.destroy()
    follower.destroy()
    host.destroy()
  })

  it('materializes only the valid prefix of an aborted applier batch', () => {
    const host = mint({ nodes: [], links: [] }, catalog)
    const follower = new FollowerDoc()
    const mutations = createGraphMutations({
      placement: inertPlacementPort,
      getScope: () => scope,
      layout: { createNode: vi.fn(), deleteNodes: vi.fn() }
    })
    const adapter = new EcsFollowerAdapter(mutations)
    adapter.bind('wf', follower)

    const result = applyOps(
      host,
      [
        op('prefix', 1, {
          op: 'add_node',
          node_id: 1,
          class_type: 'Source',
          pos: [10, 20],
          node: {
            id: 1,
            type: 'Source',
            pos: [10, 20],
            inputs: [],
            outputs: [{ name: 'out', type: 'IMAGE', links: [] }]
          }
        }),
        op('failure', 2, {
          op: 'set_widget',
          node_id: 1,
          widget: 'not-in-catalog',
          value: 2
        }),
        op('aborted', 3, {
          op: 'add_node',
          node_id: 2,
          class_type: 'Sink',
          pos: [300, 20],
          node: { id: 2, type: 'Sink', pos: [300, 20] }
        })
      ] as Parameters<typeof applyOps>[1],
      catalog
    )
    expect(result.outcomes.map(({ outcome }) => outcome)).toEqual([
      'applied',
      'rejected',
      'rejected'
    ])

    const update = Y.encodeStateAsUpdate(host)
    follower.applyRemoteUpdate(update)
    expect(
      adapter.applyFrame({
        workflowId: 'wf',
        seq: 1,
        update,
        actor: 'agent:test',
        opIds: ['prefix']
      })
    ).toBe(true)
    expect(
      useNodeDataStore()
        .getGraphNodesFor('root', 'root')
        .map(({ id }) => id)
    ).toEqual(['1'])
    expect([...useLinkStore().graphTopologies(scope)]).toEqual([])

    adapter.destroy()
    follower.destroy()
    host.destroy()
  })

  it('applies an implicit disconnect when delete-wins installs no replacement', () => {
    const host = mint({ nodes: [], links: [] }, catalog)
    const follower = new FollowerDoc()
    const mutations = createGraphMutations({
      placement: inertPlacementPort,
      getScope: () => scope,
      layout: { createNode: vi.fn(), deleteNodes: vi.fn() }
    })
    const adapter = new EcsFollowerAdapter(mutations)
    adapter.bind('wf', follower)

    let seq = 0
    let first = true
    const deliver = (operation: object, expectedOutcome = 'applied') => {
      const before = Y.encodeStateVector(host)
      const operationId = `disconnect-${++seq}`
      const result = applyOps(
        host,
        [op(operationId, seq, operation)] as Parameters<typeof applyOps>[1],
        catalog
      )
      expect(result.outcomes[0]).toMatchObject({
        op_id: operationId,
        outcome: expectedOutcome
      })
      const update = first
        ? Y.encodeStateAsUpdate(host)
        : Y.encodeStateAsUpdate(host, before)
      first = false
      follower.applyRemoteUpdate(update)
      expect(
        adapter.applyFrame({
          workflowId: 'wf',
          seq,
          update,
          actor: 'agent:test',
          opIds: [operationId]
        })
      ).toBe(true)
    }

    deliver({
      op: 'add_node',
      node_id: 1,
      class_type: 'Source',
      pos: [0, 0],
      node: {
        id: 1,
        type: 'Source',
        inputs: [],
        outputs: [{ name: 'out', type: 'IMAGE', links: [] }]
      }
    })
    deliver({
      op: 'add_node',
      node_id: 2,
      class_type: 'Sink',
      pos: [200, 0],
      node: {
        id: 2,
        type: 'Sink',
        inputs: [{ name: 'in', type: 'IMAGE', link: null }],
        outputs: []
      }
    })
    deliver({
      op: 'connect',
      link_id: 9,
      from_node: 1,
      from_slot: 0,
      to_node: 2,
      to_slot: 0,
      link_type: 'IMAGE'
    })
    deliver(
      {
        op: 'connect',
        link_id: 10,
        from_node: 404,
        from_slot: 0,
        to_node: 2,
        to_slot: 0,
        link_type: 'IMAGE'
      },
      'no-op'
    )

    expect([...useLinkStore().graphTopologies(scope)]).toEqual([])
    const nodes = useNodeDataStore().getGraphNodesFor('root', 'root')
    expect(
      nodes.find(({ id }) => id === toNodeId(1))?.outputs[0].links
    ).toEqual([])
    expect(
      nodes.find(({ id }) => id === toNodeId(2))?.inputs[0].link
    ).toBeNull()

    adapter.destroy()
    follower.destroy()
    host.destroy()
  })

  it('applies real shared-applier effects directly to ECS stores', () => {
    const host = mint({ nodes: [], links: [] }, catalog)
    const follower = new FollowerDoc()
    const createLayout = vi.fn()
    const deleteLayouts = vi.fn()
    const mutations = createGraphMutations({
      placement: inertPlacementPort,
      getScope: () => scope,
      layout: { createNode: createLayout, deleteNodes: deleteLayouts }
    })
    const adapter = new EcsFollowerAdapter(mutations)
    adapter.bind('wf', follower)

    let seq = 0
    let first = true
    const deliver = (operation: object) => {
      const before = Y.encodeStateVector(host)
      const operationId = `op-${++seq}`
      const result = applyOps(
        host,
        [op(operationId, seq, operation)] as Parameters<typeof applyOps>[1],
        catalog
      )
      expect(result.outcomes).toEqual([
        { op_id: operationId, outcome: 'applied' }
      ])
      const update = first
        ? Y.encodeStateAsUpdate(host)
        : Y.encodeStateAsUpdate(host, before)
      first = false
      follower.applyRemoteUpdate(update)
      const frame: DocUpdate = {
        workflowId: 'wf',
        seq,
        update,
        actor: 'agent:test',
        opIds: [operationId]
      }
      expect(adapter.applyFrame(frame)).toBe(true)
    }

    deliver({
      op: 'add_node',
      node_id: 1,
      class_type: 'Source',
      pos: [10, 20],
      node: {
        id: 1,
        type: 'Source',
        title: 'Source node',
        pos: [10, 20],
        size: [180, 90],
        widgets_values: { seed: 1, stale: 9 },
        inputs: [],
        outputs: [{ name: 'out', type: 'IMAGE', links: [] }]
      }
    })
    deliver({
      op: 'add_node',
      node_id: 2,
      class_type: 'Sink',
      pos: [300, 20],
      node: {
        id: 2,
        type: 'Sink',
        pos: [300, 20],
        inputs: [{ name: 'in', type: 'IMAGE', link: null }],
        outputs: []
      }
    })
    deliver({
      op: 'connect',
      link_id: 9,
      from_node: 1,
      from_slot: 0,
      to_node: 2,
      to_slot: 0,
      link_type: 'IMAGE'
    })
    deliver({
      op: 'set_widget',
      node_id: 1,
      widget: 'seed',
      value: 42,
      old: 1
    })

    expect(
      useNodeDataStore()
        .getGraphNodesFor('root', 'root')
        .map(({ id }) => id)
    ).toEqual(['1', '2'])
    expect(
      useWidgetValueStore().getWidget(widgetId('root', toNodeId(1), 'seed'))
        ?.value
    ).toBe(42)
    expect(
      useLinkStore().getTopology(scope.rootGraphId, toLinkId(9))
    ).toMatchObject({ id: 9, originNodeId: '1', targetNodeId: '2' })
    expect(createLayout).toHaveBeenCalledTimes(2)

    deliver({
      op: 'connect',
      link_id: 10,
      from_node: 1,
      from_slot: 0,
      to_node: 2,
      link_type: 'IMAGE',
      grow: { name: 'image', type: 'IMAGE' }
    })
    const sink = useNodeDataStore()
      .getGraphNodesFor('root', 'root')
      .find(({ id }) => id === toNodeId(2))
    expect(sink?.inputs).toHaveLength(2)
    expect(sink?.inputs[1]).toMatchObject({
      name: 'image',
      link: toLinkId(10)
    })
    expect(
      useLinkStore().getTopology(scope.rootGraphId, toLinkId(10))
    ).toMatchObject({ id: 10, targetSlot: 1 })

    // A higher-stamped same-id add is a new incarnation. The adapter replaces
    // the shell, drops stale widget state, and restores authoritative links.
    deliver({
      op: 'add_node',
      node_id: 1,
      class_type: 'Source',
      pos: [50, 60],
      node: {
        id: 1,
        type: 'Source',
        pos: [50, 60],
        widgets_values: { seed: 7 },
        inputs: [],
        outputs: [{ name: 'out', type: 'IMAGE', links: [] }]
      }
    })
    expect(
      useWidgetValueStore().getWidget(widgetId('root', toNodeId(1), 'seed'))
        ?.value
    ).toBe(7)
    expect(
      useWidgetValueStore().getWidget(widgetId('root', toNodeId(1), 'stale'))
    ).toBeUndefined()
    expect(
      useLinkStore().getTopology(scope.rootGraphId, toLinkId(9))
    ).toBeDefined()
    expect(
      useLinkStore().getTopology(scope.rootGraphId, toLinkId(10))
    ).toBeDefined()

    deliver({ op: 'delete_node', node_id: 1, removed_links: [9, 10] })
    expect(
      useNodeDataStore()
        .getGraphNodesFor('root', 'root')
        .map(({ id }) => id)
    ).toEqual(['2'])
    expect(
      useLinkStore().getTopology(scope.rootGraphId, toLinkId(9))
    ).toBeUndefined()
    expect(
      useLinkStore().getTopology(scope.rootGraphId, toLinkId(10))
    ).toBeUndefined()
    expect(deleteLayouts).toHaveBeenCalledWith(
      scope,
      [toNodeId(1)],
      expect.objectContaining({ source: 'agent-remote', opId: 'op-7' })
    )

    deliver({ op: 'clear', removed_nodes: [2] })
    expect(useNodeDataStore().getGraphNodesFor('root', 'root')).toEqual([])
    expect(deleteLayouts).toHaveBeenCalledWith(
      scope,
      [toNodeId(2)],
      expect.objectContaining({ source: 'agent-remote', opId: 'op-8' })
    )

    adapter.destroy()
    follower.destroy()
    host.destroy()
  })

  it('FEC-4 current risk: leaves the old type rendered when a same-id retype batch is rejected by a stale link revalidation', () => {
    const host = mint(
      {
        nodes: [
          {
            id: 1,
            type: 'Source',
            pos: [0, 0],
            widgets_values: { seed: 1, stale: 9 },
            inputs: [],
            outputs: [{ name: 'out', type: 'IMAGE', links: [9] }]
          },
          {
            id: 2,
            type: 'Sink',
            pos: [300, 0],
            inputs: [{ name: 'in', type: 'IMAGE', link: 9 }],
            outputs: []
          }
        ],
        links: [[9, 1, 0, 2, 0, 'IMAGE']]
      },
      catalog
    )
    const follower = new FollowerDoc()
    const createLayout = vi.fn()
    const deleteLayouts = vi.fn()
    const mutations = createGraphMutations({
      getScope: () => scope,
      layout: { createNode: createLayout, deleteNodes: deleteLayouts },
      placement: inertPlacementPort
    })
    const adapter = new EcsFollowerAdapter(mutations)
    adapter.bind('wf', follower)
    onTestFinished(() => {
      adapter.destroy()
      follower.destroy()
      host.destroy()
    })

    const bootstrap = Y.encodeStateAsUpdate(host)
    follower.applyRemoteUpdate(bootstrap)
    expect(
      adapter.applyFrame({
        workflowId: 'wf',
        seq: 1,
        update: bootstrap,
        actor: 'agent:test',
        opIds: ['bootstrap']
      })
    ).toBe(true)
    expect(
      useWidgetValueStore().getWidget(widgetId('root', toNodeId(1), 'seed'))
        ?.value
    ).toBe(1)
    createLayout.mockClear()
    deleteLayouts.mockClear()

    const before = Y.encodeStateVector(host)
    const retypeOp = {
      op_id: 'retype',
      actor: 'agent:test',
      base_version: 2,
      stamp: [2, 'agent:test'],
      op: 'add_node',
      node_id: 1,
      class_type: 'Sink',
      pos: [0, 0],
      node: {
        id: 1,
        type: 'Sink',
        pos: [0, 0],
        inputs: [{ name: 'in', type: 'IMAGE', link: null }],
        outputs: []
      }
    } satisfies Op
    const result = applyOps(host, [retypeOp], catalog)
    expect(result.outcomes).toEqual([{ op_id: 'retype', outcome: 'applied' }])
    expect(nodesMap(host).get('1')?.get('outputs')).toHaveLength(0)
    expect(linksMap(host).get('9')).toEqual([9, 1, 0, 2, 0, 'IMAGE'])
    const update = Y.encodeStateAsUpdate(host, before)
    follower.applyRemoteUpdate(update)
    const rejected = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    expect(
      adapter.applyFrame({
        workflowId: 'wf',
        seq: 2,
        update,
        actor: 'agent:test',
        opIds: ['retype']
      })
    ).toBe(false)
    expect(rejected).toHaveBeenCalledWith(
      expect.stringContaining('connect origin slot 0 does not exist')
    )
    rejected.mockRestore()

    const stillSource = useNodeDataStore()
      .getGraphNodesFor('root', 'root')
      .find(({ id }) => id === toNodeId(1))
    expect(stillSource?.type).toBe('Source')
    expect(stillSource?.outputs).toHaveLength(1)
    expect(
      useWidgetValueStore().getWidget(widgetId('root', toNodeId(1), 'seed'))
        ?.value
    ).toBe(1)
    expect(
      useWidgetValueStore().getWidget(widgetId('root', toNodeId(1), 'stale'))
        ?.value
    ).toBe(9)
    expect(useLinkStore().getTopology(scope.rootGraphId, toLinkId(9))).toEqual({
      id: toLinkId(9),
      graphId: scope.owningGraphId,
      originNodeId: toNodeId(1),
      originSlot: 0,
      targetNodeId: toNodeId(2),
      targetSlot: 0,
      type: 'IMAGE'
    })
    expect(createLayout).not.toHaveBeenCalled()
    expect(deleteLayouts).not.toHaveBeenCalled()
  })

  describe('remote widget map edits on an existing node', () => {
    function bindSeededHost() {
      const host = mint(
        {
          nodes: [
            {
              id: 1,
              type: 'Source',
              pos: [10, 20],
              widgets_values: { seed: 1, stale: 9 },
              inputs: [],
              outputs: []
            }
          ],
          links: []
        },
        catalog
      )
      const follower = new FollowerDoc()
      const mutations = createGraphMutations({
        placement: inertPlacementPort,
        getScope: () => scope,
        layout: { createNode: vi.fn(), deleteNodes: vi.fn() }
      })
      const adapter = new EcsFollowerAdapter(mutations)
      adapter.bind('wf', follower)

      const initial = Y.encodeStateAsUpdate(host)
      follower.applyRemoteUpdate(initial)
      expect(
        adapter.applyFrame({
          workflowId: 'wf',
          seq: 1,
          update: initial,
          actor: 'agent:test',
          opIds: ['add']
        })
      ).toBe(true)

      const nodeMap = nodesMap(host).get('1')
      expect(nodeMap).toBeInstanceOf(Y.Map)
      const node = nodeMap as Y.Map<unknown>
      const widgets = node.get('widgets')
      expect(widgets).toBeInstanceOf(Y.Map)

      const deliver = (seq: number, mutate: () => void) => {
        const before = Y.encodeStateVector(host)
        mutate()
        const update = Y.encodeStateAsUpdate(host, before)
        follower.applyRemoteUpdate(update)
        expect(
          adapter.applyFrame({
            workflowId: 'wf',
            seq,
            update,
            actor: 'agent:test',
            opIds: [`op-${seq}`]
          })
        ).toBe(true)
      }
      const widgetValue = (name: string) =>
        useWidgetValueStore().getWidget(widgetId('root', toNodeId(1), name))
          ?.value
      const destroy = () => {
        adapter.destroy()
        follower.destroy()
        host.destroy()
      }
      return {
        node,
        widgets: widgets as Y.Map<unknown>,
        deliver,
        widgetValue,
        destroy
      }
    }

    it('keeps a widget whose doc key was deleted and its siblings', () => {
      const { widgets, deliver, widgetValue, destroy } = bindSeededHost()
      expect(widgetValue('stale')).toBe(9)

      deliver(2, () => widgets.delete('stale'))

      expect(widgetValue('stale')).toBe(9)
      expect(widgetValue('seed')).toBe(1)
      expect(
        useNodeDataStore()
          .getGraphNodesFor('root', 'root')
          .map(({ id }) => id)
      ).toEqual(['1'])
      destroy()
    })

    it('keeps the targeted update path for value changes and same-frame re-adds', () => {
      const { widgets, deliver, widgetValue, destroy } = bindSeededHost()

      deliver(2, () => widgets.set('seed', 5))
      deliver(3, () => {
        widgets.delete('stale')
        widgets.set('stale', 11)
      })

      expect(widgetValue('seed')).toBe(5)
      expect(widgetValue('stale')).toBe(11)
      expect(useWidgetValueStore().clearNode).not.toHaveBeenCalled()
      destroy()
    })

    it('keeps widgets missing from a replaced widget map', () => {
      const { node, deliver, widgetValue, destroy } = bindSeededHost()

      deliver(2, () => {
        const replacement = new Y.Map<unknown>()
        node.set('widgets', replacement)
        replacement.set('seed', 5)
      })

      expect(widgetValue('seed')).toBe(5)
      expect(widgetValue('stale')).toBe(9)
      destroy()
    })
  })

  it('materializes an agent add_node into the ECS store and layout port only', () => {
    // Companion to `does NOT drop an agent-added node from serialize() ...`
    // in `src/lib/litegraph/src/LGraph.test.ts`. This drives the real
    // applier + follower + adapter chain and pins the two side effects this
    // layer owns for a remote `add_node`: the node state is registered in
    // the ECS node-data store and the injected layout port is asked to
    // create exactly one layout entry. `graphMutations.ts` is the pure,
    // litegraph-free op layer, so the layout port is the only outbound seam
    // here; nothing on this chain can construct an `LGraphNode`, which is
    // why the serialize-side symptom is asserted in the companion test.
    const host = mint({ nodes: [], links: [] }, catalog)
    const follower = new FollowerDoc()
    const createNode = vi.fn()
    const mutations = createGraphMutations({
      placement: inertPlacementPort,
      getScope: () => scope,
      layout: { createNode, deleteNodes: vi.fn() }
    })
    const adapter = new EcsFollowerAdapter(mutations)
    adapter.bind('wf', follower)

    const result = applyOps(
      host,
      [
        op('op-1', 1, {
          op: 'add_node',
          node_id: 1,
          class_type: 'Source',
          pos: [10, 20],
          node: {
            id: 1,
            type: 'Source',
            title: 'Agent-added node',
            pos: [10, 20],
            size: [180, 90],
            widgets_values: { seed: 1 },
            inputs: [],
            outputs: [{ name: 'out', type: 'IMAGE', links: [] }]
          }
        })
      ] as Parameters<typeof applyOps>[1],
      catalog
    )
    expect(result.outcomes).toEqual([{ op_id: 'op-1', outcome: 'applied' }])
    const update = Y.encodeStateAsUpdate(host)
    follower.applyRemoteUpdate(update)
    expect(
      adapter.applyFrame({
        workflowId: 'wf',
        seq: 1,
        update,
        actor: 'agent:test',
        opIds: ['op-1']
      })
    ).toBe(true)

    const [stored] = useNodeDataStore().getGraphNodesFor('root', 'root')
    expect(stored).toMatchObject({ id: toNodeId(1), type: 'Source' })
    expect(createNode).toHaveBeenCalledExactlyOnceWith(
      scope,
      toNodeId(1),
      expect.objectContaining({ position: { x: 10, y: 20 } }),
      expect.objectContaining({ source: 'agent-remote', opId: 'op-1' })
    )

    adapter.destroy()
    follower.destroy()
    host.destroy()
  })

  it('keeps follower docs and apply queues isolated by workflow target', () => {
    const followerA = new FollowerDoc()
    const followerB = new FollowerDoc()
    const updateA = Y.encodeStateAsUpdate(
      mint(
        {
          nodes: [
            { id: 101, type: 'Source', pos: [0, 0], inputs: [], outputs: [] }
          ],
          links: []
        },
        catalog
      )
    )
    const updateB = Y.encodeStateAsUpdate(
      mint(
        {
          nodes: [
            { id: 202, type: 'Sink', pos: [100, 0], inputs: [], outputs: [] }
          ],
          links: []
        },
        catalog
      )
    )
    const frameA: DocUpdate = {
      workflowId: 'wf-a',
      seq: 1,
      update: updateA,
      actor: 'agent:test',
      opIds: ['a']
    }
    const frameB: DocUpdate = {
      workflowId: 'wf-b',
      seq: 1,
      update: updateB,
      actor: 'agent:test',
      opIds: ['b']
    }
    const events: string[] = []
    const createTargetMutations = (workflowId: string): GraphMutations => {
      const noopBatch = {
        addNode: () => undefined,
        reconcileNode: () => undefined,
        reconcileNodeFields: () => undefined,
        setWidget: () => undefined,
        connect: () => undefined,
        removeMissing: () => undefined,
        removeLinks: () => undefined,
        deleteNode: () => undefined,
        clearSemanticGraph: () => undefined
      }
      return {
        batch: (_context, define) => {
          events.push(`${workflowId}:start`)
          define(noopBatch)
          if (workflowId === 'wf-a') adapter.applyFrame(frameB)
          events.push(`${workflowId}:end`)
          return true
        },
        addNode: () => true,
        setWidget: () => true,
        connect: () => true,
        deleteNode: () => true,
        clearSemanticGraph: () => true
      }
    }
    const adapter = new EcsFollowerAdapter(createTargetMutations)
    adapter.bind('wf-a', followerA)
    adapter.bind('wf-b', followerB)
    followerA.applyRemoteUpdate(updateA)
    followerB.applyRemoteUpdate(updateB)

    expect(adapter.applyFrame(frameA)).toBe(true)
    expect(events).toEqual(['wf-a:start', 'wf-b:start', 'wf-b:end', 'wf-a:end'])
    expect(followerA.doc.getMap('nodes').has('101')).toBe(true)
    expect(followerA.doc.getMap('nodes').has('202')).toBe(false)
    expect(followerB.doc.getMap('nodes').has('202')).toBe(true)
    expect(followerB.doc.getMap('nodes').has('101')).toBe(false)

    adapter.destroy()
    followerA.destroy()
    followerB.destroy()
  })

  it('populates node slot arrays identically whether add+connect ops arrive in one combined frame or separate singleton frames (R-96)', () => {
    const buildOps = (prefix: string) => [
      op(`${prefix}-1`, 1, {
        op: 'add_node',
        node_id: 1,
        class_type: 'Source',
        pos: [0, 0],
        node: {
          id: 1,
          type: 'Source',
          inputs: [],
          outputs: [{ name: 'out', type: 'IMAGE', links: [] }]
        }
      }),
      op(`${prefix}-2`, 2, {
        op: 'add_node',
        node_id: 2,
        class_type: 'Sink',
        pos: [200, 0],
        node: {
          id: 2,
          type: 'Sink',
          inputs: [{ name: 'in', type: 'IMAGE', link: null }],
          outputs: []
        }
      }),
      op(`${prefix}-3`, 3, {
        op: 'connect',
        link_id: 9,
        from_node: 1,
        from_slot: 0,
        to_node: 2,
        to_slot: 0,
        link_type: 'IMAGE'
      })
    ]

    const runScenario = (deliverAsSingleFrame: boolean) => {
      useNodeDataStore().clearGraph(scope.rootGraphId)
      useLinkStore().clearGraph(scope.rootGraphId)
      const host = mint({ nodes: [], links: [] }, catalog)
      const follower = new FollowerDoc()
      const mutations = createGraphMutations({
        placement: inertPlacementPort,
        getScope: () => scope,
        layout: { createNode: vi.fn(), deleteNodes: vi.fn() }
      })
      const adapter = new EcsFollowerAdapter(mutations)
      adapter.bind('wf', follower)

      const ops = buildOps(
        deliverAsSingleFrame ? 'combined' : 'singleton'
      ) as Parameters<typeof applyOps>[1]

      if (deliverAsSingleFrame) {
        const result = applyOps(host, ops, catalog)
        expect(result.outcomes.map(({ outcome }) => outcome)).toEqual([
          'applied',
          'applied',
          'applied'
        ])
        const update = Y.encodeStateAsUpdate(host)
        follower.applyRemoteUpdate(update)
        expect(
          adapter.applyFrame({
            workflowId: 'wf',
            seq: 1,
            update,
            actor: 'agent:test',
            opIds: ops.map(({ op_id }) => op_id)
          })
        ).toBe(true)
      } else {
        let before = Y.encodeStateVector(host)
        let first = true
        let seq = 0
        for (const singleOp of ops) {
          const result = applyOps(host, [singleOp], catalog)
          expect(result.outcomes[0]?.outcome).toBe('applied')
          const update = first
            ? Y.encodeStateAsUpdate(host)
            : Y.encodeStateAsUpdate(host, before)
          first = false
          before = Y.encodeStateVector(host)
          follower.applyRemoteUpdate(update)
          expect(
            adapter.applyFrame({
              workflowId: 'wf',
              seq: ++seq,
              update,
              actor: 'agent:test',
              opIds: [singleOp.op_id]
            })
          ).toBe(true)
        }
      }

      const nodes = useNodeDataStore().getGraphNodesFor('root', 'root')
      const origin = nodes.find(({ id }) => id === toNodeId(1))
      const target = nodes.find(({ id }) => id === toNodeId(2))
      const topology = useLinkStore().getTopology(
        scope.rootGraphId,
        toLinkId(9)
      )

      adapter.destroy()
      follower.destroy()
      host.destroy()

      return {
        originLinks: origin?.outputs[0]?.links ?? null,
        targetLink: target?.inputs[0]?.link ?? null,
        topologyDefined: topology !== undefined
      }
    }

    const singleton = runScenario(false)
    const combined = runScenario(true)

    // The link store converges identically either way...
    expect(combined.topologyDefined).toBe(true)
    expect(singleton.topologyDefined).toBe(true)
    // ...but node slot state must converge too: same-frame connect+adds must
    // not leave inputs[].link / outputs[].links empty relative to delivering
    // the same ops across separate frames.
    expect(combined.originLinks).toEqual(singleton.originLinks)
    expect(combined.targetLink).toEqual(singleton.targetLink)
    expect(combined.originLinks).toEqual([toLinkId(9)])
    expect(combined.targetLink).toEqual(toLinkId(9))
  })

  describe('local intent during a full reconcile', () => {
    function reconcileLinkedPair(pendingDeletes: ReadonlySet<string>) {
      const mutations = createGraphMutations({
        placement: inertPlacementPort,
        getScope: () => scope,
        layout: { createNode: vi.fn(), deleteNodes: vi.fn() }
      })
      const host = mint(
        {
          nodes: [
            {
              id: 1,
              type: 'Source',
              pos: [0, 0],
              inputs: [],
              outputs: [{ name: 'out', type: 'IMAGE', links: [9] }],
              widgets_values: { seed: 1 }
            },
            {
              id: 2,
              type: 'Sink',
              pos: [300, 0],
              inputs: [{ name: 'in', type: 'IMAGE', link: 9 }],
              outputs: []
            }
          ],
          links: [[9, 1, 0, 2, 0, 'IMAGE']]
        },
        catalog
      )
      const follower = new FollowerDoc()
      const adapter = new EcsFollowerAdapter(mutations, {
        pendingDeletes: () => pendingDeletes,
        localOnlyGraphIds: () => ({ nodeIds: new Set(), linkIds: new Set() })
      })
      adapter.bind('wf', follower)
      const update = Y.encodeStateAsUpdate(host)
      follower.applyRemoteUpdate(update)

      const committed = adapter.applyFrame({ workflowId: 'wf', seq: 1, update })
      const nodeIds = useNodeDataStore()
        .getGraphNodesFor('root', 'root')
        .map(({ id }) => id)
      const linked =
        useLinkStore().getTopology(scope.rootGraphId, toLinkId(9)) !== undefined

      adapter.destroy()
      follower.destroy()
      host.destroy()
      return { committed, nodeIds, linked }
    }

    it('skips a doc node whose human delete is still pending, along with its incident links, and still commits', () => {
      expect(reconcileLinkedPair(new Set(['2']))).toEqual({
        committed: true,
        nodeIds: [toNodeId(1)],
        linked: false
      })
    })

    it('reconciles every doc node when nothing is pending', () => {
      expect(reconcileLinkedPair(new Set())).toEqual({
        committed: true,
        nodeIds: [toNodeId(1), toNodeId(2)],
        linked: true
      })
    })
  })

  describe('local-only protection timing and scope', () => {
    const LOCAL_HYDRATION_CONTEXT = {
      source: 'agent-remote' as const,
      actor: 'local-hydration',
      opId: 'local-seed'
    }

    function localOnlyMutations(
      overrides: {
        getScope?: () => typeof scope | null
        deleteNodes?: GraphMutationsDeps['layout']['deleteNodes']
      } = {}
    ): GraphMutations {
      return createGraphMutations({
        placement: inertPlacementPort,
        getScope: overrides.getScope ?? (() => scope),
        layout: {
          createNode: vi.fn(),
          deleteNodes: overrides.deleteNodes ?? vi.fn()
        }
      })
    }

    function mintUpdate(graph: WorkflowJSON): Uint8Array {
      const host = mint(graph, catalog)
      onTestFinished(() => host.destroy())
      return Y.encodeStateAsUpdate(host)
    }

    function bindAndApply(
      adapter: EcsFollowerAdapter,
      workflowId: string,
      update: Uint8Array
    ): void {
      const follower = new FollowerDoc()
      adapter.bind(workflowId, follower)
      follower.applyRemoteUpdate(update)
      onTestFinished(() => follower.destroy())
    }

    it('retains the live links incident to a protected local-only node, but still sweeps other stale links', () => {
      const deleteLayouts = vi.fn()
      const mutations = localOnlyMutations({ deleteNodes: deleteLayouts })
      // Node 1 will be doc-retained; node 99 is local-only. Link 99 connects
      // them (must be protected alongside node 99); link 98 is an unrelated
      // stale self-loop on node 1 (must still be swept -- protection is
      // scoped to the protected node's own incident links, not everything).
      mutations.addNode(
        {
          id: 1,
          type: 'Source',
          inputs: [{ name: 'in', type: 'IMAGE', link: 98 }],
          outputs: [{ name: 'out', type: 'IMAGE', links: [98, 99] }]
        },
        LOCAL_HYDRATION_CONTEXT
      )
      mutations.addNode(
        {
          id: 99,
          type: 'Sink',
          widgets_values: { stale: 9 },
          inputs: [{ name: 'in', type: 'IMAGE', link: 99 }],
          outputs: []
        },
        LOCAL_HYDRATION_CONTEXT
      )
      mutations.connect(
        {
          id: 98,
          originNodeId: 1,
          originSlot: 0,
          targetNodeId: 1,
          targetSlot: 0,
          type: 'IMAGE'
        },
        LOCAL_HYDRATION_CONTEXT
      )
      mutations.connect(
        {
          id: 99,
          originNodeId: 1,
          originSlot: 0,
          targetNodeId: 99,
          targetSlot: 0,
          type: 'IMAGE'
        },
        LOCAL_HYDRATION_CONTEXT
      )
      deleteLayouts.mockClear()

      const adapter = new EcsFollowerAdapter(mutations, {
        pendingDeletes: () => new Set(),
        localOnlyGraphIds: () => ({
          nodeIds: new Set(['99']),
          linkIds: new Set([99])
        })
      })
      onTestFinished(() => adapter.destroy())
      const update = mintUpdate({
        nodes: [{ id: 1, type: 'Source', inputs: [], outputs: [] }],
        links: []
      })
      bindAndApply(adapter, 'wf', update)

      expect(adapter.applyFrame({ workflowId: 'wf', seq: 1, update })).toBe(
        true
      )
      expect(
        useNodeDataStore()
          .getGraphNodesFor('root', 'root')
          .map(({ id }) => id)
      ).toEqual([toNodeId(1), toNodeId(99)])
      expect(
        useLinkStore().getTopology(scope.rootGraphId, toLinkId(99))
      ).toMatchObject({ originNodeId: toNodeId(1), targetNodeId: toNodeId(99) })
      expect(
        useLinkStore().getTopology(scope.rootGraphId, toLinkId(98))
      ).toBeUndefined()
      expect(
        useWidgetValueStore().getWidget(widgetId('root', toNodeId(99), 'stale'))
          ?.value
      ).toBe(9)
      expect(deleteLayouts).not.toHaveBeenCalled()
    })

    it('defers the first full reconcile instead of committing an empty retain set when scope exists but no live graph is available yet', () => {
      const mutations = localOnlyMutations()
      mutations.addNode(
        { id: 99, type: 'Sink', inputs: [], outputs: [] },
        LOCAL_HYDRATION_CONTEXT
      )

      let graphReady = false
      const localOnlyGraphIds = vi.fn(() =>
        graphReady
          ? { nodeIds: new Set(['99']), linkIds: new Set<number>() }
          : null
      )
      const adapter = new EcsFollowerAdapter(mutations, {
        pendingDeletes: () => new Set(),
        localOnlyGraphIds
      })
      onTestFinished(() => adapter.destroy())
      const update = mintUpdate({ nodes: [], links: [] })
      bindAndApply(adapter, 'wf', update)

      expect(adapter.applyFrame({ workflowId: 'wf', seq: 1, update })).toBe(
        false
      )
      expect(localOnlyGraphIds).toHaveBeenCalledTimes(1)
      expect(
        useNodeDataStore()
          .getGraphNodesFor('root', 'root')
          .map(({ id }) => id)
      ).toEqual([toNodeId(99)])

      graphReady = true
      expect(adapter.applyFrame({ workflowId: 'wf', seq: 2, update })).toBe(
        true
      )
      expect(localOnlyGraphIds).toHaveBeenCalledTimes(2)
      expect(
        useNodeDataStore()
          .getGraphNodesFor('root', 'root')
          .map(({ id }) => id)
      ).toEqual([toNodeId(99)])
    })

    it('does not spend the local-only one-shot on a batch its first full reconcile has rejected', () => {
      const localOnlyGraphIds = vi.fn(() => ({
        nodeIds: new Set(['99']),
        linkIds: new Set<number>()
      }))
      let scopeAvailable = false
      const mutations = localOnlyMutations({
        getScope: () => (scopeAvailable ? scope : null)
      })
      scopeAvailable = true
      mutations.addNode(
        { id: 99, type: 'Sink', inputs: [], outputs: [] },
        LOCAL_HYDRATION_CONTEXT
      )

      const adapter = new EcsFollowerAdapter(mutations, {
        pendingDeletes: () => new Set(),
        localOnlyGraphIds
      })
      onTestFinished(() => adapter.destroy())
      const update = mintUpdate({ nodes: [], links: [] })
      bindAndApply(adapter, 'wf', update)

      scopeAvailable = false
      expect(adapter.applyFrame({ workflowId: 'wf', seq: 1, update })).toBe(
        false
      )
      expect(localOnlyGraphIds).toHaveBeenCalledTimes(1)
      expect(
        useNodeDataStore()
          .getGraphNodesFor('root', 'root')
          .map(({ id }) => id)
      ).toEqual([toNodeId(99)])

      scopeAvailable = true
      expect(adapter.applyFrame({ workflowId: 'wf', seq: 2, update })).toBe(
        true
      )
      expect(localOnlyGraphIds).toHaveBeenCalledTimes(2)
      expect(
        useNodeDataStore()
          .getGraphNodesFor('root', 'root')
          .map(({ id }) => id)
      ).toEqual([toNodeId(99)])
    })

    it('keeps the local-only one-shot armed across an unbind/rebind that never got a completed reconcile', () => {
      const mutations = localOnlyMutations()
      mutations.addNode(
        { id: 99, type: 'Sink', inputs: [], outputs: [] },
        LOCAL_HYDRATION_CONTEXT
      )

      const adapter = new EcsFollowerAdapter(mutations, {
        pendingDeletes: () => new Set(),
        localOnlyGraphIds: () => ({
          nodeIds: new Set(['99']),
          linkIds: new Set<number>()
        })
      })
      onTestFinished(() => adapter.destroy())
      const followerA = new FollowerDoc()
      onTestFinished(() => followerA.destroy())
      adapter.bind('wf', followerA)
      adapter.unbind('wf')

      const update = mintUpdate({ nodes: [], links: [] })
      bindAndApply(adapter, 'wf', update)

      expect(adapter.applyFrame({ workflowId: 'wf', seq: 1, update })).toBe(
        true
      )
      expect(
        useNodeDataStore()
          .getGraphNodesFor('root', 'root')
          .map(({ id }) => id)
      ).toEqual([toNodeId(99)])
    })

    it('clears protectedWorkflowIds on an explicit reset, whether or not the workflow is actively bound, so the next lineage under that id is treated as a first bind', () => {
      const mutations = localOnlyMutations()
      const localOnlyGraphIds = vi.fn(() => ({
        nodeIds: new Set<string>(),
        linkIds: new Set<number>()
      }))
      const adapter = new EcsFollowerAdapter(mutations, {
        pendingDeletes: () => new Set(),
        localOnlyGraphIds
      })
      onTestFinished(() => adapter.destroy())
      const update = mintUpdate({ nodes: [], links: [] })
      bindAndApply(adapter, 'wf', update)
      expect(adapter.applyFrame({ workflowId: 'wf', seq: 1, update })).toBe(
        true
      )
      expect(localOnlyGraphIds).toHaveBeenCalledTimes(1)

      adapter.clearForFollowerReplacement('wf', {
        source: 'agent-remote',
        actor: 'agent-lineage',
        opId: 'follower-replaced:wf'
      })
      adapter.unbind('wf')
      bindAndApply(adapter, 'wf', update)
      expect(adapter.applyFrame({ workflowId: 'wf', seq: 1, update })).toBe(
        true
      )
      expect(localOnlyGraphIds).toHaveBeenCalledTimes(1)

      adapter.clearForReset('wf', {
        source: 'agent-remote',
        actor: 'agent-reset',
        opId: 'doc-reset:1'
      })
      adapter.unbind('wf')
      bindAndApply(adapter, 'wf', update)
      expect(adapter.applyFrame({ workflowId: 'wf', seq: 1, update })).toBe(
        true
      )
      expect(localOnlyGraphIds).toHaveBeenCalledTimes(2)
      adapter.unbind('wf')

      adapter.clearForReset('wf', {
        source: 'agent-remote',
        actor: 'agent-reset',
        opId: 'doc-reset:2'
      })
      bindAndApply(adapter, 'wf', update)
      expect(adapter.applyFrame({ workflowId: 'wf', seq: 1, update })).toBe(
        true
      )
      expect(localOnlyGraphIds).toHaveBeenCalledTimes(3)
    })

    it('sweeps a previously protected local-only node and link on a later rebind, without consulting the local-only hook again', () => {
      const mutations = localOnlyMutations()
      mutations.addNode(
        {
          id: 1,
          type: 'Source',
          inputs: [],
          outputs: [{ name: 'out', type: 'IMAGE', links: [99] }]
        },
        LOCAL_HYDRATION_CONTEXT
      )
      mutations.addNode(
        {
          id: 99,
          type: 'Sink',
          inputs: [{ name: 'in', type: 'IMAGE', link: 99 }],
          outputs: []
        },
        LOCAL_HYDRATION_CONTEXT
      )
      mutations.connect(
        {
          id: 99,
          originNodeId: 1,
          originSlot: 0,
          targetNodeId: 99,
          targetSlot: 0,
          type: 'IMAGE'
        },
        LOCAL_HYDRATION_CONTEXT
      )

      const localOnlyGraphIds = vi.fn(() => ({
        nodeIds: new Set(['99']),
        linkIds: new Set([99])
      }))
      const adapter = new EcsFollowerAdapter(mutations, {
        pendingDeletes: () => new Set(),
        localOnlyGraphIds
      })
      onTestFinished(() => adapter.destroy())
      const update = mintUpdate({
        nodes: [{ id: 1, type: 'Source', inputs: [], outputs: [] }],
        links: []
      })

      bindAndApply(adapter, 'wf', update)
      expect(adapter.applyFrame({ workflowId: 'wf', seq: 1, update })).toBe(
        true
      )
      expect(localOnlyGraphIds).toHaveBeenCalledTimes(1)
      expect(
        useNodeDataStore()
          .getGraphNodesFor('root', 'root')
          .map(({ id }) => id)
      ).toEqual([toNodeId(1), toNodeId(99)])

      adapter.unbind('wf')
      bindAndApply(adapter, 'wf', update)

      expect(adapter.applyFrame({ workflowId: 'wf', seq: 1, update })).toBe(
        true
      )
      expect(localOnlyGraphIds).toHaveBeenCalledTimes(1)
      expect(
        useNodeDataStore()
          .getGraphNodesFor('root', 'root')
          .map(({ id }) => id)
      ).toEqual([toNodeId(1)])
      expect(
        useLinkStore().getTopology(scope.rootGraphId, toLinkId(99))
      ).toBeUndefined()
    })

    it('composes the real classifier and doc-history store with a freshly recreated adapter across a remount, so a genuine remote delete is swept but a hand-added node and its incident link survive', () => {
      const docHistory = useAgentCrdtDocHistoryStore()
      const lineage = docHistory.reset('wf', 1)

      const graph = new LGraph()
      graph.id = 'root'
      const handAddedSink = new LGraphNode('Sink')
      handAddedSink.id = toNodeId(99)
      handAddedSink.addInput('in', 'IMAGE')
      graph.add(handAddedSink)
      const handAddedSource = new LGraphNode('Source')
      handAddedSource.id = toNodeId(50)
      handAddedSource.addOutput('out', 'IMAGE')
      graph.add(handAddedSource)

      const localOnlyGraphIds = (
        workflowId: string
      ): LocalOnlyGraphIds | null =>
        workflowId !== 'wf'
          ? null
          : computeLocalOnlyGraphIds(
              graph,
              docHistory.everSeen(workflowId, lineage)
            )

      const mutations = localOnlyMutations()
      mutations.addNode(
        { id: 1, type: 'Source', inputs: [], outputs: [] },
        LOCAL_HYDRATION_CONTEXT
      )
      mutations.connect(
        {
          id: 77,
          originNodeId: 50,
          originSlot: 0,
          targetNodeId: 99,
          targetSlot: 0,
          type: 'IMAGE'
        },
        LOCAL_HYDRATION_CONTEXT
      )

      const firstAdapter = new EcsFollowerAdapter(mutations, {
        pendingDeletes: () => new Set(),
        localOnlyGraphIds
      })
      const observedUpdate = mintUpdate({
        nodes: [{ id: 1, type: 'Source', inputs: [], outputs: [] }],
        links: []
      })
      bindAndApply(firstAdapter, 'wf', observedUpdate)
      docHistory.remember('wf', lineage, new Set(['1']))
      expect(
        firstAdapter.applyFrame({
          workflowId: 'wf',
          seq: 1,
          update: observedUpdate
        })
      ).toBe(true)
      expect(
        useNodeDataStore()
          .getGraphNodesFor('root', 'root')
          .map(({ id }) => id)
      ).toEqual([toNodeId(99), toNodeId(50), toNodeId(1)])
      expect(
        useLinkStore().getTopology(scope.rootGraphId, toLinkId(77))
      ).toBeDefined()
      firstAdapter.destroy()

      const secondAdapter = new EcsFollowerAdapter(mutations, {
        pendingDeletes: () => new Set(),
        localOnlyGraphIds
      })
      onTestFinished(() => secondAdapter.destroy())
      const rebindUpdate = mintUpdate({ nodes: [], links: [] })
      bindAndApply(secondAdapter, 'wf', rebindUpdate)
      expect(
        secondAdapter.applyFrame({
          workflowId: 'wf',
          seq: 1,
          update: rebindUpdate
        })
      ).toBe(true)
      expect(
        useNodeDataStore()
          .getGraphNodesFor('root', 'root')
          .map(({ id }) => id)
      ).toEqual([toNodeId(99), toNodeId(50)])
      expect(
        useLinkStore().getTopology(scope.rootGraphId, toLinkId(77))
      ).toBeDefined()
    })
  })
})
