import type { LGraph } from '@/lib/litegraph/src/litegraph'
import type { NodeId } from '@/types/nodeId'

import { recordDevEvent } from './devPanelLog'
import { DocChangeCollector } from './docChangeCollector'
import type { DocUpdate } from './docFrameClient'
import type { FollowerDoc } from './followerDoc'
import { LiveGraphApplier } from './liveGraphApplier'
import type {
  FrameChanges,
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

/** Document node entries one frame added and removed. */
export interface DocNodeDelta {
  added: readonly string[]
  removed: readonly string[]
}

export type FrameOutcome =
  | { applied: false; nodes: DocNodeDelta }
  | { applied: true; nodes: DocNodeDelta; createdNodeIds: NodeId[] }

const EMPTY_DELTA: DocNodeDelta = { added: [], removed: [] }

function docNodeDelta(changes: FrameChanges): DocNodeDelta {
  const added: string[] = []
  const removed: string[] = []
  for (const [id, change] of changes.nodes) {
    if (change === 'add') added.push(id)
    else if (change === 'delete') removed.push(id)
  }
  return { added, removed }
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
   * the frame is only consumed: `syncFromDoc` rebuilds from the whole document
   * once one appears, so nothing is lost by taking the changes now.
   */
  applyFrame(update: DocUpdate): FrameOutcome {
    const target = this.targets.get(update.workflowId)
    if (!target) return { applied: false, nodes: EMPTY_DELTA }
    const changes = target.collector.take()
    const nodes = docNodeDelta(changes)
    if (!this.getGraph()) return { applied: false, nodes }
    const { createdNodeIds } = this.applier.applyChanges(
      target.follower.doc,
      changes,
      frameContext(update)
    )
    this.reportMaterialized(update.workflowId, createdNodeIds)
    return { applied: true, nodes, createdNodeIds }
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

  /** Drops a frame the graph already holds, reporting what it changed in the document. */
  discardPending(workflowId: string): DocNodeDelta {
    const target = this.targets.get(workflowId)
    return target ? docNodeDelta(target.collector.take()) : EMPTY_DELTA
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
