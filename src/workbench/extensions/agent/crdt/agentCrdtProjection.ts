import type { Op } from '@comfyorg/comfy-multi-player'

import type { LGraph } from '@/lib/litegraph/src/litegraph'
import type { NodeId } from '@/types/nodeId'

import { recordDevEvent } from './devPanelLog'
import { DocChangeCollector } from './docChangeCollector'
import type { DocUpdate } from './docFrameClient'
import type { FollowerDoc } from './followerDoc'
import { LiveGraphApplier } from './liveGraphApplier'
import type {
  ApplyMode,
  FrameChanges,
  LiveGraphApplierDeps,
  RemoteApplyContext
} from './liveGraphApplier'
import { changesForRejectedOps } from './rejectedOpChanges'

interface BoundTarget {
  follower: FollowerDoc
  collector: DocChangeCollector
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
  private readonly replacedLineages = new Set<string>()
  private readonly applier: LiveGraphApplier

  constructor(
    private readonly getGraph: () => LGraph | null,
    deps: Omit<LiveGraphApplierDeps, 'getGraph'> = {}
  ) {
    this.applier = new LiveGraphApplier({ ...deps, getGraph })
  }

  /** Binding the same follower again keeps its collected, unapplied changes. */
  bind(workflowId: string, follower: FollowerDoc): void {
    if (this.targets.get(workflowId)?.follower === follower) return
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
   * the changes stay collected for `applyCollected` once one appears.
   */
  applyFrame(update: DocUpdate): FrameOutcome {
    const target = this.targets.get(update.workflowId)
    if (!target) return { applied: false, nodes: EMPTY_DELTA }
    if (!this.getGraph())
      return { applied: false, nodes: docNodeDelta(target.collector.peek()) }
    const changes = target.collector.take()
    const createdNodeIds = this.apply(
      update.workflowId,
      target,
      changes,
      {
        actor: update.actor ?? 'agent-remote',
        opIds: update.opIds?.filter((id) => id.length > 0) ?? []
      },
      this.takeApplyMode(update.workflowId)
    )
    return { applied: true, nodes: docNodeDelta(changes), createdNodeIds }
  }

  /**
   * Applies the changes collected while no graph could take them: frames
   * delivered before the graph loaded, or while its tab was inactive.
   * @returns ids of nodes created live on this pass.
   */
  applyCollected(workflowId: string): NodeId[] {
    const target = this.targets.get(workflowId)
    if (!target || !this.getGraph()) return []
    return this.apply(
      workflowId,
      target,
      target.collector.take(),
      { actor: 'agent-collected', opIds: [] },
      this.takeApplyMode(workflowId)
    )
  }

  /**
   * Puts the registers a rejected human batch claimed back the way the
   * document has them. Only those registers are touched: the rejection says
   * nothing about the rest of the live graph.
   * @returns ids of nodes created live on this pass.
   */
  revertRejected(workflowId: string, ops: readonly Op[]): NodeId[] {
    const target = this.targets.get(workflowId)
    if (!target || ops.length === 0 || !this.getGraph()) return []
    const changes = changesForRejectedOps(target.follower.doc, ops)
    return this.apply(workflowId, target, changes, {
      actor: 'agent-revert',
      opIds: ops.map((op) => op.op_id)
    })
  }

  /**
   * Explicit lineage reset (`doc_reset`): the old lineage's undelivered
   * changes are dropped and the new lineage's first frame, which carries its
   * whole state, replaces the graph. Nothing is cleared before that frame
   * arrives, so a first mint of the canvas the user already sees changes
   * nothing visible.
   */
  replaceOnNextFrame(workflowId: string): void {
    this.targets.get(workflowId)?.collector.discard()
    this.replacedLineages.add(workflowId)
  }

  private takeApplyMode(workflowId: string): ApplyMode {
    return this.replacedLineages.delete(workflowId) ? 'replace' : 'merge'
  }

  /** Drops a frame the graph already holds, reporting what it changed in the document. */
  discardPending(workflowId: string): DocNodeDelta {
    const target = this.targets.get(workflowId)
    return target ? docNodeDelta(target.collector.take()) : EMPTY_DELTA
  }

  destroy(): void {
    for (const workflowId of Array.from(this.targets.keys()))
      this.unbind(workflowId)
    this.replacedLineages.clear()
  }

  private apply(
    workflowId: string,
    target: BoundTarget,
    changes: FrameChanges,
    context: RemoteApplyContext,
    mode: ApplyMode = 'merge'
  ): NodeId[] {
    const { createdNodeIds } = this.applier.applyChanges(
      target.follower.doc,
      changes,
      context,
      mode
    )
    if (createdNodeIds.length > 0) {
      recordDevEvent('agent_node_adapters_materialized', {
        workflowId,
        nodeIds: createdNodeIds
      })
    }
    return createdNodeIds
  }
}
