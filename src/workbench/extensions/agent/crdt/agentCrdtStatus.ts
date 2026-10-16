/**
 * s5-metrics-1: per-outcome counters for every `doc_update` the composable's
 * listeners observe, replacing the single overloaded `updatesApplied`
 * observable. Each counter increments exactly once, at the boundary where
 * that outcome is decided — never inferred after the fact. `received` counts
 * only frames the bridge re-dispatched as `doc_update`, so
 * `received === applied + skipped` always holds; `errored`, `gap` and
 * `dropped` are disjoint from it because the bridge returns before
 * re-dispatching in each of those cases (schema gate, FEB-2 seq jump,
 * stale/duplicate discard). Frames the bridge drops for a workflowId other
 * than its `sentWorkflowId` emit no event and are not counted anywhere.
 * `applied` is tracked independently of `bridge.follower.updatesApplied`
 * (which counts Yjs merges, including frames this composable skips) so a
 * divergence between the two is visible instead of hidden behind one number.
 * No payload bodies or actor identifiers are recorded here — see
 * `recordDevEvent` call sites for the (dev-only) frame detail surface.
 */
export interface AgentCrdtOutcomeCounters {
  /** Every `doc_update` event the composable's listener was invoked with. */
  received: number
  /** Passed this composable's own filter and the adapter had a bound session to apply it to. */
  applied: number
  /**
   * PM-1575: same as `applied`, excluding a subscribe's own catch-up frame
   * (`update.catchUp`) -- the one-time state-vector sync that lands whenever
   * a workflow is (re)subscribed to, unrelated to any in-flight tool call.
   * `applied` alone is unusable as a canvas-sync gate for that reason: a tool
   * call's baseline, captured before that catch-up lands, would otherwise
   * read the catch-up itself as "the matching update already arrived" for
   * whichever tool call happens to be first after a (re)subscribe. Consumers
   * that need "did a LIVE update land" (agentEventTransport.ts's canvas-sync
   * baseline) must read this field, not `applied`.
   */
  appliedLive: number
  /** Received but not applied: inactive target, workflow mismatch, or no bound adapter session. */
  skipped: number
  /** The merged doc failed the KA-11 read gate (`schema_error`). */
  errored: number
  /** A seq jump was detected upstream; the frame was withheld and a resubscribe forced (`doc_gap`). */
  gap: number
  /** An explicit lineage break (`doc_reset`). */
  reset: number
  /** A stale/duplicate frame the bridge discarded before it became a `doc_update` event (`doc_stale`). */
  dropped: number
}

export interface AgentCrdtStatus {
  enabled: boolean
  connected: boolean
  workflowId: string | null
  /**
   * Mirror of `bridge.follower.updatesApplied` (Yjs merges, reset to 0 on
   * `doc_reset` / `follower_replaced`). Not interchangeable with
   * `outcomes.applied`, which is monotonic and counts only frames that passed
   * this composable's filter. Kept for AgentPanelRoot.vue and CrdtDevPanel.vue.
   */
  updatesApplied: number
  lastFrameType: string | null
  outcomes: AgentCrdtOutcomeCounters
}
