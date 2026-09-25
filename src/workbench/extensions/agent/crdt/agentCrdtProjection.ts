import type * as Y from 'yjs'

import type { RemoteMutationContext } from '@/types/graphMutationContext'
import type { NodeId } from '@/types/nodeId'

import type { MaterializableGraph } from './agentNodeMaterializer'
import {
  reconcileAgentAdapters,
  subgraphDefinitionReadState
} from './agentNodeMaterializer'
import {
  readSubgraphDefinitionIds,
  readSubgraphDefinitions
} from './agentSubgraphDefinitions'
import { recordDevEvent } from './devPanelLog'
import type { DocUpdate } from './docFrameClient'
import type { MutationsForTarget } from './ecsFollowerAdapter'
import type { LocalIntent } from './ecsFullReconcile'
import { EcsFollowerAdapter } from './ecsFollowerAdapter'
import type { FollowerDoc } from './followerDoc'

export class AgentCrdtProjection<TUpdate extends DocUpdate = DocUpdate> {
  private readonly adapter: EcsFollowerAdapter<TUpdate>

  constructor(
    mutations: MutationsForTarget,
    private readonly getGraph: () => MaterializableGraph | null,
    private readonly getFollowerDoc: () => Y.Doc,
    /**
     * ADR-CRDT-RECONCILE-0035 (c): the `class_type` of the pending-op
     * ledger's `add_node` for this node id, in any echo-visible state, or
     * `undefined` when none. Distinguishes the echo of the page's own
     * accepted add (reconcile, no report) from a genuine id collision
     * (reconcile, but reported) — including a same-id, different-type add.
     */
    pendingAddType: (nodeId: string) => string | undefined = () => undefined,
    intent?: LocalIntent
  ) {
    this.adapter = new EcsFollowerAdapter<TUpdate>(
      mutations,
      pendingAddType,
      intent
    )
  }

  bind(workflowId: string, follower: FollowerDoc): void {
    this.adapter.bind(workflowId, follower)
  }

  unbind(workflowId: string): void {
    this.adapter.unbind(workflowId)
  }

  /**
   * Store-only, and deliberately so: `reconcileLiveGraph` can throw (its
   * orphan sweep reaches extension `onRemoved` hooks), and the caller counts
   * this frame's outcome from the return value. Folding the sweep in here
   * would let a third-party hook leave a frame counted in `received` and in
   * neither `applied` nor `skipped`.
   */
  applyFrame(update: TUpdate): boolean {
    return this.adapter.applyFrame(update)
  }

  /**
   * Empties the stores for a lineage break and sweeps the live graph in the
   * same step. The adapter's clear is store-only, but the live adapters are
   * what a save serialises: without the sweep the pre-reset nodes survive,
   * and can be written back, until some later frame happens to arrive.
   */
  clearForReset(workflowId: string, context: RemoteMutationContext): boolean {
    const cleared = this.adapter.clearForReset(workflowId, context)
    this.reconcileLiveGraph(workflowId)
    return cleared
  }

  discardPending(workflowId: string): void {
    this.adapter.discardPending(workflowId)
  }

  /**
   * Forces a same-lineage full reconcile of `workflowId`'s ECS state against
   * the follower doc outside the frame pipeline — the same reconcile a
   * session's first real frame after (re)bind takes. Used when a resubscribe
   * ack proves the doc is already current: no catch-up `doc_update` will
   * ever arrive to drive that reconcile through {@link applyFrame}. Also
   * runs {@link reconcileLiveGraph} on a committed reconcile, exactly as the
   * frame and retry paths do — otherwise the repaired store state is never
   * materialized onto the live graph, since no later frame is coming to do
   * it either.
   */
  reconcileFromDoc(workflowId: string, seq: number): boolean {
    const committed = this.adapter.reconcileFromDoc(workflowId, seq)
    if (committed) this.reconcileLiveGraph(workflowId)
    return committed
  }

  retryPending(workflowId: string): TUpdate | null {
    return this.adapter.retryPending(workflowId)
  }

  /** @returns ids that received a new live node on this pass. */
  reconcileLiveGraph(workflowId: string): NodeId[] {
    const graph = this.getGraph()
    if (!graph) return []
    const followerDoc = this.getFollowerDoc()
    const definitionIds = readSubgraphDefinitionIds(followerDoc)
    const definitionStates = definitionIds.map((id) => ({
      id,
      state: subgraphDefinitionReadState(graph.rootGraph, id)
    }))
    const needsDefinitionBody = definitionStates.some(
      ({ state }) => state === 'missing'
    )
    const failedDefinitionIds = new Set(
      definitionStates
        .filter(({ state }) => state === 'failed')
        .map(({ id }) => id)
    )
    const definitions = needsDefinitionBody
      ? readSubgraphDefinitions(followerDoc, failedDefinitionIds)
      : []
    const nodeIds = failedDefinitionIds.size
      ? reconcileAgentAdapters(graph, definitions, failedDefinitionIds)
      : reconcileAgentAdapters(graph, definitions)
    // A frame that only wires or rewires nodes moves no layout, so nothing
    // else asks the canvas to paint the new links.
    graph.setDirtyCanvas(true, true)
    if (nodeIds.length > 0) {
      recordDevEvent('agent_node_adapters_materialized', {
        workflowId,
        nodeIds
      })
    }
    return nodeIds
  }

  destroy(): void {
    this.adapter.destroy()
  }
}
