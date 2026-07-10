import { defineStore } from 'pinia'
import { ref } from 'vue'

import type {
  AgentDraftSnapshot,
  DraftPatchData,
  DraftVersionData
} from '../../schemas/agentApiSchema'

export type HeartbeatState = 'in-sync' | 'behind' | 'foreign'

export const useAgentDraftStore = defineStore('agentDraft', () => {
  const workflowId = ref<string | null>(null)
  const content = ref<Record<string, unknown> | null>(null)
  const version = ref<number | null>(null)

  function bind(id: string): void {
    if (id === workflowId.value) return
    workflowId.value = id
    content.value = null
    version.value = null
  }

  function applyPatch(data: DraftPatchData): boolean {
    if (data.workflow_id !== workflowId.value) return false
    if (version.value !== null && data.version <= version.value) return false
    content.value = data.content
    version.value = data.version
    return true
  }

  function checkHeartbeat(data: DraftVersionData): HeartbeatState {
    if (data.workflow_id !== workflowId.value) return 'foreign'
    if (version.value === null || version.value < data.version) return 'behind'
    return 'in-sync'
  }

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
    bind,
    applyPatch,
    checkHeartbeat,
    adoptSnapshot,
    reset
  }
})
