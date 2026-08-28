import { applyOps, mint } from '@comfyorg/comfy-multi-player'
import type { WidgetCatalog } from '@comfyorg/comfy-multi-player'
import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as Y from 'yjs'

import { createGraphMutations } from '@/core/graph/graphMutations'
import { useLinkStore } from '@/stores/linkStore'
import { useNodeDataStore } from '@/stores/nodeDataStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { toOwningGraphId, toRootGraphId } from '@/types/graphScopeId'
import { toLinkId } from '@/types/linkId'
import { toNodeId } from '@/types/nodeId'
import { widgetId } from '@/types/widgetId'

import type { DocUpdate } from './docFrameClient'
import { EcsFollowerAdapter } from './ecsFollowerAdapter'
import { FollowerDoc } from './followerDoc'

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
const otherScope = {
  rootGraphId: toRootGraphId('other-root'),
  owningGraphId: toOwningGraphId('other-root')
}

function op(id: string, baseVersion: number, payload: object) {
  return {
    op_id: id,
    actor: 'agent:test',
    base_version: baseVersion,
    stamp: [baseVersion, 'agent:test', id],
    ...payload
  }
}

describe('EcsFollowerAdapter integration', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  it('uses the bound workflow scope after the active canvas switches', () => {
    let activeScope = scope
    const mutations = createGraphMutations({
      getScope: () => activeScope,
      layout: { createNode: vi.fn(), deleteNodes: vi.fn() }
    })
    mutations.bindScope(scope)
    activeScope = otherScope

    const host = mint(
      {
        nodes: [
          {
            id: 1,
            type: 'Source',
            inputs: [],
            outputs: []
          }
        ],
        links: []
      },
      catalog
    )
    const follower = new FollowerDoc()
    const adapter = new EcsFollowerAdapter(mutations)
    adapter.bind(follower)
    const update = Y.encodeStateAsUpdate(host)
    follower.applyRemoteUpdate(update)

    expect(
      adapter.applyFrame({
        workflowId: 'workflow-a',
        seq: 1,
        update,
        opIds: ['workflow-a-op']
      })
    ).toBe(true)
    expect(
      useNodeDataStore().getGraphNodesFor('other-root', 'other-root')
    ).toEqual([])
    expect(
      useNodeDataStore()
        .getGraphNodesFor('root', 'root')
        .map(({ id }) => id)
    ).toEqual(['1'])

    adapter.destroy()
    follower.destroy()
    host.destroy()
  })

  it('FEC-14 F2 current-risk gap: a second binding replaces the singleton target session', () => {
    // Characterizes the current F2 gap, not desired multi-target behavior.
    const mutations = createGraphMutations({
      getScope: () => scope,
      layout: { createNode: vi.fn(), deleteNodes: vi.fn() }
    })
    const firstHost = mint({ nodes: [], links: [] }, catalog)
    const secondHost = mint(
      { nodes: [{ id: 2, type: 'Sink', inputs: [], outputs: [] }], links: [] },
      catalog
    )
    const firstFollower = new FollowerDoc()
    const secondFollower = new FollowerDoc()
    const adapter = new EcsFollowerAdapter(mutations)

    mutations.bindScope(scope)
    adapter.bind(firstFollower)
    const firstUpdate = Y.encodeStateAsUpdate(firstHost)
    firstFollower.applyRemoteUpdate(firstUpdate)
    expect(
      adapter.applyFrame({
        workflowId: 'workflow-a',
        seq: 1,
        update: firstUpdate,
        opIds: []
      })
    ).toBe(false)
    expect(adapter.hasPendingEffects).toBe(true)

    mutations.bindScope(otherScope)
    adapter.bind(secondFollower)
    expect(adapter.hasPendingEffects).toBe(false)

    const staleFirstHost = mint(
      {
        nodes: [{ id: 1, type: 'Source', inputs: [], outputs: [] }],
        links: []
      },
      catalog
    )
    const staleFirstUpdate = Y.encodeStateAsUpdate(staleFirstHost)
    firstFollower.applyRemoteUpdate(staleFirstUpdate)
    const secondUpdate = Y.encodeStateAsUpdate(secondHost)
    secondFollower.applyRemoteUpdate(secondUpdate)
    expect(
      adapter.applyFrame({
        workflowId: 'workflow-b',
        seq: 1,
        update: secondUpdate,
        opIds: ['workflow-b-op']
      })
    ).toBe(true)
    expect(useNodeDataStore().getGraphNodesFor('root', 'root')).toEqual([])
    expect(
      useNodeDataStore()
        .getGraphNodesFor('other-root', 'other-root')
        .map(({ id }) => id)
    ).toEqual(['2'])

    adapter.destroy()
    firstFollower.destroy()
    secondFollower.destroy()
    firstHost.destroy()
    staleFirstHost.destroy()
    secondHost.destroy()
  })

  it('FEC-14 F3 current-risk gap: an offscreen commit dirties the active canvas singleton', () => {
    // Characterizes the current F3 gap, not desired target-aware invalidation.
    const activeCanvas = { setDirty: vi.fn() }
    const mutations = createGraphMutations({
      getScope: () => otherScope,
      onCommit: () => activeCanvas.setDirty(true, true),
      layout: { createNode: vi.fn(), deleteNodes: vi.fn() }
    })
    mutations.bindScope(otherScope)
    const host = mint(
      { nodes: [{ id: 2, type: 'Sink', inputs: [], outputs: [] }], links: [] },
      catalog
    )
    const follower = new FollowerDoc()
    const adapter = new EcsFollowerAdapter(mutations)
    adapter.bind(follower)
    const update = Y.encodeStateAsUpdate(host)
    follower.applyRemoteUpdate(update)

    expect(
      adapter.applyFrame({
        workflowId: 'offscreen-workflow',
        seq: 1,
        update,
        opIds: ['offscreen-op']
      })
    ).toBe(true)
    expect(activeCanvas.setDirty).toHaveBeenCalledWith(true, true)
    expect(activeCanvas.setDirty).toHaveBeenCalledTimes(1)

    adapter.destroy()
    follower.destroy()
    host.destroy()
  })

  it('FEC-14 F4 current-risk gap: same-ID re-add drops creator-carried incarnation', () => {
    // Characterizes the current F4/DQ-11c gap, not desired incarnation propagation.
    const mutations = createGraphMutations({
      getScope: () => scope,
      layout: { createNode: vi.fn(), deleteNodes: vi.fn() }
    })
    mutations.bindScope(scope)
    const host = mint({ nodes: [], links: [] }, catalog)
    const follower = new FollowerDoc()
    const adapter = new EcsFollowerAdapter(mutations)
    adapter.bind(follower)

    let seq = 0
    const deliver = (payload: object) => {
      const before = Y.encodeStateVector(host)
      const operationId = `incarnation-${++seq}`
      const result = applyOps(
        host,
        [
          op(operationId, seq, {
            ...payload,
            node_incarnation: 'creator-incarnation-a'
          })
        ] as Parameters<typeof applyOps>[1],
        catalog
      )
      expect(result.outcomes[0]?.outcome).toBe('applied')
      const update = Y.encodeStateAsUpdate(host, before)
      follower.applyRemoteUpdate(update)
      expect(
        adapter.applyFrame({
          workflowId: 'wf',
          seq,
          update,
          opIds: [operationId]
        })
      ).toBe(true)
    }

    deliver({
      op: 'add_node',
      node_id: 1,
      class_type: 'Source',
      pos: [0, 0],
      node: { id: 1, type: 'Source', inputs: [], outputs: [] }
    })
    deliver({ op: 'delete_node', node_id: 1, removed_links: [] })
    deliver({
      op: 'add_node',
      node_id: 1,
      class_type: 'Source',
      pos: [20, 30],
      node: { id: 1, type: 'Source', inputs: [], outputs: [] }
    })

    const replacement = useNodeDataStore()
      .getGraphNodesFor('root', 'root')
      .find(({ id }) => id === toNodeId(1)) as
      | (Record<string, unknown> & { id: string })
      | undefined
    // The stamped op's incarnation never crosses the applier/adapter boundary;
    // delete-wins leaves no replacement shell carrying that identity.
    expect(replacement).toBeUndefined()

    adapter.destroy()
    follower.destroy()
    host.destroy()
  })

  it('removes a local-only node during the first authoritative catch-up', () => {
    const createLayout = vi.fn()
    const deleteLayouts = vi.fn()
    const mutations = createGraphMutations({
      getScope: () => scope,
      layout: { createNode: createLayout, deleteNodes: deleteLayouts }
    })
    mutations.addNode(
      {
        id: 3,
        type: 'Source',
        inputs: [],
        outputs: [],
        widgets_values: {}
      },
      { source: 'agent-remote', actor: 'seed', opId: 'local-only' }
    )

    const host = mint(
      {
        nodes: [
          { id: 1, type: 'Source', inputs: [], outputs: [] },
          { id: 2, type: 'Sink', inputs: [], outputs: [] }
        ],
        links: []
      },
      catalog
    )
    const follower = new FollowerDoc()
    const adapter = new EcsFollowerAdapter(mutations)
    adapter.bind(follower)
    const update = Y.encodeStateAsUpdate(host)
    follower.applyRemoteUpdate(update)

    expect(
      adapter.applyFrame({
        workflowId: 'wf',
        seq: 1,
        update,
        opIds: ['bootstrap']
      })
    ).toBe(true)
    expect(
      useNodeDataStore()
        .getGraphNodesFor('root', 'root')
        .map(({ id }) => id)
    ).toEqual(['1', '2'])
    expect(deleteLayouts).toHaveBeenCalledWith(
      scope,
      ['3'],
      expect.objectContaining({ opId: 'bootstrap' })
    )

    adapter.destroy()
    follower.destroy()
    host.destroy()
  })

  it('retains effects after a missing-scope rejection and retries them', () => {
    let currentScope = null as typeof scope | null
    const mutations = createGraphMutations({
      getScope: () => currentScope,
      layout: { createNode: vi.fn(), deleteNodes: vi.fn() }
    })
    const host = mint(
      {
        nodes: [{ id: 1, type: 'Source', inputs: [], outputs: [] }],
        links: []
      },
      catalog
    )
    const follower = new FollowerDoc()
    const adapter = new EcsFollowerAdapter(mutations)
    adapter.bind(follower)
    const update = Y.encodeStateAsUpdate(host)
    follower.applyRemoteUpdate(update)
    const frame = { workflowId: 'wf', seq: 1, update, opIds: ['retry-me'] }

    expect(adapter.applyFrame(frame)).toBe(false)
    expect(adapter.hasPendingEffects).toBe(true)
    expect(useNodeDataStore().getGraphNodesFor('root', 'root')).toEqual([])

    currentScope = scope
    mutations.bindScope(scope)
    expect(adapter.retryPending()).toBe(true)
    expect(adapter.hasPendingEffects).toBe(false)
    expect(useNodeDataStore().getGraphNodesFor('root', 'root')).toHaveLength(1)

    adapter.destroy()
    follower.destroy()
    host.destroy()
  })

  it('retains effects after a validation rejection following Yjs integration', () => {
    const mutations = createGraphMutations({
      getScope: () => scope,
      layout: { createNode: vi.fn(), deleteNodes: vi.fn() }
    })
    const host = mint(
      {
        nodes: [{ id: 1, type: 'Source', inputs: [], outputs: [] }],
        links: []
      },
      catalog
    )
    // Deliberately malformed host topology: the ECS plan must reject the
    // missing target instead of partially materializing node 1.
    const links = host.getMap('links')
    links.set('9', [9, 1, 0, 404, 0, 'IMAGE'])
    const follower = new FollowerDoc()
    const adapter = new EcsFollowerAdapter(mutations)
    adapter.bind(follower)
    const update = Y.encodeStateAsUpdate(host)
    follower.applyRemoteUpdate(update)

    expect(
      adapter.applyFrame({
        workflowId: 'wf',
        seq: 1,
        update,
        opIds: ['reject-me']
      })
    ).toBe(false)
    expect(adapter.hasPendingEffects).toBe(true)
    expect(useNodeDataStore().getGraphNodesFor('root', 'root')).toEqual([])

    adapter.destroy()
    follower.destroy()
    host.destroy()
  })

  it('reconciles a full seeded snapshot with existing and server-ahead entities', () => {
    const createLayout = vi.fn()
    const deleteLayouts = vi.fn()
    const mutations = createGraphMutations({
      getScope: () => scope,
      layout: { createNode: createLayout, deleteNodes: deleteLayouts }
    })
    mutations.addNode(
      {
        id: 1,
        type: 'Source',
        title: 'Local baseline',
        pos: [0, 0],
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
    adapter.bind(follower)
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
    ).toBeUndefined()
    expect(
      useLinkStore().getTopology(scope.rootGraphId, toLinkId(9))
    ).toMatchObject({ originNodeId: toNodeId(1), targetNodeId: toNodeId(2) })
    expect(deleteLayouts).toHaveBeenCalledWith(
      scope,
      [toNodeId(1)],
      expect.objectContaining({ opId: 'bootstrap' })
    )
    expect(createLayout).toHaveBeenCalledTimes(2)

    adapter.destroy()
    follower.destroy()
    host.destroy()
  })

  it('materializes only the valid prefix of an aborted applier batch', () => {
    const host = mint({ nodes: [], links: [] }, catalog)
    const follower = new FollowerDoc()
    const mutations = createGraphMutations({
      getScope: () => scope,
      layout: { createNode: vi.fn(), deleteNodes: vi.fn() }
    })
    const adapter = new EcsFollowerAdapter(mutations)
    adapter.bind(follower)

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
      getScope: () => scope,
      layout: { createNode: vi.fn(), deleteNodes: vi.fn() }
    })
    const adapter = new EcsFollowerAdapter(mutations)
    adapter.bind(follower)

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
      getScope: () => scope,
      layout: { createNode: createLayout, deleteNodes: deleteLayouts }
    })
    const adapter = new EcsFollowerAdapter(mutations)
    adapter.bind(follower)

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

    // A higher-stamped same-id add replaces the shell, drops stale widget
    // state, and restores authoritative links. DQ-11c remains shared-schema
    // work; this test only covers FE derived-state cleanup.
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
})
