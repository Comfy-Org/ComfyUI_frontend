import { storeToRefs } from 'pinia'
import { computed } from 'vue'

import { useAgentComposerStore } from '../../stores/agent/agentComposerStore'

export interface ComposerAttachment {
  id: string
  name: string
  ref: string
  previewUrl?: string
  uploading?: boolean
}

export interface UseComposerOptions {
  onSend: (text: string, attachments: ComposerAttachment[]) => void
  isStreaming: () => boolean
  onStop: () => void
}

export function useComposer(options: UseComposerOptions) {
  const store = useAgentComposerStore()
  const { draft, attachments } = storeToRefs(store)

  const canSend = computed(
    () =>
      (draft.value.trim().length > 0 || attachments.value.length > 0) &&
      !store.hasPendingAttachmentWork &&
      attachments.value.every((attachment) => attachment.ref.length > 0)
  )

  function submit(): void {
    if (options.isStreaming()) {
      options.onStop()
      return
    }
    if (!canSend.value) return
    options.onSend(draft.value.trim(), attachments.value)
    draft.value = ''
    attachments.value = []
  }

  function insert(text: string): void {
    draft.value = draft.value ? `${draft.value} ${text}` : text
  }

  function addAttachment(attachment: ComposerAttachment): void {
    store.addAttachment(attachment)
  }

  function updateAttachment(
    id: string,
    patch: Partial<ComposerAttachment>
  ): void {
    store.updateAttachment(id, patch)
  }

  function removeAttachment(id: string): void {
    store.removeAttachment(id)
  }

  return {
    draft,
    attachments,
    canSend,
    submit,
    insert,
    addAttachment,
    updateAttachment,
    removeAttachment
  }
}
