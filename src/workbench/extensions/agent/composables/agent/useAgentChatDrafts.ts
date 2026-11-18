import { computed, watch } from 'vue'
import type { Ref } from 'vue'

import { useAgentComposerStore } from '@/workbench/extensions/agent/stores/agent/agentComposerStore'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'

const BLANK_CHAT_PREFIX = 'blank:'
const THREAD_PREFIX = 'thread:'

function threadDraftKey(threadId: string): string {
  return `${THREAD_PREFIX}${threadId}`
}

/** Keeps the composer draft with the chat it was typed in. */
export function useAgentChatDrafts(options: {
  threadId: Readonly<Ref<string | null>>
  isSending: Readonly<Ref<boolean>>
}) {
  const composerStore = useAgentComposerStore()
  const panelStore = useAgentPanelStore()

  const draftKey = computed(() =>
    options.threadId.value === null
      ? `${BLANK_CHAT_PREFIX}${panelStore.blankChatTab ?? ''}`
      : threadDraftKey(options.threadId.value)
  )

  watch(
    draftKey,
    (key, previous) => {
      if (
        previous !== undefined &&
        previous.startsWith(BLANK_CHAT_PREFIX) &&
        key.startsWith(THREAD_PREFIX) &&
        options.isSending.value
      )
        composerStore.rekeyDraft(previous, key)
      composerStore.activateDraft(key)
    },
    { immediate: true, flush: 'sync' }
  )

  function discardChatDraft(threadId: string): void {
    composerStore.discardDraft(threadDraftKey(threadId))
  }

  return { draftKey, discardChatDraft }
}
