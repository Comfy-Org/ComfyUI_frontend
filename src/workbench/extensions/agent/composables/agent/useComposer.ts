import { storeToRefs } from 'pinia'
import { computed, getCurrentScope, onScopeDispose } from 'vue'

import { composerPromptForSend } from '../../utils/composerPrompt'
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
  const { draft, attachments, prompt, workflowReferences, promptEpoch } =
    storeToRefs(store)
  if (getCurrentScope()) onScopeDispose(store.releaseUnusedAssets)

  const canSend = computed(
    () =>
      (draft.value.trim().length > 0 || prompt.value.references.length > 0) &&
      !attachments.value.some((item) => item.uploading)
  )

  function submit(): void {
    if (options.isStreaming()) {
      options.onStop()
      return
    }
    if (!canSend.value) return
    options.onSend(
      composerPromptForSend(prompt.value).text.trim(),
      attachments.value
    )
  }

  function insert(text: string): void {
    store.setText(draft.value ? `${draft.value} ${text}` : text)
  }

  return {
    draft,
    attachments,
    prompt,
    promptEpoch,
    applyEditorPrompt: store.applyEditorPrompt,
    setInsertionPoint: store.setInsertionPoint,
    removeReference: store.removeReference,
    workflowReferences,
    canSend,
    submit,
    insert,
    setText: store.setText,
    replacePrompt: store.replacePrompt,
    addAttachment: store.addAttachment,
    updateAttachment: store.updateAttachment,
    removeAttachment: store.removeAttachment
  }
}
