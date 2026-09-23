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
import { afterEach, describe, expect, it, onTestFinished, vi } from 'vitest'
import * as Y from 'yjs'

import { createGraphMutations } from './graphMutations'
import { inertPlacementPort } from './__fixtures__/inertPlacementPort'
import type { GraphMutations } from './graphMutations'
// eslint-disable-next-line import-x/no-restricted-paths
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
// eslint-disable-next-line import-x/no-restricted-paths
import { LayoutSource } from '@/renderer/core/layout/types'
import { useLinkStore } from '@/stores/linkStore'
import { useNodeDataStore } from '@/stores/nodeDataStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import type { RemoteMutationContext } from '@/types/graphMutationContext'
import { toOwningGraphId, toRootGraphId } from '@/types/graphScopeId'
import { toGroupId } from '@/types/groupId'
import { toLinkId } from '@/types/linkId'
import type { NodeId } from '@/types/nodeId'
import { toNodeId } from '@/types/nodeId'
import { widgetId } from '@/types/widgetId'

import type { DocUpdate } from './docFrameClient'
import { EcsFollowerAdapter } from './ecsFollowerAdapter'
import { FollowerDoc } from './followerDoc'
import type { GraphOperation } from './graphOperations'

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

/**
 * Builds one stamped op. `payload` is the package's distributive operation
 * type, so a malformed fixture fails at this call site rather than inside
 * `applyOps`.
 */
function op(id: string, baseVersion: number, payload: GraphOperation): Op {
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
        layout: {
          createNode: vi.fn(),
          deleteNodes: vi.fn(),
          deleteGroups: vi.fn()
        }
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
      layout: {
        createNode: createLayout,
        deleteNodes: deleteLayouts,
        deleteGroups: vi.fn()
      }
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
      layout: {
        createNode: vi.fn(),
        deleteNodes: deleteLayouts,
        deleteGroups: vi.fn()
      }
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

  it('retries authoritative reconciliation after a rejected first batch', () => {
    const deleteLayouts = vi.fn()
    let scopeAvailable = false
    const mutations = createGraphMutations({
      placement: inertPlacementPort,
      getScope: () => (scopeAvailable ? scope : null),
      layout: {
        createNode: vi.fn(),
        deleteNodes: deleteLayouts,
        deleteGroups: vi.fn()
      }
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
      layout: {
        createNode: vi.fn(),
        deleteNodes: vi.fn(),
        deleteGroups: vi.fn()
      }
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
    ]
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
      layout: {
        createNode: vi.fn(),
        deleteNodes: vi.fn(),
        deleteGroups: vi.fn()
      }
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
      layout: {
        createNode: vi.fn(),
        deleteNodes: vi.fn(),
        deleteGroups: vi.fn()
      }
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
      ],
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
      layout: {
        createNode: vi.fn(),
        deleteNodes: vi.fn(),
        deleteGroups: vi.fn()
      }
    })
    const adapter = new EcsFollowerAdapter(mutations)
    adapter.bind('wf', follower)

    let seq = 0
    let first = true
    const deliver = (
      operation: GraphOperation,
      expectedOutcome = 'applied'
    ) => {
      const before = Y.encodeStateVector(host)
      const operationId = `disconnect-${++seq}`
      const result = applyOps(host, [op(operationId, seq, operation)], catalog)
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
      layout: {
        createNode: createLayout,
        deleteNodes: deleteLayouts,
        deleteGroups: vi.fn()
      }
    })
    const adapter = new EcsFollowerAdapter(mutations)
    adapter.bind('wf', follower)

    let seq = 0
    let first = true
    const deliver = (operation: GraphOperation) => {
      const before = Y.encodeStateVector(host)
      const operationId = `op-${++seq}`
      const result = applyOps(host, [op(operationId, seq, operation)], catalog)
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
        layout: {
          createNode: vi.fn(),
          deleteNodes: vi.fn(),
          deleteGroups: vi.fn()
        }
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
      layout: {
        createNode,
        deleteNodes: vi.fn(),
        deleteGroups: vi.fn()
      }
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
      ],
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
        clearSemanticGraph: () => undefined,
        deleteGroups: () => undefined
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
        layout: {
          createNode: vi.fn(),
          deleteNodes: vi.fn(),
          deleteGroups: vi.fn()
        }
      })
      const adapter = new EcsFollowerAdapter(mutations)
      adapter.bind('wf', follower)

      const ops = buildOps(deliverAsSingleFrame ? 'combined' : 'singleton')

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

  describe('group-aware clear', () => {
    // The pinned applier (0.2.1) empties `meta.groups` wholesale on `clear`,
    // with no per-group target set and no stamp gate. The follower reacts to
    // whatever `meta.groups` says AFTER a frame by diffing group ids against
    // what it saw before, mirroring how it already diffs `nodesMap`/`linksMap`
    // deep changes rather than trusting op names.

    /** Disposed in LIFO order after each case by the hook below. */
    const disposables: Array<() => void> = []
    afterEach(() => {
      while (disposables.length > 0) disposables.pop()?.()
    })

    /** A group graph every case in this describe starts from. */
    const groupGraph = (id: number, title: string): WorkflowJSON => ({
      nodes: [],
      links: [],
      groups: [{ id, title, bounding: [0, 0, 100, 100] }]
    })

    /**
     * Mints `graph`, binds a fresh adapter to it and — unless `seedFrame` is
     * false — delivers the mint as the first reconcile frame, asserting it
     * commits so every case starts from a recorded baseline. `deliver` encodes
     * a host's current state, hands it to the bound follower and returns
     * `applyFrame`'s verdict; `rebind` is the tab going inactive and coming
     * back against a brand new follower doc. Pass `adapter` to bind a second
     * workflow onto the adapter a previous call created — one adapter serves
     * every open tab. Disposal is registered here so a case contains only its
     * own transition and expected values.
     */
    function bindTarget({
      graph,
      mutations,
      workflowId = 'wf',
      seedFrame = true,
      adapter: sharedAdapter
    }: {
      graph: WorkflowJSON
      mutations: GraphMutations
      workflowId?: string
      seedFrame?: boolean
      adapter?: EcsFollowerAdapter
    }) {
      const host = mint(graph, catalog)
      const adapter = sharedAdapter ?? new EcsFollowerAdapter(mutations)
      let follower = new FollowerDoc()
      let followerDisposed = false
      let seq = 0
      adapter.bind(workflowId, follower)
      disposables.push(() => {
        if (!sharedAdapter) adapter.destroy()
        if (!followerDisposed) follower.destroy()
        host.destroy()
      })

      const deliver = (opIds: readonly string[], source: Y.Doc = host) => {
        const update = Y.encodeStateAsUpdate(source)
        follower.applyRemoteUpdate(update)
        seq += 1
        return adapter.applyFrame({
          workflowId,
          seq,
          update,
          actor: 'agent:test',
          opIds: [...opIds]
        })
      }

      const unbind = () => {
        adapter.unbind(workflowId)
        follower.destroy()
        followerDisposed = true
      }

      const rebind = () => {
        if (!followerDisposed) unbind()
        follower = new FollowerDoc()
        followerDisposed = false
        adapter.bind(workflowId, follower)
      }

      if (seedFrame) expect(deliver(['seed'])).toBe(true)
      return { adapter, host, deliver, unbind, rebind }
    }

    /** Spies on the one layout call these cases are about. */
    function groupSpyMutations(getScope: () => typeof scope | null) {
      const deleteGroups = vi.fn()
      const deleteNodes = vi.fn()
      const mutations = createGraphMutations({
        getScope,
        placement: inertPlacementPort,
        layout: { createNode: vi.fn(), deleteNodes, deleteGroups }
      })
      return { mutations, deleteGroups, deleteNodes }
    }

    it('deletes the group layout for a group removed from meta.groups by a clear', () => {
      const { mutations, deleteGroups } = groupSpyMutations(() => scope)
      const { host, deliver } = bindTarget({
        graph: {
          nodes: [
            {
              id: 1,
              type: 'Source',
              pos: [10, 20],
              inputs: [],
              outputs: [],
              widgets_values: {}
            }
          ],
          links: [],
          groups: [{ id: 5, title: 'Stage 1', bounding: [0, 0, 100, 100] }]
        },
        mutations
      })
      expect(deleteGroups).not.toHaveBeenCalled()

      applyOps(host, [op('clear-1', 2, { op: 'clear', removed_nodes: [1] })])
      expect(deliver(['clear-1'])).toBe(true)

      expect(deleteGroups).toHaveBeenCalledOnce()
      expect(deleteGroups.mock.calls[0]?.[1]).toEqual([5])
    })

    it('does not call deleteGroups when meta.groups is unchanged', () => {
      const { mutations, deleteGroups } = groupSpyMutations(() => scope)
      const { host, deliver } = bindTarget({
        graph: {
          nodes: [
            {
              id: 1,
              type: 'Source',
              pos: [10, 20],
              inputs: [],
              outputs: [],
              widgets_values: {}
            },
            {
              id: 2,
              type: 'Source',
              pos: [40, 20],
              inputs: [],
              outputs: [],
              widgets_values: {}
            }
          ],
          links: [],
          groups: [{ id: 5, title: 'Stage 1', bounding: [0, 0, 100, 100] }]
        },
        mutations
      })

      // Delete one node, leaving the other and the group intact — an
      // ordinary partial delete_node must never touch groups.
      applyOps(host, [
        op('del-1', 2, { op: 'delete_node', node_id: 1, removed_links: [] })
      ])
      deliver(['del-1'])

      expect(deleteGroups).not.toHaveBeenCalled()
    })

    it('deletes an empty group with no node delta (group-only clear)', () => {
      const { mutations, deleteGroups } = groupSpyMutations(() => scope)
      const { host, deliver } = bindTarget({
        graph: groupGraph(7, 'Empty group'),
        mutations
      })

      // clear with an empty removed_nodes target (no nodes existed) but the
      // applier still blanks meta.groups: zero nodes does not mean an empty
      // canvas.
      applyOps(host, [op('clear-2', 2, { op: 'clear', removed_nodes: [] })])
      expect(deliver(['clear-2'])).toBe(true)

      expect(deleteGroups).toHaveBeenCalledOnce()
      expect(deleteGroups.mock.calls[0]?.[1]).toEqual([7])
    })

    // A session rebound when its tab goes active again starts fresh, so a
    // session-scoped baseline could never see a group the doc lost while the
    // tab was inactive. The baseline is adapter-scoped for exactly that
    // reason. It is NOT rebuilt from the groups the layout owner holds: local
    // groups never reach the doc, so that set would authorise deleting them.
    it('keeps the remote group baseline across a rebind', () => {
      const { mutations, deleteGroups } = groupSpyMutations(() => scope)
      const { host, deliver, rebind } = bindTarget({
        graph: groupGraph(5, 'Stage 1'),
        mutations
      })
      expect(deleteGroups).not.toHaveBeenCalled()

      // Tab goes inactive, the doc loses the group, the tab comes back: a
      // brand new session against a brand new follower doc.
      applyOps(host, [op('clear-5', 2, { op: 'clear', removed_nodes: [] })])
      rebind()

      expect(deliver(['clear-5'])).toBe(true)
      expect(deleteGroups).toHaveBeenCalledOnce()
      expect(deleteGroups.mock.calls[0]?.[1]).toEqual([5])
    })

    // The baseline is keyed by workflow id, not adapter-wide: one adapter
    // serves every open tab, so a set shared across workflows would let one
    // workflow's rebind delete another's group layouts.
    it('deletes only the rebound workflow group, leaving another workflow baseline intact', () => {
      const { mutations, deleteGroups } = groupSpyMutations(() => scope)
      const a = bindTarget({
        graph: groupGraph(5, 'Stage A'),
        mutations,
        workflowId: 'wf-a'
      })
      const b = bindTarget({
        graph: groupGraph(8, 'Stage B'),
        mutations,
        workflowId: 'wf-b',
        adapter: a.adapter
      })

      // Only workflow A's doc drops its group. A shared set would carry 8 into
      // A's diff and delete a group A's doc never named.
      applyOps(a.host, [op('clear-a', 2, { op: 'clear', removed_nodes: [] })])
      a.rebind()
      expect(a.deliver(['clear-a'])).toBe(true)
      expect(deleteGroups).toHaveBeenCalledOnce()
      expect(deleteGroups.mock.calls[0]?.[1]).toEqual([5])

      // B's own baseline survived A's delete, so B can still remove 8 when B's
      // doc drops it. Reading the active workflow's set instead of keying by
      // workflow would have consumed it above.
      applyOps(b.host, [op('clear-b', 2, { op: 'clear', removed_nodes: [] })])
      expect(b.deliver(['clear-b'])).toBe(true)
      expect(deleteGroups).toHaveBeenCalledTimes(2)
      expect(deleteGroups.mock.calls[1]?.[1]).toEqual([8])
    })

    // The blocker DrJKL reproduced against the real layout store: a group the
    // user created locally is absent from `meta.groups`, because
    // `layoutMintPort` mints no group op. Reconciling against "every group the
    // owner holds" therefore deletes the user's own group. This asserts on the
    // real `layoutStore`, so the failure is observable canvas state rather than
    // a spy call. The port below is EQUIVALENT to, not the same object as, the
    // one `AgentPanelRoot.vue` installs inline: it re-states that mapping here,
    // so this test cannot detect the production port drifting away from it.
    // Covering the production wiring needs a component-level test that mounts
    // `AgentPanelRoot.vue`.
    it('leaves a local-only group the doc never named alone', () => {
      const mutations = createGraphMutations({
        getScope: () => scope,
        placement: inertPlacementPort,
        layout: {
          createNode: vi.fn(),
          deleteNodes: vi.fn(),
          deleteGroups(scope, groupIds, context) {
            const timestamp = Date.now()
            layoutStore.applyOperations(
              groupIds.map((groupId) => ({
                type: 'deleteGroup',
                graphId: scope.rootGraphId,
                groupId,
                source: LayoutSource.AgentRemote,
                actor: context.actor,
                opId: context.opId,
                timestamp
              }))
            )
          }
        }
      })

      // The user drew this group on the canvas; nothing minted it, so the doc
      // has never carried its id.
      const localGroupId = toGroupId(9)
      layoutStore.applyOperation({
        type: 'createGroup',
        graphId: scope.rootGraphId,
        groupId: localGroupId,
        layout: {
          id: localGroupId,
          position: { x: 0, y: 0 },
          size: { width: 120, height: 80 }
        },
        source: LayoutSource.Canvas,
        actor: 'user',
        opId: 'local-group',
        timestamp: Date.now()
      })

      // The first frame of a fresh session is a reconcile frame — the one that
      // used to hand the owner "every group not in the doc". `bindTarget`
      // delivers and asserts it.
      bindTarget({ graph: { nodes: [], links: [], groups: [] }, mutations })

      expect(
        layoutStore.getGroupLayout(scope.rootGraphId, localGroupId)
      ).not.toBeNull()
    })

    it('retries a rejected group deletion on the next frame', () => {
      let scopeAvailable = true
      const { mutations, deleteGroups } = groupSpyMutations(() =>
        scopeAvailable ? scope : null
      )
      const { host, deliver } = bindTarget({
        graph: groupGraph(5, 'Stage 1'),
        mutations
      })

      applyOps(host, [op('clear-3', 2, { op: 'clear', removed_nodes: [] })])

      // Rejected: no scope. Nothing reaches the layout owner, and the
      // baseline must not advance — otherwise the retry would diff against a
      // snapshot this session never committed against and lose the deletion.
      scopeAvailable = false
      expect(deliver(['clear-3'])).toBe(false)
      expect(deleteGroups).not.toHaveBeenCalled()

      // The retry diffs against the un-advanced baseline, so group 5 is still
      // seen to have left the doc and is still deleted.
      scopeAvailable = true
      expect(deliver(['clear-3'])).toBe(true)
      expect(deleteGroups).toHaveBeenCalledOnce()
      expect(deleteGroups.mock.calls[0]?.[1]).toEqual([5])
    })

    it('is idempotent when an already committed group deletion is delivered twice', () => {
      const { mutations, deleteGroups } = groupSpyMutations(() => scope)
      const { host, deliver } = bindTarget({
        graph: groupGraph(5, 'Stage 1'),
        mutations
      })

      applyOps(host, [op('clear-4', 2, { op: 'clear', removed_nodes: [] })])

      expect(deliver(['clear-4'])).toBe(true)
      expect(deleteGroups).toHaveBeenCalledOnce()

      // Redelivery of the same frame: the baseline advanced on commit, so the
      // diff is empty and no second delete reaches the layout owner.
      expect(deliver(['clear-4'])).toBe(true)
      expect(deleteGroups).toHaveBeenCalledOnce()
    })

    describe('lineage reset', () => {
      const resetContext: RemoteMutationContext = {
        source: 'agent-remote',
        actor: 'agent:test',
        opId: 'doc-reset'
      }

      it('deletes the observed groups in the same accepted batch as the semantic clear', () => {
        const { mutations, deleteGroups, deleteNodes } = groupSpyMutations(
          () => scope
        )
        const { adapter } = bindTarget({
          graph: groupGraph(5, 'Stage 1'),
          mutations
        })

        expect(adapter.clearForReset('wf', resetContext)).toBe(true)

        // `clearSemanticGraph` reaches the layout owner as `deleteNodes`; the
        // group layouts only go with it because the recorded ids ride the same
        // batch. Without that leg they survive the reset and a save writes
        // them back under the replacement lineage.
        expect(deleteGroups).toHaveBeenCalledOnce()
        expect(deleteGroups.mock.calls[0]?.[1]).toEqual([5])
        expect(deleteNodes).toHaveBeenCalled()
      })

      // Falsifier for the test above: that one still passes against an
      // implementation that clears semantic state in one transaction and
      // deletes the groups in a second. Here the scope resolves for exactly
      // one transaction after the seed, so a split implementation commits the
      // clear and then has its group cleanup rejected — a partial clear that
      // leaves the group layouts behind. One batch resolves scope once and
      // lands both effects.
      it('commits both reset effects when only one transaction can resolve a scope', () => {
        let resetStarted = false
        let resolutions = 0
        const { mutations, deleteGroups, deleteNodes } = groupSpyMutations(
          () => {
            if (!resetStarted) return scope
            resolutions += 1
            return resolutions > 1 ? null : scope
          }
        )
        const { adapter } = bindTarget({
          graph: groupGraph(5, 'Stage 1'),
          mutations
        })

        resetStarted = true
        expect(adapter.clearForReset('wf', resetContext)).toBe(true)

        expect(deleteNodes).toHaveBeenCalled()
        expect(deleteGroups).toHaveBeenCalledOnce()
        expect(deleteGroups.mock.calls[0]?.[1]).toEqual([5])
      })

      it('keeps the delete authorization when the reset batch is rejected', () => {
        let scopeAvailable = true
        const { mutations, deleteGroups } = groupSpyMutations(() =>
          scopeAvailable ? scope : null
        )
        const { adapter } = bindTarget({
          graph: groupGraph(5, 'Stage 1'),
          mutations
        })

        scopeAvailable = false
        expect(adapter.clearForReset('wf', resetContext)).toBe(false)
        expect(deleteGroups).not.toHaveBeenCalled()

        // The baseline advanced only on commit, so the retry still carries the
        // authorization to remove the group the rejected batch left behind.
        scopeAvailable = true
        expect(adapter.clearForReset('wf', resetContext)).toBe(true)
        expect(deleteGroups).toHaveBeenCalledOnce()
        expect(deleteGroups.mock.calls[0]?.[1]).toEqual([5])
      })

      it('drops stale group authorization when the reset arrives with no bound target', () => {
        const { mutations, deleteGroups } = groupSpyMutations(() => scope)
        const { adapter, deliver, unbind, rebind } = bindTarget({
          graph: groupGraph(5, 'Stage 1'),
          mutations
        })

        // The tab went inactive before the reset landed, so there is no
        // session to clear through.
        unbind()
        expect(adapter.clearForReset('wf', resetContext)).toBe(false)

        // The replacement lineage carries no groups of its own. A surviving
        // baseline of {5} would diff against an empty doc on the first frame
        // and delete group 5 in a lineage that never named it — the same
        // local-group blocker, reached through the reset path.
        const replacement = mint({ nodes: [], links: [], groups: [] }, catalog)
        disposables.push(() => replacement.destroy())
        rebind()
        expect(deliver(['seed'], replacement)).toBe(true)
        expect(deleteGroups).not.toHaveBeenCalled()
      })
    })
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
        pendingDeletes: () => pendingDeletes
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
})
