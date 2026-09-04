import type * as Y from 'yjs'

import type { RemoteMutationContext } from '@/types/graphMutationContext'

import type { MaterializableGraph } from './agentNodeMaterializer'
import { reconcileAgentAdapters } from './agentNodeMaterializer'
import { readSubgraphDefinitions } from './agentSubgraphDefinitions'
import { recordDevEvent } from './devPanelLog'
import type { DocUpdate } from './docFrameClient'
import type { MutationsForTarget } from './ecsFollowerAdapter'
import { EcsFollowerAdapter } from './ecsFollowerAdapter'
import type { FollowerDoc } from './followerDoc'

/** Projects follower documents into domain stores and reconciles their live graph adapters. */
export class AgentCrdtProjection {
  private readonly adapter: EcsFollowerAdapter

  constructor(
    mutations: MutationsForTarget,
    private readonly getGraph: () => MaterializableGraph | null,
    private readonly getFollowerDoc: () => Y.Doc
  ) {
    this.adapter = new EcsFollowerAdapter(mutations)
  }

  bind(workflowId: string, follower: FollowerDoc): void {
    this.adapter.bind(workflowId, follower)
  }

  unbind(workflowId: string): void {
    this.adapter.unbind(workflowId)
  }

  applyFrame(update: DocUpdate): boolean {
    const applied = this.adapter.applyFrame(update)
    if (applied) this.reconcileLiveGraph(update.workflowId)
    return applied
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

  reconcileLiveGraph(workflowId: string): void {
    const graph = this.getGraph()
    if (!graph) return
    const nodeIds = reconcileAgentAdapters(
      graph,
      readSubgraphDefinitions(this.getFollowerDoc())
    )
    if (nodeIds.length > 0) {
      recordDevEvent('agent_node_adapters_materialized', {
        workflowId,
        nodeIds
      })
    }
  }

  destroy(): void {
    this.adapter.destroy()
  }
}
