/**
 * ADR-CRDT-PENDING-0030's load-bearing pin: a pending-op revert removal must
 * not re-mint a `delete_node`. `LGraph.remove` ends in an actor-less layout
 * `deleteNode` that the store delivers on a microtask - AFTER
 * `runMintPortsSuppressed`'s bracket has ended - so only
 * `layoutStore.withActor`'s apply-time stamping keeps the layout mint port's
 * local-actor gate closed. Runs the REAL store through the REAL wiring (like
 * `layoutStoreMintDelivery.test.ts`), with a would-have-minted control so the
 * pin can fail. Lives in renderer because it imports the real layout store;
 * the workbench module takes `withActor` injected.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { Op } from '@comfyorg/comfy-multi-player'

import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { GraphOperation } from '@/workbench/extensions/agent/crdt/graphOperations'
import type {
  MintPortWiring,
  MintableGraph
} from '@/workbench/extensions/agent/crdt/mintPortWiring'
import type {
  PendingRevertNodeRegistry,
  WithLayoutActor
} from '@/workbench/extensions/agent/crdt/pendingOpRevert'

import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { LayoutSource } from '@/renderer/core/layout/types'
import { toNodeId } from '@/types/nodeId'
import { createUuidv4 } from '@/utils/uuid'
import { attachMintPortWiring } from '@/workbench/extensions/agent/crdt/mintPortWiring'
import { createPendingRevertNodeRegistry } from '@/workbench/extensions/agent/crdt/pendingOpRevert'
import { toRootGraphId } from '@/types/graphScopeId'

function createNodeOp(graphId: string, id: string) {
  return {
    type: 'createNode' as const,
    graphId,
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

async function realDelivery(): Promise<void> {
  for (let tick = 0; tick < 4; tick++) await Promise.resolve()
}

describe('pending revert removal against the real layout store', () => {
  let minted: GraphOperation[]
  let wiring: MintPortWiring
  let graphId: string
  let graphNodes: Map<string, { id: unknown }>

  function buildRemoveNode(
    withLayoutActor: WithLayoutActor
  ): PendingRevertNodeRegistry {
    return createPendingRevertNodeRegistry({
      getGraph: () => ({
        get _nodes_by_id() {
          return Object.fromEntries(graphNodes) as Partial<
            Record<string, LGraphNode>
          >
        },
        // The tail of the real LGraph.remove teardown: `detachNodeLayout`
        // applies an ACTOR-LESS deleteNode that the store stamps and delivers
        // on its own microtask.
        remove(node: LGraphNode) {
          graphNodes.delete(String(node.id))
          layoutStore.applyOperation({
            type: 'deleteNode',
            graphId,
            ownerGraphId: graphId,
            nodeId: toNodeId(String(node.id)),
            timestamp: Date.now(),
            source: LayoutSource.Canvas
          })
        }
      }),
      withLayoutActor
    })
  }

  function captureNode(pendingNodes: PendingRevertNodeRegistry): void {
    const op: Op = {
      op: 'add_node',
      op_id: 'op-7',
      actor: 'human:test:tab',
      base_version: 1,
      stamp: [1, 'human:test:tab'],
      node_id: 7,
      class_type: 'TestNode',
      pos: [0, 0],
      node: { id: 7, type: 'TestNode' }
    }
    pendingNodes.onBatchMinted([op])
  }

  beforeEach(async () => {
    minted = []
    graphId = createUuidv4()
    graphNodes = new Map([['7', { id: toNodeId('7') }]])
    const graph: MintableGraph = {
      id: graphId,
      rootGraph: { id: graphId },
      getNodeById: (id) =>
        (graphNodes.get(String(id)) as unknown as LGraphNode | undefined) ??
        null,
      get _nodes() {
        return [...graphNodes.values()] as LGraphNode[]
      }
    }
    wiring = attachMintPortWiring({
      isEnabled: () => true,
      isDocBound: () => true,
      boundRootGraphId: () => toRootGraphId(graphId),
      enqueue: (operations) => minted.push(...operations),
      layoutChanges: (listener) => layoutStore.onChange(listener),
      localActorPrefix: 'user-',
      getGraph: () => graph
    })
    layoutStore.applyOperation(createNodeOp(graphId, '7'))
    await realDelivery()
    minted.length = 0
  })

  afterEach(() => {
    wiring.detach()
  })

  it('control: the same removal without withActor re-mints a delete_node', async () => {
    const pendingNodes = buildRemoveNode((_actor, fn) => fn())
    captureNode(pendingNodes)

    expect(pendingNodes.removeNode('op-7', 7)).toBe('removed')
    await realDelivery()

    expect(minted).toEqual([
      { op: 'delete_node', node_id: toNodeId('7'), removed_links: [] }
    ])
  })

  it('the revert removal under the real withActor mints nothing', async () => {
    const pendingNodes = buildRemoveNode((actor, fn) =>
      layoutStore.withActor(actor, fn)
    )
    captureNode(pendingNodes)

    expect(pendingNodes.removeNode('op-7', 7)).toBe('removed')
    await realDelivery()

    expect(minted).toEqual([])
  })
})
