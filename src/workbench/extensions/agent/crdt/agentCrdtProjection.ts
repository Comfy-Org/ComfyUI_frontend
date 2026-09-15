import type * as Y from 'yjs'

import type { RemoteMutationContext } from '@/types/graphMutationContext'

import type { MaterializableGraph } from './agentNodeMaterializer'
import { reconcileAgentAdapters } from './agentNodeMaterializer'
import {
  readSubgraphDefinitionIds,
  readSubgraphDefinitions
} from './agentSubgraphDefinitions'
import { recordDevEvent } from './devPanelLog'
import type { DocUpdate } from './docFrameClient'
import type { MutationsForTarget } from './ecsFollowerAdapter'
import { EcsFollowerAdapter } from './ecsFollowerAdapter'
import type { FollowerDoc } from './followerDoc'

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

  /**
   * Store-only, and deliberately so: `reconcileLiveGraph` can throw (its
   * orphan sweep reaches extension `onRemoved` hooks), and the caller counts
   * this frame's outcome from the return value. Folding the sweep in here
   * would let a third-party hook leave a frame counted in `received` and in
   * neither `applied` nor `skipped`.
   */
  applyFrame(update: DocUpdate): boolean {
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

  reconcileLiveGraph(workflowId: string): void {
    const graph = this.getGraph()
    if (!graph) return
    const followerDoc = this.getFollowerDoc()
    const definitionIds = readSubgraphDefinitionIds(followerDoc)
    const hasMissingDefinition = definitionIds.some(
      (id) => !graph.rootGraph.subgraphs.has(id)
    )
    const definitions = hasMissingDefinition
      ? readSubgraphDefinitions(followerDoc)
      : []
    const nodeIds = reconcileAgentAdapters(graph, definitions)
    // A frame that only wires or rewires nodes moves no layout, so nothing
    // else asks the canvas to paint the new links.
    graph.setDirtyCanvas(true, true)
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
