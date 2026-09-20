import type * as Y from 'yjs'

import type { RemoteMutationContext } from '@/types/graphMutationContext'
import type { NodeId } from '@/types/nodeId'

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
  /**
   * Workflow whose lineage break arrived before any live graph existed, if
   * any. The graph-ready reconcile that follows is an ordinary one, and its
   * ID-only fast path would see the reused definition ids already registered
   * and keep the outgoing generation's definitions, so the replacement intent
   * has to outlive the missing graph.
   *
   * It stores the workflow id rather than a boolean because the binding can
   * change while no graph exists: a reset for `wf-1` followed by a retarget to
   * `wf-2` must not make `wf-2`'s first reconcile retire `wf-1`'s definitions.
   */
  private pendingDefinitionReplacementFor: string | null = null

  constructor(
    mutations: MutationsForTarget,
    private readonly getGraph: () => MaterializableGraph | null,
    private readonly getFollowerDoc: () => Y.Doc
  ) {
    this.adapter = new EcsFollowerAdapter(mutations)
  }

  bind(workflowId: string, follower: FollowerDoc): void {
    // Retargeting abandons any deferred intent that did not belong to the
    // incoming workflow; leaving it set would hand one document's retirement
    // to another's first reconcile.
    if (this.pendingDefinitionReplacementFor !== workflowId) {
      this.pendingDefinitionReplacementFor = null
    }
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
    this.reconcileLiveGraph(workflowId, true)
    return cleared
  }

  discardPending(workflowId: string): void {
    this.adapter.discardPending(workflowId)
  }

  /**
   * @param replaceSubgraphDefinitions retire the definitions the outgoing
   * generation registered instead of keeping them. Set on a lineage break;
   * deferred to the next call when no graph exists yet.
   * @returns ids that received a new live node on this pass.
   */
  reconcileLiveGraph(
    workflowId: string,
    replaceSubgraphDefinitions = false
  ): NodeId[] {
    const graph = this.getGraph()
    if (!graph) {
      if (replaceSubgraphDefinitions) {
        this.pendingDefinitionReplacementFor = workflowId
      }
      return []
    }
    const replaceDefinitions =
      replaceSubgraphDefinitions ||
      this.pendingDefinitionReplacementFor === workflowId
    this.pendingDefinitionReplacementFor = null
    const followerDoc = this.getFollowerDoc()
    // The ID-only fast path probes the live root graph, which still holds the
    // outgoing generation's definitions at a lineage break — nothing reads as
    // missing there, so a replacement has to take the full read
    // unconditionally or retirement would leave the replacement document with
    // no definitions to register.
    const definitionIds = readSubgraphDefinitionIds(followerDoc)
    const hasMissingDefinition = definitionIds.some(
      (id) => !graph.rootGraph.subgraphs.has(id)
    )
    const definitions =
      replaceDefinitions || hasMissingDefinition
        ? readSubgraphDefinitions(followerDoc)
        : []
    const nodeIds = replaceDefinitions
      ? reconcileAgentAdapters(graph, definitions, {
          replaceSubgraphDefinitions: true
        })
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
