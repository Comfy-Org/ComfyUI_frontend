import { applyOps, mint, nodesMap } from '@comfyorg/comfy-multi-player'
import type { WidgetCatalog } from '@comfyorg/comfy-multi-player'
import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as Y from 'yjs'

import { createGraphMutations } from '@/core/graph/graphMutations'
import type { GraphMutations } from '@/core/graph/graphMutations'
import { useLinkStore } from '@/stores/linkStore'
import { useNodeDataStore } from '@/stores/nodeDataStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { toOwningGraphId, toRootGraphId } from '@/types/graphScopeId'
import { toLinkId } from '@/types/linkId'
import type { NodeId } from '@/types/nodeId'
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
interface TestLayout {
  position: { x: number; y: number }
  size: { width: number; height: number }
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
    ).toBeUndefined()
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

  it('retries authoritative reconciliation after a rejected first batch', () => {
    const deleteLayouts = vi.fn()
    let scopeAvailable = false
    const mutations = createGraphMutations({
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

  it('clears only the target owner for an empty authoritative snapshot', () => {
    const targetScope = scope
    const siblingScope = {
      rootGraphId: scope.rootGraphId,
      owningGraphId: toOwningGraphId('sibling')
    }
    let activeScope = targetScope
    const mutations = createGraphMutations({
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

    it('removes a widget deleted in place and keeps its siblings', () => {
      const { widgets, deliver, widgetValue, destroy } = bindSeededHost()
      expect(widgetValue('stale')).toBe(9)

      deliver(2, () => widgets.delete('stale'))

      expect(widgetValue('stale')).toBeUndefined()
      expect(widgetValue('seed')).toBe(1)
      expect(
        useNodeDataStore()
          .getGraphNodesFor('root', 'root')
          .map(({ id }) => id)
      ).toEqual(['1'])
      expect(useWidgetValueStore().clearNode).toHaveBeenCalledTimes(1)
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

    it('drops widgets missing from a replaced widget map', () => {
      const { node, deliver, widgetValue, destroy } = bindSeededHost()

      deliver(2, () => {
        const replacement = new Y.Map<unknown>()
        node.set('widgets', replacement)
        replacement.set('seed', 5)
      })

      expect(widgetValue('seed')).toBe(5)
      expect(widgetValue('stale')).toBeUndefined()
      destroy()
    })
  })

  it('materializes an agent add_node into the ECS store and layout port only (qa-59 companion)', () => {
    // Companion to `drops an agent-added node from serialize() ... (qa-59)`
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
})
