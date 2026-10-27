import { nodesMap } from '@comfyorg/comfy-multi-player'
import type { Op } from '@comfyorg/comfy-multi-player'
import type * as Y from 'yjs'

import type { LGraph } from '@/lib/litegraph/src/litegraph'
import type { NodeId } from '@/types/nodeId'

import { recordDevEvent } from './devPanelLog'
import { DocChangeCollector, groupIds } from './docChangeCollector'
import type { DocUpdate } from './docFrameClient'
import type { FollowerDoc } from './followerDoc'
import type { GraphOperation } from './graphOperations'
import type { ClassifiedDocUpdate } from './layoutFollowerBridge'
import { isLiveAgentUpdate } from './layoutFollowerBridge'
import { LiveGraphApplier, readDocWidgetValue } from './liveGraphApplier'
import type {
  ApplyMode,
  FrameChanges,
  LiveGraphApplierDeps,
  NodeChange,
  RemoteApplyContext
} from './liveGraphApplier'
import { LocalWidgetWrites } from './localWidgetWrites'
import { changesForRejectedOps } from './rejectedOpChanges'

interface BoundTarget {
  follower: FollowerDoc
  collector: DocChangeCollector
  reportedPendingNodes: Map<string, NodeChange>
  failedProjections: FailedProjection[]
}

interface FailedProjection {
  changes: FrameChanges
  context: RemoteApplyContext
  mode: ApplyMode
}

/**
 * Document node entries a projection outcome reports as added and removed.
 * Not necessarily one frame's: `applyCollected` reports a whole collected
 * batch, and the no-graph `applyFrame` path omits entries already reported
 * on an earlier pending frame (`reportedPendingNodes`).
 */
export interface DocNodeDelta {
  added: readonly string[]
  removed: readonly string[]
}

export type FrameOutcome =
  | { applied: false; nodes: DocNodeDelta }
  | {
      applied: true
      nodes: DocNodeDelta
      createdNodeIds: NodeId[]
      failureCount: number
    }

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

function changesAgainstDoc(doc: Y.Doc, changes: FrameChanges): FrameChanges {
  const docNodes = nodesMap(doc)
  const nodes = new Map<string, NodeChange>()
  for (const [id, change] of changes.nodes) {
    if (!docNodes.has(id)) nodes.set(id, 'delete')
    else nodes.set(id, change === 'delete' ? 'update' : change)
  }
  const docGroups = groupIds(doc.getMap('meta').get('groups'))
  const removedGroups = new Set(
    [...(changes.removedGroups ?? [])].filter((id) => !docGroups.has(id))
  )
  return { ...changes, nodes, removedGroups }
}

function pendingNodeDelta(target: BoundTarget, changes: FrameChanges) {
  const frameNodes = new Map(
    [...changes.nodes].filter(
      ([id, change]) => target.reportedPendingNodes.get(id) !== change
    )
  )
  target.reportedPendingNodes = new Map(changes.nodes)
  return docNodeDelta({ ...changes, nodes: frameNodes })
}

/**
 * Projects a follower document onto the live graph through the graph API.
 * One collector per bound workflow records what each delivered frame changed;
 * the applier replays those changes as ordinary graph operations.
 */
export class AgentCrdtProjection {
  private readonly targets = new Map<string, BoundTarget>()
  private readonly replacedLineages = new Set<string>()
  private readonly localWrites = new LocalWidgetWrites()
  private readonly applier: LiveGraphApplier

  constructor(
    private readonly getGraph: () => LGraph | null,
    deps: Omit<LiveGraphApplierDeps, 'getGraph' | 'holdsLocalWrite'> = {}
  ) {
    this.applier = new LiveGraphApplier({
      ...deps,
      getGraph,
      holdsLocalWrite: (nodeId, widget, docValue) => {
        const held = this.localWrites.holds(nodeId, widget, docValue)
        if (held) {
          recordDevEvent('local_widget_write_held', {
            node_id: nodeId,
            name: widget
          })
        }
        return held
      }
    })
  }

  /**
   * Local edits on their way to the host. A frame's value for one of these
   * registers is held back until the document holds the local value; see
   * `LocalWidgetWrites`.
   */
  noteLocalWrites(operations: readonly GraphOperation[]): void {
    this.localWrites.note(operations)
  }

  /** The host has answered for these ops, or they will never reach it. */
  settleLocalWrites(operations: readonly GraphOperation[]): void {
    this.localWrites.settle(operations)
  }

  /** Binding the same follower again keeps its collected, unapplied changes. */
  bind(workflowId: string, follower: FollowerDoc): void {
    if (this.targets.get(workflowId)?.follower === follower) return
    this.unbind(workflowId)
    this.targets.set(workflowId, {
      follower,
      collector: new DocChangeCollector(follower.doc),
      reportedPendingNodes: new Map(),
      failedProjections: []
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
  applyFrame(
    update: DocUpdate & Partial<Pick<ClassifiedDocUpdate, 'catchUp'>>
  ): FrameOutcome {
    const target = this.targets.get(update.workflowId)
    if (!target) return { applied: false, nodes: EMPTY_DELTA }
    if (!this.getGraph()) {
      const changes = target.collector.peek()
      return { applied: false, nodes: pendingNodeDelta(target, changes) }
    }
    const changes = target.collector.take()
    target.reportedPendingNodes.clear()
    return this.apply(
      update.workflowId,
      target,
      changes,
      {
        actor: update.actor ?? 'agent-remote',
        opIds: update.opIds?.filter((id) => id.length > 0) ?? [],
        liveAgentTurn: isLiveAgentUpdate(update)
      },
      this.takeApplyMode(update.workflowId)
    )
  }

  /**
   * Applies the changes collected while no graph could take them: frames
   * delivered before the graph loaded, or while its tab was inactive.
   * @returns the apply result for the whole collected batch.
   */
  applyCollected(workflowId: string): FrameOutcome {
    const target = this.targets.get(workflowId)
    if (!target || !this.getGraph())
      return { applied: false, nodes: EMPTY_DELTA }
    target.reportedPendingNodes.clear()
    return this.apply(
      workflowId,
      target,
      target.collector.take(),
      { actor: 'agent-collected', opIds: [] },
      this.takeApplyMode(workflowId)
    )
  }

  /** Replays failed frames oldest first until one fails again. */
  retryFailed(workflowId: string): {
    applied: true
    createdNodeIds: NodeId[]
    failureCount: number
  } | null {
    const target = this.targets.get(workflowId)
    if (!target || target.failedProjections.length === 0 || !this.getGraph())
      return null
    const createdNodeIds: NodeId[] = []
    while (target.failedProjections.length > 0) {
      const failed = target.failedProjections[0]
      const outcome = this.project(
        workflowId,
        target,
        changesAgainstDoc(target.follower.doc, failed.changes),
        failed.context,
        failed.mode
      )
      createdNodeIds.push(...outcome.createdNodeIds)
      if (outcome.failureCount > 0)
        return {
          applied: true,
          createdNodeIds,
          failureCount: outcome.failureCount
        }
      target.failedProjections.shift()
    }
    return { applied: true, createdNodeIds, failureCount: 0 }
  }

  hasPendingFailure(workflowId: string): boolean {
    return (this.targets.get(workflowId)?.failedProjections.length ?? 0) > 0
  }

  /**
   * Puts the registers a rejected human batch claimed back the way the
   * document has them. Only those registers are touched: the rejection says
   * nothing about the rest of the live graph.
   * @returns the apply result for the rejected operations.
   */
  revertRejected(workflowId: string, ops: readonly Op[]): FrameOutcome {
    const target = this.targets.get(workflowId)
    if (!target || ops.length === 0 || !this.getGraph())
      return { applied: false, nodes: EMPTY_DELTA }
    return this.apply(
      workflowId,
      target,
      changesForRejectedOps(target.follower.doc, ops),
      {
        actor: 'agent:revert',
        opIds: ops.map((op) => op.op_id)
      }
    )
  }

  /**
   * Explicit lineage reset (`doc_reset`): the old lineage's undelivered
   * changes are dropped and the new lineage's first frame, which carries its
   * whole state, replaces the graph. Nothing is cleared before that frame
   * arrives, so a first mint of the canvas the user already sees changes
   * nothing visible.
   */
  replaceOnNextFrame(workflowId: string): void {
    const target = this.targets.get(workflowId)
    target?.collector.discard()
    target?.reportedPendingNodes.clear()
    if (target) target.failedProjections.length = 0
    this.replacedLineages.add(workflowId)
    this.localWrites.clear()
  }

  private takeApplyMode(workflowId: string): ApplyMode {
    return this.replacedLineages.delete(workflowId) ? 'replace' : 'merge'
  }

  /**
   * Drops a frame the graph already holds, reporting what it changed in the
   * document. Such a frame is where the document catches up on local writes,
   * so their holds are settled against it.
   */
  discardPending(workflowId: string): DocNodeDelta {
    const target = this.targets.get(workflowId)
    if (!target) return EMPTY_DELTA
    const changes = target.collector.take()
    target.reportedPendingNodes.clear()
    this.localWrites.settleAgainst((nodeId, widget) =>
      readDocWidgetValue(target.follower.doc, nodeId, widget)
    )
    return docNodeDelta(changes)
  }

  destroy(): void {
    for (const workflowId of Array.from(this.targets.keys()))
      this.unbind(workflowId)
    this.replacedLineages.clear()
    this.localWrites.clear()
  }

  private apply(
    workflowId: string,
    target: BoundTarget,
    changes: FrameChanges,
    context: RemoteApplyContext,
    mode: ApplyMode = 'merge'
  ): Extract<FrameOutcome, { applied: true }> {
    const outcome = this.project(workflowId, target, changes, context, mode)
    if (outcome.failureCount > 0)
      target.failedProjections.push({ changes, context, mode })
    return outcome
  }

  private project(
    workflowId: string,
    target: BoundTarget,
    changes: FrameChanges,
    context: RemoteApplyContext,
    mode: ApplyMode
  ): Extract<FrameOutcome, { applied: true }> {
    const { createdNodeIds, failureCount } = this.applier.applyChanges(
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
    return {
      applied: true,
      nodes: docNodeDelta(changes),
      createdNodeIds,
      failureCount
    }
  }
}
