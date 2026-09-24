import type { LGraph } from '@/lib/litegraph/src/litegraph'
import type { NodeId } from '@/types/nodeId'

import { recordDevEvent } from './devPanelLog'
import { DocChangeCollector } from './docChangeCollector'
import type { DocUpdate } from './docFrameClient'
import type { FollowerDoc } from './followerDoc'
import { LiveGraphApplier } from './liveGraphApplier'
import type {
  LiveGraphApplierDeps,
  RemoteApplyContext
} from './liveGraphApplier'
import type { PendingLocalEdits } from './pendingLocalEdits'
import { NO_PENDING_LOCAL_EDITS } from './pendingLocalEdits'

interface BoundTarget {
  follower: FollowerDoc
  collector: DocChangeCollector
}

export interface LocalIntent {
  /** The local human's edits the document has not yet reflected. */
  pendingEdits(workflowId: string): PendingLocalEdits
}

const NO_LOCAL_INTENT: LocalIntent = {
  pendingEdits: () => NO_PENDING_LOCAL_EDITS
}

/**
 * Projects a follower document onto the live graph through the graph API.
 * One collector per bound workflow records what each delivered frame changed;
 * the applier replays those changes as ordinary graph operations.
 */
export class AgentCrdtProjection {
  private readonly targets = new Map<string, BoundTarget>()
  private readonly applier: LiveGraphApplier

  constructor(
    private readonly getGraph: () => LGraph | null,
    deps: Omit<LiveGraphApplierDeps, 'getGraph'> = {},
    private readonly intent: LocalIntent = NO_LOCAL_INTENT
  ) {
    this.applier = new LiveGraphApplier({ ...deps, getGraph })
  }

  bind(workflowId: string, follower: FollowerDoc): void {
    this.unbind(workflowId)
    this.targets.set(workflowId, {
      follower,
      collector: new DocChangeCollector(follower.doc)
    })
  }

  unbind(workflowId: string): void {
    const target = this.targets.get(workflowId)
    if (!target) return
    target.collector.destroy()
    this.targets.delete(workflowId)
  }

  /**
   * Applies one delivered frame's changes to the live graph. Without a graph
   * the changes stay collected for the sync that runs once one appears.
   * @returns ids of nodes the frame created live, or `null` when the frame
   * addressed a workflow this projection is not bound to or found no graph.
   */
  applyFrame(update: DocUpdate): NodeId[] | null {
    const target = this.targets.get(update.workflowId)
    if (!target || !this.getGraph()) return null
    const changes = target.collector.take()
    const { createdNodeIds } = this.applier.applyChanges(
      target.follower.doc,
      changes,
      frameContext(update)
    )
    this.reportMaterialized(update.workflowId, createdNodeIds)
    return createdNodeIds
  }

  /**
   * Brings the live graph up to the bound document in full: used when the
   * graph appears after frames were already delivered, or the tab returns to
   * the followed workflow.
   * @returns ids of nodes created live on this pass.
   */
  syncFromDoc(workflowId: string): NodeId[] {
    const target = this.targets.get(workflowId)
    if (!target || !this.getGraph()) return []
    target.collector.discard()
    const { createdNodeIds } = this.applier.syncFromDoc(
      target.follower.doc,
      { actor: 'agent-sync', opIds: [] },
      this.intent.pendingEdits(workflowId)
    )
    this.reportMaterialized(workflowId, createdNodeIds)
    return createdNodeIds
  }

  /** Explicit lineage reset only: the document was replaced, so is the graph. */
  clearForReset(workflowId: string, context: RemoteApplyContext): void {
    this.targets.get(workflowId)?.collector.discard()
    this.applier.clear(context)
  }

  discardPending(workflowId: string): void {
    this.targets.get(workflowId)?.collector.discard()
  }

  destroy(): void {
    for (const workflowId of Array.from(this.targets.keys()))
      this.unbind(workflowId)
  }

  private reportMaterialized(
    workflowId: string,
    nodeIds: readonly NodeId[]
  ): void {
    if (nodeIds.length === 0) return
    recordDevEvent('agent_node_adapters_materialized', { workflowId, nodeIds })
  }
}

function frameContext(update: DocUpdate): RemoteApplyContext {
  return {
    actor: update.actor ?? 'agent-remote',
    opIds: update.opIds?.filter((id) => id.length > 0) ?? []
  }
}
