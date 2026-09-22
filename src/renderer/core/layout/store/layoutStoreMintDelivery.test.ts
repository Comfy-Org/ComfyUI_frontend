/**
 * The write-leg delivery-primitive pins (F2/F5): the agent mint ports assume
 * the layout store delivers queued changes on ONE microtask - the
 * intentional-clear capture and the severance sweep both time against it.
 * These tests run the REAL store through the REAL wiring so a future change
 * to the delivery primitive fails here, by name, instead of silently
 * emptying `delete_node.removed_links` or leaking clear captures.
 *
 * Also covers the tab-switch root-scope race: `LGraph.add()` queues its
 * layout `createNode` change on the store's own microtask, so it can still
 * be pending when a workflow switch reuses the same `LGraph` instance for
 * the next workflow (see the second describe block below).
 *
 * Lives in renderer (not workbench) because it imports the real layout store;
 * workbench must not import renderer, so the wiring takes the store's seams
 * injected - exactly as the composition root will inject them.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { GraphScope, RootGraphId } from '@/types/graphScopeId'
import type { LinkTopology } from '@/types/linkTopology'
import type { GraphOperation } from '@/workbench/extensions/agent/crdt/graphOperations'
import type {
  MintPortWiring,
  MintableGraph
} from '@/workbench/extensions/agent/crdt/mintPortWiring'

import { ACTOR_CONFIG } from '@/renderer/core/layout/constants'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { LayoutSource } from '@/renderer/core/layout/types'
import { useLinkStore } from '@/stores/linkStore'
import { toOwningGraphId, toRootGraphId } from '@/types/graphScopeId'
import { toLinkId } from '@/types/linkId'
import { toNodeId } from '@/types/nodeId'
import { createUuidv4 } from '@/utils/uuid'
import { attachMintPortWiring } from '@/workbench/extensions/agent/crdt/mintPortWiring'

function createNodeOp(graphId: string, id: string) {
  return {
    type: 'createNode' as const,
    graphId,
    // Root-scoped, like the real attachNodeLayout producer: ownerGraphId
    // equals graphId. layoutMintPort's human-edit gate fails closed on a
    // defined graphId with no ownerGraphId (see reportUnrepresentableInteriorChange).
    ownerGraphId: graphId,
    nodeId: toNodeId(id),
    layout: {
      id: toNodeId(id),
      position: { x: 10, y: 20 },
      size: { width: 100, height: 60 },
      zIndex: 0,
      visible: true,
      bounds: { x: 10, y: 20, width: 100, height: 60 }
    },
    timestamp: Date.now(),
    source: LayoutSource.Canvas
  }
}

function deleteNodeOp(graphId: string, id: string) {
  return {
    type: 'deleteNode' as const,
    graphId,
    ownerGraphId: graphId,
    nodeId: toNodeId(id),
    timestamp: Date.now(),
    source: LayoutSource.Canvas
  }
}

/** Structural stand-in for the two LGraphNode members the wiring reads. */
interface FakeGraphNode {
  id?: unknown
  serialize?: () => unknown
  widgets?: { name: string; type: string; serialize?: boolean }[]
}

async function realDelivery(): Promise<void> {
  // The store's queued flush plus the ports' double-microtask sweep.
  for (let tick = 0; tick < 4; tick++) await Promise.resolve()
}

describe('mint ports against the real layout store delivery', () => {
  let minted: GraphOperation[]
  let wiring: MintPortWiring
  let graphId: string
  let scope: GraphScope
  let graphNodes: Map<string, FakeGraphNode>

  function linkTopology(id: number, targetId: string): LinkTopology {
    return {
      id: toLinkId(id),
      graphId: toOwningGraphId(graphId),
      originNodeId: toNodeId('1'),
      originSlot: 0,
      targetNodeId: toNodeId(targetId),
      targetSlot: 0,
      type: 'IMAGE'
    }
  }

  beforeEach(() => {
    minted = []
    graphId = createUuidv4()
    scope = {
      rootGraphId: toRootGraphId(graphId),
      owningGraphId: toOwningGraphId(graphId)
    }
    graphNodes = new Map()
    const graph: MintableGraph = {
      id: graphId,
      rootGraph: { id: graphId },
      getNodeById: (id) =>
        (graphNodes.get(String(id)) as unknown as LGraphNode | undefined) ??
        null,
      get _nodes() {
        return [...graphNodes.values()] as LGraphNode[]
      },
      events: new EventTarget() as unknown as MintableGraph['events']
    }
    wiring = attachMintPortWiring({
      isEnabled: () => true,
      isDocBound: () => true,
      enqueue: (operations) => minted.push(...operations),
      layoutChanges: (listener) => layoutStore.onChange(listener),
      localActorPrefix: 'user-',
      getGraph: () => graph,
      boundRootGraphId: () => toRootGraphId(graphId)
    })
  })

  afterEach(() => {
    wiring.detach()
  })

  it('delivers a local createNode as add_node with the mint-time snapshot', async () => {
    graphNodes.set('5', {
      id: toNodeId('5'),
      serialize: () => ({
        id: 5,
        type: 'TestNode',
        widgets_values: [7]
      })
    })

    layoutStore.applyOperation(createNodeOp(graphId, '5'))
    await realDelivery()

    expect(minted).toEqual([
      {
        op: 'add_node',
        node_id: toNodeId('5'),
        class_type: 'TestNode',
        pos: [10, 20],
        node: { id: 5, type: 'TestNode', widgets_values: [7] }
      }
    ])
  })

  it('F5: the severance capture survives until the real deleteNode delivery', async () => {
    layoutStore.applyOperation(createNodeOp(graphId, '2'))
    await realDelivery()
    const linkStore = useLinkStore()
    const severed = linkTopology(41, '2')
    linkStore.registerLink(scope, severed)
    minted.length = 0
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)

    // The real teardown order: litegraph severs the node's links
    // synchronously, then the layout deleteNode queues and delivers on the
    // store's own microtask. If delivery ever slips past the ports'
    // double-microtask sweep, removed_links comes back EMPTY here and a
    // false disconnect-divergence error fires - both assertions below
    // are the alarm.
    linkStore.deleteLink(scope, severed)
    layoutStore.applyOperation(deleteNodeOp(graphId, '2'))
    await realDelivery()

    expect(minted).toEqual([
      {
        op: 'delete_node',
        node_id: '2',
        removed_links: [toLinkId(41)]
      }
    ])
    expect(consoleError).not.toHaveBeenCalled()
    consoleError.mockRestore()
  })

  it('F2: the intentional-clear capture is consumed by the real clearGraph delivery', async () => {
    graphNodes.set('5', { id: toNodeId('5') })
    graphNodes.set('6', { id: toNodeId('6') })
    layoutStore.applyOperation(createNodeOp(graphId, '5'))
    layoutStore.applyOperation(createNodeOp(graphId, '6'))
    await realDelivery()
    minted.length = 0

    wiring.runIntentionalClear(() => {
      layoutStore.clearGraph(graphId)
    })
    await realDelivery()

    expect(minted).toEqual([
      { op: 'clear', removed_nodes: [toNodeId('5'), toNodeId('6')] }
    ])
  })

  it('a bare clearGraph outside the window stays inert through real delivery', async () => {
    layoutStore.applyOperation(createNodeOp(graphId, '5'))
    await realDelivery()
    minted.length = 0

    layoutStore.clearGraph(graphId)
    await realDelivery()

    expect(minted).toEqual([])
  })

  it('remote provenance suppresses a real layout apply end to end', async () => {
    graphNodes.set('5', {
      id: toNodeId('5'),
      serialize: () => ({ id: 5, type: 'TestNode' })
    })

    layoutStore.applyOperation({
      ...createNodeOp(graphId, '5'),
      source: LayoutSource.AgentRemote
    })
    await realDelivery()

    expect(minted).toEqual([])
  })

  it('re-mints add_node for an id a remote delete removed from the document', async () => {
    graphNodes.set('5', {
      id: toNodeId('5'),
      serialize: () => ({ id: 5, type: 'TestNode' })
    })

    layoutStore.applyOperation(createNodeOp(graphId, '5'))
    await realDelivery()
    expect(minted).toHaveLength(1)
    minted.length = 0

    layoutStore.applyOperation({
      ...deleteNodeOp(graphId, '5'),
      source: LayoutSource.AgentRemote
    })
    await realDelivery()
    expect(minted).toEqual([])

    layoutStore.applyOperation(createNodeOp(graphId, '5'))
    await realDelivery()

    expect(minted).toEqual([
      {
        op: 'add_node',
        node_id: toNodeId('5'),
        class_type: 'TestNode',
        pos: [10, 20],
        node: { id: 5, type: 'TestNode' }
      }
    ])
  })

  it('does not re-mint add_node for an id an incidental graph-load teardown clear removed (id_collision guard)', async () => {
    // A graph-load teardown clear bracketed by onBeforeGraphLoad/
    // onAfterGraphConfigure but never wrapped in runIntentionalClear is not
    // a human clear - it must not forget the bound root's dedupe bucket for
    // a node this port already relayed, or a later replay re-mints it
    // (id_collision). Mirrors the incidental-clear regression in
    // layoutMintPort.test.ts.
    graphNodes.set('5', {
      id: toNodeId('5'),
      serialize: () => ({ id: 5, type: 'TestNode' })
    })

    layoutStore.applyOperation(createNodeOp(graphId, '5'))
    await realDelivery()
    expect(minted).toHaveLength(1)
    minted.length = 0

    wiring.onBeforeGraphLoad()
    graphNodes.delete('5')
    layoutStore.clearGraph(graphId)
    await realDelivery()
    wiring.onAfterGraphConfigure()
    expect(minted).toEqual([])

    graphNodes.set('5', {
      id: toNodeId('5'),
      serialize: () => ({ id: 5, type: 'TestNode' })
    })
    layoutStore.applyOperation(createNodeOp(graphId, '5'))
    await realDelivery()

    expect(minted).toEqual([])
  })

  it('surfaces a real bare disconnect as divergence after the sweep', async () => {
    const linkStore = useLinkStore()
    const dangling = linkTopology(43, '9')
    linkStore.registerLink(scope, dangling)
    minted.length = 0
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)

    linkStore.deleteLink(scope, dangling)
    await realDelivery()

    expect(consoleError).toHaveBeenCalledOnce()
    consoleError.mockRestore()
  })
})

describe('attachMintPortWiring: root graph scope across a tab switch', () => {
  let minted: GraphOperation[]
  let wiring: MintPortWiring
  let liveGraph: LGraph
  let graphNodes: Map<string, LGraphNode>
  let boundRootGraphId: RootGraphId

  beforeEach(() => {
    minted = []
    graphNodes = new Map()
    liveGraph = new LGraph()
    liveGraph.id = createUuidv4()
    // The workflow bound before the switch below starts; `boundRootGraphId`
    // (AgentPanelRoot.vue) reads it off the bound workflow's own serialized
    // state, which does not change until the binding itself changes.
    boundRootGraphId = toRootGraphId(liveGraph.id)

    const graphAdapter: MintableGraph = {
      get id() {
        return liveGraph.id
      },
      get rootGraph() {
        return { id: liveGraph.rootGraph.id }
      },
      getNodeById: (id) => graphNodes.get(String(id)) ?? null,
      get _nodes() {
        return [...graphNodes.values()]
      },
      events: new EventTarget() as unknown as MintableGraph['events']
    }

    wiring = attachMintPortWiring({
      isEnabled: () => true,
      // The bound document never becomes unbound during this race: the
      // follower flips `isBoundWorkflowActive` only once `activeWorkflow`
      // itself changes, which happens strictly after this bracket closes.
      isDocBound: () => true,
      enqueue: (operations) => minted.push(...operations),
      layoutChanges: (listener) => layoutStore.onChange(listener),
      localActorPrefix: ACTOR_CONFIG.USER_PREFIX,
      getGraph: () => graphAdapter,
      boundRootGraphId: () => boundRootGraphId
    })
  })

  afterEach(() => wiring.detach())

  it("does not mint add_node for a newly configured workflow's nodes while the previous workflow is still the bound document", async () => {
    // Switch-away: `beforeLoadNewGraph` -> `beforeLoadGraph` fires first.
    wiring.onBeforeGraphLoad()

    // `rootGraph.configure(B)` reuses the SAME LGraph instance but rewrites
    // its `id` from B's stored workflow JSON (`_configureBase`), then adds
    // B's nodes to it. Each `LGraph.add()` queues a layout `createNode`
    // change for the NEW graph id on a microtask.
    liveGraph.id = createUuidv4()
    const nodeFromOtherWorkflow = new LGraphNode('TestNode')
    nodeFromOtherWorkflow.id = toNodeId(101)
    liveGraph.add(nodeFromOtherWorkflow)
    graphNodes.set('101', nodeFromOtherWorkflow)

    // `afterConfigureGraph` -> `endGraphTeardown()` runs synchronously right
    // after `configure()`, with no `await` in between on the happy path.
    wiring.onAfterGraphConfigure()

    // The queued layout change flushes only now, once the synchronous
    // portion of the switch has finished, and lands while `isDocBound()`
    // still (wrongly) reports the previous workflow's document as bound.
    await realDelivery()

    expect(minted.filter((operation) => operation.op === 'add_node')).toEqual(
      []
    )
  })
})
