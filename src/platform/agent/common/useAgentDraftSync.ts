/**
 * Agent draft sync (prototype — ADR-0011).
 *
 * Orchestrates the frontend side of agent graph writes: tracks the base
 * `version` per open workflow (the version lifecycle), reconciles incoming
 * `draft_patch` events, drives the three merge-dialog outcomes, and self-heals
 * across dropped Redis Pub/Sub patches and WS reconnects by refetching the
 * authoritative snapshot (BE-1886). The transport stays best-effort; this client
 * provides reliability — `version` is the monotonic watermark.
 *
 * The canvas-facing effects are injected as `ports` so this is decoupled from
 * litegraph / the workflow store and is unit-testable. In the real app the
 * ports map to: `applyToTab` -> a destructive variant of `app.loadGraphData`;
 * `openInNewTab` -> the existing non-destructive load; `discardAgentResult` ->
 * a no-op (keep the user's canvas as-is); `fetchSnapshot` -> a `GET
 * /api/agent/draft?workflow_id=...` decoded with `parseDraftSnapshot`.
 */
import { readonly, ref } from 'vue'

import type {
  DraftPatchEvent,
  DraftSnapshot,
  WorkflowGraph,
  WorkflowId
} from './agentProtocol'
import type { ConflictResolution } from './draftReconciler'
import { reconcileDraftPatch } from './draftReconciler'

export interface AgentDraftPorts {
  applyToTab(
    workflowId: WorkflowId,
    content: WorkflowGraph,
    version: number
  ): void
  openInNewTab(
    workflowId: WorkflowId,
    content: WorkflowGraph,
    version: number
  ): void
  discardAgentResult(workflowId: WorkflowId): void
  fetchSnapshot(workflowId: WorkflowId): Promise<DraftSnapshot>
}

export interface PendingConflict {
  workflowId: WorkflowId
  content: WorkflowGraph
  version: number
  baseVersion: number
}

export type PatchOutcome =
  | 'applied'
  | 'conflict'
  | 'ignored'
  | 'opened-new-tab'
  | 'gap'

/** `restored` = a newer snapshot replaced the tab; `up-to-date` = already current. */
export type ResyncOutcome = 'restored' | 'up-to-date'

export type VersionTipOutcome = 'resyncing' | 'up-to-date' | 'ignored'

export function useAgentDraftSync(ports: AgentDraftPorts) {
  const baseVersions = ref(new Map<WorkflowId, number>())
  const pendingConflict = ref<PendingConflict | null>(null)
  const inFlightResyncs = new Map<WorkflowId, Promise<ResyncOutcome>>()
  const abortedResyncs = new Set<WorkflowId>()

  /** Call when a draft tab opens, adopting its known version. */
  function registerWorkflow(workflowId: WorkflowId, version: number): void {
    baseVersions.value.set(workflowId, version)
  }

  function clearConflictFor(workflowId: WorkflowId): void {
    if (pendingConflict.value?.workflowId === workflowId) {
      pendingConflict.value = null
    }
  }

  function forgetWorkflow(workflowId: WorkflowId): void {
    baseVersions.value.delete(workflowId)
    clearConflictFor(workflowId)
    if (inFlightResyncs.has(workflowId)) abortedResyncs.add(workflowId)
  }

  /** Call after a local autosave returns a new server version. */
  function setVersion(workflowId: WorkflowId, version: number): void {
    baseVersions.value.set(workflowId, version)
  }

  function handlePatch(patch: DraftPatchEvent): PatchOutcome {
    const current = baseVersions.value.get(patch.workflowId)

    // Unknown workflow = no open tab for it (a new-tab write, or a tab the user
    // closed mid-edit — see ADR-0011 open question). Route to a new tab.
    if (current === undefined) {
      ports.openInNewTab(patch.workflowId, patch.content, patch.version)
      baseVersions.value.set(patch.workflowId, patch.version)
      return 'opened-new-tab'
    }

    const result = reconcileDraftPatch(patch, current)
    switch (result.kind) {
      case 'apply':
        ports.applyToTab(patch.workflowId, patch.content, result.version)
        baseVersions.value.set(patch.workflowId, result.version)
        return 'applied'
      case 'conflict':
        pendingConflict.value = {
          workflowId: patch.workflowId,
          content: patch.content,
          version: patch.version,
          baseVersion: patch.baseVersion
        }
        return 'conflict'
      case 'gap':
        scheduleResync(patch.workflowId)
        return 'gap'
      case 'stale':
        return 'ignored'
    }
  }

  async function runResync(workflowId: WorkflowId): Promise<ResyncOutcome> {
    const snapshot = await ports.fetchSnapshot(workflowId)

    // The tab was closed mid-fetch (`forgetWorkflow`). Don't resurrect tracking
    // or apply to a tab that no longer exists — this covers both a tab that was
    // tracked and one still bootstrapping its first snapshot, since either is
    // `undefined` after the close.
    if (abortedResyncs.has(workflowId)) return 'up-to-date'

    const current = baseVersions.value.get(workflowId)
    if (current !== undefined && snapshot.version <= current) {
      return 'up-to-date'
    }
    ports.applyToTab(workflowId, snapshot.content, snapshot.version)
    baseVersions.value.set(workflowId, snapshot.version)
    // The authoritative snapshot supersedes any open merge dialog for this tab;
    // resolving it later would re-apply now-stale content and roll the version
    // back.
    clearConflictFor(workflowId)
    return 'restored'
  }

  /**
   * Fetch the authoritative snapshot and reconcile it against the watermark.
   * Call on WS (re)connect to restore the draft without waiting for a patch.
   * Concurrent calls for the same workflow share one in-flight request.
   * Register-on-demand: a resync for a workflow with no tracked version seeds
   * the tab from the snapshot (bootstrapping), rather than requiring a prior
   * `registerWorkflow`.
   */
  function resync(workflowId: WorkflowId): Promise<ResyncOutcome> {
    const existing = inFlightResyncs.get(workflowId)
    if (existing) return existing
    const run = runResync(workflowId).finally(() => {
      inFlightResyncs.delete(workflowId)
      abortedResyncs.delete(workflowId)
    })
    inFlightResyncs.set(workflowId, run)
    return run
  }

  /**
   * In-flight resync for a workflow, if any (lets callers await self-heal).
   * @internal Test-coordination surface — the returned promise rejects if the
   * underlying `fetchSnapshot` fails, so production call sites should not await
   * it without a `.catch`; the self-heal itself is fire-and-forget via
   * `scheduleResync`.
   */
  function pendingResync(
    workflowId: WorkflowId
  ): Promise<ResyncOutcome> | undefined {
    return inFlightResyncs.get(workflowId)
  }

  /**
   * Fire-and-forget self-heal. A failed refetch is best-effort: it leaves local
   * state intact and is retried by the next patch / reconnect / version tip.
   */
  function scheduleResync(workflowId: WorkflowId): void {
    void resync(workflowId).catch((error: unknown) => {
      console.error('[agent] draft resync failed', workflowId, error)
    })
  }

  /**
   * Consume an optional `draft_version` tip (a content-less version heartbeat).
   * Catches a trailing lost patch: if the server tip outruns our watermark for an
   * open workflow, refetch the snapshot.
   */
  function handleVersionTip(
    workflowId: WorkflowId,
    version: number
  ): VersionTipOutcome {
    const current = baseVersions.value.get(workflowId)
    if (current === undefined) return 'ignored'
    if (version <= current) return 'up-to-date'
    scheduleResync(workflowId)
    return 'resyncing'
  }

  function resolveConflict(decision: ConflictResolution): void {
    const conflict = pendingConflict.value
    if (!conflict) return

    switch (decision) {
      case 'accept-agent':
        ports.applyToTab(
          conflict.workflowId,
          conflict.content,
          conflict.version
        )
        baseVersions.value.set(conflict.workflowId, conflict.version)
        break
      case 'keep-mine':
        ports.discardAgentResult(conflict.workflowId)
        break
      case 'new-tab':
        ports.openInNewTab(
          conflict.workflowId,
          conflict.content,
          conflict.version
        )
        break
    }

    pendingConflict.value = null
  }

  return {
    baseVersions: readonly(baseVersions),
    pendingConflict: readonly(pendingConflict),
    registerWorkflow,
    forgetWorkflow,
    setVersion,
    handlePatch,
    resolveConflict,
    resync,
    pendingResync,
    handleVersionTip
  }
}
