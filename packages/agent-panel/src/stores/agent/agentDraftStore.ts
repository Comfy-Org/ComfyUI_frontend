import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import type {
  AgentDraftSnapshot,
  DraftPatchData,
  DraftVersionData
} from '@/schemas/agentApiSchema'

export type HeartbeatState = 'in-sync' | 'behind' | 'foreign'

/**
 * The panel-side mirror of the server-owned workflow draft: the bound workflow, the
 * latest full graph content, and its version. Pure data - the session root owns
 * fetching (GET /api/agent/draft) and canvas application; this store only adopts and
 * gates. Monotonic version adoption is the sole ordering rule.
 */
export const useAgentDraftStore = defineStore('agentDraft', () => {
  const workflowId = ref<string | null>(null)
  const content = ref<Record<string, unknown> | null>(null)
  const version = ref<number | null>(null)

  const hasDraft = computed(() => content.value !== null)

  // Bind the store to a workflow. Switching workflows clears content/version so a
  // prior workflow's draft can never bleed into the newly bound one.
  function bind(id: string): void {
    if (id === workflowId.value) return
    workflowId.value = id
    content.value = null
    version.value = null
  }

  // Adopt {content, version} from a draft_patch, returning whether it was adopted.
  // draft_patch.content is the FULL graph snapshot at that version (live-verified),
  // NOT a diff - so a base_version gap does not force a mid-stream refetch; monotonic
  // adoption is sufficient, and reconnect/heartbeat resync covers missed-while-offline
  // versions. Foreign-workflow, unbound, stale, and duplicate patches are ignored.
  function applyPatch(data: DraftPatchData): boolean {
    if (data.workflow_id !== workflowId.value) return false
    if (version.value !== null && data.version <= version.value) return false
    content.value = data.content
    version.value = data.version
    return true
  }

  // Compare a draft_version heartbeat against local state. 'foreign' when unbound or
  // the workflow mismatches; 'behind' when we have no version yet or trail the server
  // (the session root reacts by refetching GET /api/agent/draft); else 'in-sync'.
  function checkHeartbeat(data: DraftVersionData): HeartbeatState {
    if (data.workflow_id !== workflowId.value) return 'foreign'
    if (version.value === null || version.value < data.version) return 'behind'
    return 'in-sync'
  }

  // Adopt the authoritative GET /api/agent/draft result. Adopt whenever we have no
  // version yet or the snapshot is at least as new (equal-version re-adopt is a
  // harmless idempotent refresh); an older snapshot is ignored.
  function adoptSnapshot(snapshot: AgentDraftSnapshot): void {
    if (version.value !== null && snapshot.version < version.value) return
    content.value = snapshot.content
    version.value = snapshot.version
  }

  function reset(): void {
    workflowId.value = null
    content.value = null
    version.value = null
  }

  return {
    workflowId,
    content,
    version,
    hasDraft,
    bind,
    applyPatch,
    checkHeartbeat,
    adoptSnapshot,
    reset
  }
})
