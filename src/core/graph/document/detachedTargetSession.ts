import * as Y from 'yjs'

import { assert } from '@/base/assert'
import { createUuidv4 } from '@/utils/uuid'

/**
 * One ordered effect frame addressed to a target document. Structurally
 * compatible with the workbench `DocUpdate` wire frame; declared here so the
 * core document seam never imports workbench transport types.
 */
export interface TargetFrame {
  readonly workflowId: string
  readonly seq: number
  readonly update: Uint8Array
  readonly actor?: string
  /** Accepted semantic op identities folded into this effect frame (DQ-9). */
  readonly opIds?: readonly string[]
}

/**
 * Projects one staged frame into the domain stores. `apply` receives the
 * staged document with the frame already folded in; it must be all-or-nothing
 * and report whether the projection committed. A `false` return (or a throw)
 * leaves the frame queued and the session's committed tuple untouched.
 */
export interface TargetFrameApplyPort {
  apply(frame: TargetFrame, stagedDoc: Y.Doc): boolean
}

export type EnqueueResult =
  | { status: 'queued'; queuedFrames: number }
  /** `seq` at or below the last accepted frame — replay, skipped. */
  | { status: 'duplicate'; seq: number }
  /** Non-contiguous `seq`; queue discarded, resync required. */
  | { status: 'gap'; expectedSeq: number; receivedSeq: number }
  /** Queue bound exceeded; queue discarded, resync required. */
  | { status: 'overflow'; discardedFrames: number }
  | { status: 'resync-required' }
  /** Frame addressed to another target; never queued, in every build. */
  | { status: 'rejected'; reason: 'cross-target' }

export type CommitResult =
  | { status: 'idle' }
  | { status: 'resync-required' }
  | { status: 'committed'; commitId: string; seq: number }
  | { status: 'failed'; seq: number; error?: unknown }

export interface DetachedTargetSessionSnapshot {
  readonly workflowId: string
  readonly lineage: string
  readonly committedSeq: number | null
  readonly revision: number
  readonly queuedFrames: number
  readonly needsResync: boolean
  readonly lastCommitId: string | null
}

export interface DetachedTargetSessionOptions {
  /** Upper bound on staged-but-uncommitted frames. */
  readonly maxQueuedFrames?: number
  readonly initialLineage?: string
}

const DEFAULT_MAX_QUEUED_FRAMES = 64

/**
 * Staged frame queue for a target document that is not attached to a live
 * follower (ADR-0024's unloaded-target path). Frames enqueue in wire order
 * and commit one at a time: each commit folds the head frame into a clone of
 * the last committed Yjs state, offers it to the projection port, and only
 * on success publishes the new committed tuple
 * `{revision, sequence, stateVector, lineage, lastCommitId}` and dequeues.
 *
 * The last committed state vector is the recovery anchor: on queue overflow
 * or a sequence gap the queued frames are discarded but the committed state
 * survives, so the host can be asked for exactly the missing diff
 * (`recoveryStateVector`). A `doc_reset` starts a new lineage with a fresh
 * document; commit identities (`lineage:seq`) from the old lineage never
 * collide with the new one.
 */
export function createDetachedTargetSession(
  workflowId: string,
  options: DetachedTargetSessionOptions = {}
) {
  const maxQueuedFrames = options.maxQueuedFrames ?? DEFAULT_MAX_QUEUED_FRAMES

  let lineage = options.initialLineage ?? createUuidv4()
  let committedDoc = new Y.Doc()
  let committedSeq: number | null = null
  let revision = 0
  let lastCommitId: string | null = null
  let needsResync = false
  /** `null` accepts any sequence (fresh session or just resynced). */
  let expectedSeq: number | null = null
  let queue: TargetFrame[] = []

  /**
   * Loud in DEV (throws), reported in production, and fail-closed in both:
   * `assert` returns in non-DEV builds, so callers must still honour `false`.
   */
  function isOwnTarget(frameWorkflowId: string): boolean {
    const matches = frameWorkflowId === workflowId
    assert(
      matches,
      'DetachedTargetSession: frame addressed to another target; frames must never cross targets'
    )
    return matches
  }

  function enqueue(frame: TargetFrame): EnqueueResult {
    if (!isOwnTarget(frame.workflowId))
      return { status: 'rejected', reason: 'cross-target' }
    if (needsResync) return { status: 'resync-required' }

    const lastAcceptedSeq = queue.at(-1)?.seq ?? committedSeq
    if (lastAcceptedSeq !== null && frame.seq <= lastAcceptedSeq)
      return { status: 'duplicate', seq: frame.seq }

    if (expectedSeq !== null && frame.seq !== expectedSeq) {
      const gapAt = expectedSeq
      queue = []
      needsResync = true
      return { status: 'gap', expectedSeq: gapAt, receivedSeq: frame.seq }
    }

    if (queue.length >= maxQueuedFrames) {
      const discardedFrames = queue.length
      queue = []
      needsResync = true
      return { status: 'overflow', discardedFrames }
    }

    queue.push(frame)
    expectedSeq = frame.seq + 1
    return { status: 'queued', queuedFrames: queue.length }
  }

  function commitNext(port: TargetFrameApplyPort): CommitResult {
    if (needsResync) return { status: 'resync-required' }
    const frame = queue[0]
    if (!frame) return { status: 'idle' }

    const staged = new Y.Doc()
    Y.applyUpdate(staged, Y.encodeStateAsUpdate(committedDoc))
    Y.applyUpdate(staged, frame.update)

    let applied: boolean
    try {
      applied = port.apply(frame, staged)
    } catch (error) {
      staged.destroy()
      return { status: 'failed', seq: frame.seq, error }
    }
    if (!applied) {
      staged.destroy()
      return { status: 'failed', seq: frame.seq }
    }

    committedDoc.destroy()
    committedDoc = staged
    committedSeq = frame.seq
    revision += 1
    lastCommitId = `${lineage}:${frame.seq}`
    queue.shift()
    return { status: 'committed', commitId: lastCommitId, seq: frame.seq }
  }

  function drainAll(port: TargetFrameApplyPort): {
    committed: number
    stoppedBy: CommitResult
  } {
    let committed = 0
    for (;;) {
      const result = commitNext(port)
      if (result.status !== 'committed') return { committed, stoppedBy: result }
      committed += 1
    }
  }

  /**
   * State vector of the last committed document state — what the host must
   * diff against to replay everything this session is missing.
   */
  function recoveryStateVector(): Uint8Array {
    return Y.encodeStateVector(committedDoc)
  }

  /** Committed Yjs state, byte-exact, for hydration into a live follower. */
  function encodeCommittedState(): Uint8Array {
    return Y.encodeStateAsUpdate(committedDoc)
  }

  /**
   * The host has replayed the missing diff onto the committed state (or will
   * send a full catch-up next); accept the next frame at any sequence.
   */
  function beginResync(): void {
    needsResync = false
    queue = []
    expectedSeq = null
  }

  /**
   * `doc_reset`: the host re-minted the document, so prior updates do not
   * compose with what follows. Starts a fresh document and lineage; queued
   * frames from the old lineage are meaningless and dropped.
   */
  function resetLineage(atSeq: number): void {
    committedDoc.destroy()
    committedDoc = new Y.Doc()
    lineage = createUuidv4()
    committedSeq = atSeq
    expectedSeq = null
    lastCommitId = null
    needsResync = false
    queue = []
  }

  function isCommitted(commitId: string): boolean {
    const separator = commitId.lastIndexOf(':')
    if (separator < 0) return false
    const commitLineage = commitId.slice(0, separator)
    const seq = Number(commitId.slice(separator + 1))
    if (!Number.isInteger(seq)) return false
    return (
      commitLineage === lineage && committedSeq !== null && seq <= committedSeq
    )
  }

  function snapshot(): DetachedTargetSessionSnapshot {
    return {
      workflowId,
      lineage,
      committedSeq,
      revision,
      queuedFrames: queue.length,
      needsResync,
      lastCommitId
    }
  }

  function destroy(): void {
    committedDoc.destroy()
    queue = []
  }

  return {
    enqueue,
    commitNext,
    drainAll,
    recoveryStateVector,
    encodeCommittedState,
    beginResync,
    resetLineage,
    isCommitted,
    snapshot,
    destroy
  }
}

export type DetachedTargetSession = ReturnType<
  typeof createDetachedTargetSession
>
