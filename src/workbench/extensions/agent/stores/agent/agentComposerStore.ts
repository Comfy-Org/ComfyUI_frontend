import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'

import type { ComposerAttachment } from '../../composables/agent/useComposer'

export interface AgentSubmissionRequest {
  id: number
  text: string
  attachments: ComposerAttachment[]
}

export const useAgentComposerStore = defineStore('agentComposer', () => {
  const draft = ref('')
  const attachments = ref<ComposerAttachment[]>([])
  const pendingSubmission = shallowRef<AgentSubmissionRequest | null>(null)
  const canSubmit = computed(
    () =>
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
    return true
  }

  function takeSubmission(id: number): AgentSubmissionRequest | undefined {
    const request = pendingSubmission.value
    if (request === null || request.id !== id) return
    pendingSubmission.value = null
    draft.value = ''
    attachments.value = []
    return request
  }

  return {
    draft,
    attachments,
    pendingSubmission,
    canSubmit,
    requestSubmission,
    takeSubmission
  }
})
