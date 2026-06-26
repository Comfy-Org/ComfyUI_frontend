/**
 * Agent draft sync (prototype — ADR-0011).
 *
 * Orchestrates the frontend side of agent graph writes: tracks the base
 * `version` per open workflow (the version lifecycle), reconciles incoming
 * `draft_patch` events, and drives the three merge-dialog outcomes.
 *
 * The canvas-facing effects are injected as `ports` so this is decoupled from
 * litegraph / the workflow store and is unit-testable. In the real app the
 * ports map to: `applyToTab` -> a destructive variant of `app.loadGraphData`;
 * `openInNewTab` -> the existing non-destructive load; `discardAgentResult` ->
 * a no-op (keep the user's canvas as-is).
 */
import { readonly, ref } from 'vue'

import type {
  DraftPatchEvent,
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
}

export interface PendingConflict {
  workflowId: WorkflowId
  content: WorkflowGraph
  version: number
  baseVersion: number
}

export type PatchOutcome = 'applied' | 'conflict' | 'ignored' | 'opened-new-tab'

export function useAgentDraftSync(ports: AgentDraftPorts) {
  const baseVersions = ref(new Map<WorkflowId, number>())
  const pendingConflict = ref<PendingConflict | null>(null)

  /** Call when a draft tab opens, adopting its known version. */
  function registerWorkflow(workflowId: WorkflowId, version: number): void {
    baseVersions.value.set(workflowId, version)
  }

  function forgetWorkflow(workflowId: WorkflowId): void {
    baseVersions.value.delete(workflowId)
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
      case 'stale':
        return 'ignored'
    }
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
    resolveConflict
  }
}
