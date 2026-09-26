import { storeToRefs } from 'pinia'
import { computed, getCurrentScope, onScopeDispose } from 'vue'
import { v4 as uuidv4 } from 'uuid'

import { useTelemetry } from '@/platform/telemetry'

import { composerPromptForSend } from '../../utils/composerPrompt'
import type { AgentStarterPromptAttribution } from '../../utils/starterPrompts'
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
  isRunning: () => boolean
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

  /**
   * Puts an affordance's text in the composer. `starterPrompt` identifies the
   * empty-state chip it came from; supplying it is what emits
   * `app:agent_starter_prompt_clicked` and what lets the resulting send be
   * attributed to that chip. A caller that does not identify a prompt still
   * inserts and is still recorded as `suggestion`, but reports no click — so a
   * future affordance cannot silently inflate the starter-prompt counts.
   */
  function insert(
    text: string,
    starterPrompt?: AgentStarterPromptAttribution
  ): void {
    const draftWasEmpty = !draft.value
    store.setText(draft.value ? `${draft.value} ${text}` : text)
    if (!starterPrompt) {
      store.markSuggestedPrompt()
      return
    }
    const clickId = uuidv4()
    store.markSuggestedPrompt({ id: starterPrompt.promptId, clickId })
    useTelemetry()?.trackAgentStarterPromptClicked({
      prompt_id: starterPrompt.promptId,
      prompt_index: starterPrompt.promptIndex,
      prompt_count: starterPrompt.promptCount,
      prompt_text_hash: starterPrompt.promptTextHash,
      locale: starterPrompt.locale,
      click_id: clickId,
      draft_was_empty: draftWasEmpty
    })
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
