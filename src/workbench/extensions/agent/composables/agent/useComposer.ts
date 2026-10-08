import type { ComposerAttachment } from '../../types/composerAttachment'
import { storeToRefs } from 'pinia'
import { computed, getCurrentScope, onScopeDispose } from 'vue'
import { v4 as uuidv4 } from 'uuid'

import { useTelemetry } from '@/platform/telemetry'

import { composerPromptForSend } from '../../utils/composerPrompt'
import type { AgentStarterPromptAttribution } from '../../utils/starterPrompts'
import { useAgentComposerStore } from '../../stores/agent/agentComposerStore'

export interface UseComposerOptions {
  onSend: (text: string, attachments: ComposerAttachment[]) => void
  isRunning: () => boolean
  onStop: () => void
}

export function useComposer(options: UseComposerOptions) {
  const store = useAgentComposerStore()
  const {
    draft,
    attachments,
    prompt,
    workflowReferences,
    promptEpoch,
    promptOrigin,
    starterPrompt
  } = storeToRefs(store)
  if (getCurrentScope()) onScopeDispose(store.releaseUnusedAssets)

  const canSend = computed(
    () =>
      (draft.value.trim().length > 0 ||
        prompt.value.references.length > 0 ||
        attachments.value.length > 0) &&
      !attachments.value.some((item) => item.uploading)
  )

  function submit(): void {
    if (options.isRunning()) {
      options.onStop()
      return
    }
    if (!canSend.value) return
    options.onSend(
      composerPromptForSend(prompt.value).text.trim(),
      attachments.value
    )
  }

  function insert(
    text: string,
    attribution?: AgentStarterPromptAttribution
  ): void {
    const draftWasEmpty =
      !draft.value.trim() &&
      prompt.value.references.length === 0 &&
      attachments.value.length === 0
    store.setText(draft.value ? `${draft.value} ${text}` : text)
    if (!attribution) {
      store.markSuggestedPrompt()
      return
    }
    const clickId = uuidv4()
    store.markSuggestedPrompt({ id: attribution.promptId, clickId })
    useTelemetry()?.trackAgentStarterPromptClicked({
      prompt_id: attribution.promptId,
      prompt_index: attribution.promptIndex,
      prompt_count: attribution.promptCount,
      prompt_text_hash: attribution.promptTextHash,
      locale: attribution.locale,
      click_id: clickId,
      draft_was_empty: draftWasEmpty
    })
  }

  return {
    draft,
    attachments,
    prompt,
    promptEpoch,
    promptOrigin,
    starterPrompt,
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
    referenceAttachment: store.referenceAttachment,
    updateAttachment: store.updateAttachment,
    removeAttachment: store.removeAttachment
  }
}
