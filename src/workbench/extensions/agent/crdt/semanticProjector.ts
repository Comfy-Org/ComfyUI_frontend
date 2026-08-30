/**
 * Projects the follower's semantic doc onto the canvas by diffing successive
 * snapshots and applying the delta through a {@link GraphMutator} (ADR-009).
 *
 * Snapshot-diff (rather than Yjs event observation) is a deliberate POC choice:
 * O(doc) per applied update, but pure, deterministic, and fully testable. The
 * first `project` after a (re)subscribe diffs against the empty snapshot, so the
 * initial seed is materialized as `add_node`s and reconnect replays cleanly.
 */
import type * as Y from 'yjs'

import { reportError } from '@/platform/telemetry/reportError'

import { diffSnapshots } from './diffSnapshots'
import type { DocSnapshot } from './docSchema'
import { EMPTY_SNAPSHOT, readDocSnapshot } from './docSchema'
import type { GraphMutator } from './graphMutations'

export interface SemanticProjectorOptions {
  /** Actor id stamped on emitted batches; the follower is a single remote actor. */
  actor?: string
}

export class SemanticProjector {
  private snapshot: DocSnapshot = EMPTY_SNAPSHOT

  constructor(
    private readonly mutator: GraphMutator,
    private readonly options: SemanticProjectorOptions = {}
  ) {}

  /**
   * Diff the doc against the last projected snapshot and apply the delta.
   * Returns the number of mutations applied (0 when the doc is unchanged).
   */
  project(doc: Y.Doc): number {
    const next = readDocSnapshot(doc)
    const mutations = diffSnapshots(this.snapshot, next)
    if (mutations.length === 0) {
      this.snapshot = next
      return 0
    }
    // Commit the snapshot only after the batch finishes: if a mutation throws
    // partway, the snapshot still describes the pre-batch canvas, so the next
    // `project` re-derives the remaining delta instead of diffing an
    // unchanged document to zero mutations and stranding the canvas.
    try {
      this.mutator.applyBatch({
        source: 'agent-remote',
        actor: this.options.actor ?? 'agent',
        mutations
      })
    } catch (error) {
      reportError(error, {
        errorType: 'agent_crdt_semantic_projection_failure'
      })
      throw error
    }
    this.snapshot = next
    return mutations.length
  }

  /** Forget the projected snapshot so the next `project` re-materializes the seed. */
  reset(): void {
    this.snapshot = EMPTY_SNAPSHOT
  }
}
