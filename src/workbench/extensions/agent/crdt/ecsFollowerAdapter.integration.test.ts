import {
  applyOps,
  linksMap,
  mint,
  nodesMap
} from '@comfyorg/comfy-multi-player'
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

  // FEC-4 current-risk reproducer (node-type-change-semantics). The applier's
  // only node-write op is `add_node`, and a same-id `add_node` always
  // `mset`s a brand-new Y.Map at that key (applier.js `applyAddNode`) rather
  // than patching the existing one. There is no `update_node` op, so a
  // class/type change can only ever arrive as a winning re-add, and
  // ecsFollowerAdapter.ts does pair that root 'update' action with a
  // deleteNode+addNode batch (not a same-node in-place patch).
  //
  // Two layers leave the retype unconverged. First the doc: `applyAddNode`
  // ends with `reconcileNodeLinkRefs`, which rewrites only the re-added
  // node's `inputs[].link` / `outputs[].links` from the live `links` map and
  // never severs a link whose slot no longer exists on the new payload. Link
  // 9 therefore stays in `links` as [9, 1, 0, 2, 0] while node 1 has zero
  // outputs. Then the projection: `applyQueuedFrame` re-queues `connect` for
  // every link that referenced a replaced node (the `replacedNodeIds` walk),
  // and `readSemanticLink` attaches `originOutputs` read from the NEW node in
  // the doc. With Source's output slot 0 gone on Sink, graphMutations
  // `prepare()`'s `connect` case returns "connect origin slot 0 does not
  // exist", and because `batch()` validates the WHOLE queued batch before
  // committing anything (a string from `prepare()` makes `batch()` `fail()`
  // without a single store write, including the deleteNode/addNode pair that
  // would have retyped the node), the entire frame is dropped. The node is
  // left rendered as its OLD type, the exact "already-rendered type
  // uncorrected" gap this row exists to catch, just via atomic-batch-abort
  // rather than a coalesced-no-op read. Do not fix the applier, adapter or
  // batch semantics here; this is risk evidence only, and it is expected to
  // go red when FEC-4 lands.
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
      layout: { createNode: createLayout, deleteNodes: deleteLayouts }
    })
    const adapter = new EcsFollowerAdapter(mutations)
    adapter.bind('wf', follower)

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

    // Node 1 is re-minted at the same id as a different, unrelated type
    // ('Sink' has no widgets and no output) - not a widget/property edit.
    const before = Y.encodeStateVector(host)
    const result = applyOps(
      host,
      [
        op('retype', 2, {
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
        })
      ] as Parameters<typeof applyOps>[1],
      catalog
    )
    expect(result.outcomes).toEqual([{ op_id: 'retype', outcome: 'applied' }])
    // Doc-level half of the risk: the applier re-derived node 1's slot refs
    // but left link 9 in the live `links` map with an origin slot the Sink
    // payload no longer has.
    expect(nodesMap(host).get('1')?.get('outputs')).toHaveLength(0)
    expect(linksMap(host).get('9')).toEqual([9, 1, 0, 2, 0, 'IMAGE'])
    const update = Y.encodeStateAsUpdate(host, before)
    follower.applyRemoteUpdate(update)
    // The doc-layer op applied cleanly (asserted above); the follower frame
    // is still reported as consumed (no seq gap, no error state) even though
    // the projection batch beneath it silently rejected.
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
    ).toBe(true)
    // Pin the mechanism, not just the outcome: any other `prepare()`
    // rejection would also leave node 1 untouched and keep this test green.
    expect(rejected).toHaveBeenCalledWith(
      expect.stringContaining('connect origin slot 0 does not exist')
    )

    const stillSource = useNodeDataStore()
      .getGraphNodesFor('root', 'root')
      .find(({ id }) => id === toNodeId(1))
    // CURRENT-RISK EVIDENCE: the canvas still renders node 1 as the OLD
    // 'Source' shape with its stale widgets and its old link intact — the
    // retype batch (deleteNode(1) + addNode(1, Sink) + connect(9)) was
    // rejected wholesale by `prepare()`'s connect-slot check and never
    // committed. No remove/add reached the stores; nothing was corrected.
    expect(stillSource?.type).toBe('Source')
    expect(stillSource?.outputs).toHaveLength(1)
    expect(
      useWidgetValueStore().getWidget(widgetId('root', toNodeId(1), 'seed'))
        ?.value
    ).toBe(1)
    expect(
      useLinkStore().getTopology(scope.rootGraphId, toLinkId(9))
    ).toBeDefined()
    expect(deleteLayouts).not.toHaveBeenCalledWith(
      scope,
      [toNodeId(1)],
      expect.objectContaining({ opId: 'retype' })
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
