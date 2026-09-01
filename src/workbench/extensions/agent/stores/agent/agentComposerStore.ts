import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'

import type { ComposerAttachment } from '../../composables/agent/useComposer'

export interface AgentSubmissionRequest {
  id: number
  text: string
  attachments: ComposerAttachment[]
}

export interface AgentAttachmentRequest {
  id: number
  files: readonly File[]
}

export type CompactAgentSessionPhase = 'idle' | 'queued' | 'sending' | 'running'

export const useAgentComposerStore = defineStore('agentComposer', () => {
  const draft = ref('')
  const attachments = ref<ComposerAttachment[]>([])
  const pendingSubmission = shallowRef<AgentSubmissionRequest | null>(null)
  const pendingAttachmentRequests = shallowRef<AgentAttachmentRequest[]>([])
  const compactSessionPhase = ref<CompactAgentSessionPhase>('idle')
  const hasPendingAttachmentWork = computed(
    () =>
      pendingAttachmentRequests.value.length > 0 ||
      attachments.value.some((attachment) => attachment.uploading)
  )
  const canSubmit = computed(
    () =>
      compactSessionPhase.value === 'idle' &&
      pendingSubmission.value === null &&
      !hasPendingAttachmentWork.value &&
      (draft.value.trim().length > 0 || attachments.value.length > 0) &&
      attachments.value.every((attachment) => attachment.ref.length > 0)
  )
  let submissionRequestId = 0
  let attachmentRequestId = 0

  function requestSubmission(): boolean {
    if (!canSubmit.value) return false
    pendingSubmission.value = {
      id: ++submissionRequestId,
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

  function requestAttachments(files: Iterable<File>): boolean {
    const requestedFiles = [...files]
    if (requestedFiles.length === 0) return false
    pendingAttachmentRequests.value = [
      ...pendingAttachmentRequests.value,
      { id: ++attachmentRequestId, files: requestedFiles }
    ]
    return true
  }

  function takeAttachmentRequest(): AgentAttachmentRequest | undefined {
    const [request, ...remaining] = pendingAttachmentRequests.value
    if (request === undefined) return
    pendingAttachmentRequests.value = remaining
    return request
  }

  function addAttachment(attachment: ComposerAttachment): void {
    if (attachments.value.some((item) => item.id === attachment.id)) return
    attachments.value = [...attachments.value, attachment]
  }

  function updateAttachment(
    id: string,
    patch: Partial<ComposerAttachment>
  ): void {
    attachments.value = attachments.value.map((item) =>
      item.id === id ? { ...item, ...patch } : item
    )
  }

  function removeAttachment(id: string): void {
    const removed = attachments.value.find((item) => item.id === id)
    if (removed?.previewUrl?.startsWith('blob:'))
      URL.revokeObjectURL(removed.previewUrl)
    attachments.value = attachments.value.filter((item) => item.id !== id)
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
    pendingAttachmentRequests,
    compactSessionPhase,
    canSubmit,
    hasPendingAttachmentWork,
    requestSubmission,
    takeSubmission,
    requestAttachments,
    takeAttachmentRequest,
    addAttachment,
    updateAttachment,
    removeAttachment,
    markCompactSessionRunning,
    releaseSubmission,
    finishCompactSession,
    restoreCompactSubmission
  }
})
