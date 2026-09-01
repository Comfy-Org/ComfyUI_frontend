import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'

import type { ComposerAttachment } from '../../composables/agent/useComposer'

export interface AgentSubmissionRequest {
  id: number
  text: string
  attachments: ComposerAttachment[]
}

export type CompactAgentSessionPhase = 'idle' | 'queued' | 'sending' | 'running'

export const useAgentComposerStore = defineStore('agentComposer', () => {
  const draft = ref('')
  const attachments = ref<ComposerAttachment[]>([])
  const pendingSubmission = shallowRef<AgentSubmissionRequest | null>(null)
  const compactSessionPhase = ref<CompactAgentSessionPhase>('idle')
  const canSubmit = computed(
    () =>
      compactSessionPhase.value === 'idle' &&
      pendingSubmission.value === null &&
      (draft.value.trim().length > 0 || attachments.value.length > 0) &&
      !attachments.value.some((attachment) => attachment.uploading)
  )
  let requestId = 0

  function requestSubmission(): boolean {
    if (!canSubmit.value) return false
    pendingSubmission.value = {
      id: ++requestId,
      text: draft.value.trim(),
      attachments: [...attachments.value]
    }
    compactSessionPhase.value = 'queued'
    return true
  }

  function takeSubmission(id: number): AgentSubmissionRequest | undefined {
    const request = pendingSubmission.value
    if (request === null || request.id !== id) return
    pendingSubmission.value = null
    draft.value = ''
    attachments.value = []
    compactSessionPhase.value = 'sending'
    return request
  }

  function markCompactSessionRunning(): void {
    if (compactSessionPhase.value === 'sending')
      compactSessionPhase.value = 'running'
  }

  function releaseSubmission(id?: number): boolean {
    const request = pendingSubmission.value
    if (request === null || (id !== undefined && request.id !== id))
      return false
    pendingSubmission.value = null
    compactSessionPhase.value = 'idle'
    return true
  }

  function finishCompactSession(): void {
    pendingSubmission.value = null
    compactSessionPhase.value = 'idle'
  }

  function restoreCompactSubmission(
    text: string,
    restoredAttachments: ComposerAttachment[]
  ): void {
    pendingSubmission.value = null
    draft.value = text
    attachments.value = [...restoredAttachments]
    compactSessionPhase.value = 'idle'
  }

  return {
    draft,
    attachments,
    pendingSubmission,
    compactSessionPhase,
    canSubmit,
    requestSubmission,
    takeSubmission,
    markCompactSessionRunning,
    releaseSubmission,
    finishCompactSession,
    restoreCompactSubmission
  }
})
