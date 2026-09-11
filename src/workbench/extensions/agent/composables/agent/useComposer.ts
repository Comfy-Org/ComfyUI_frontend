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
  const { draft, attachments, prompt, workflowReferences } = storeToRefs(store)

  const canSend = computed(
    () =>
      (draft.value.trim().length > 0 || attachments.value.length > 0) &&
      !attachments.value.some((item) => item.uploading)
  )

  function submit(): void {
    if (options.isStreaming()) {
      options.onStop()
      return
    }
    if (!canSend.value) return
    options.onSend(draft.value.trim(), attachments.value)
  }

  function insert(text: string): void {
    store.setText(draft.value ? `${draft.value} ${text}` : text)
  }

  function removeAttachment(id: string): void {
    const removed = store.removeAttachment(id)
    if (removed?.previewUrl?.startsWith('blob:'))
      URL.revokeObjectURL(removed.previewUrl)
  }

  return {
    draft,
    attachments,
    prompt,
    workflowReferences,
    canSend,
    submit,
    insert,
    setText: store.setText,
    replacePrompt: store.replacePrompt,
    addAttachment: store.addAttachment,
    updateAttachment: store.updateAttachment,
    removeAttachment
  }
}
