import { computed, watch } from 'vue'
import type { Ref } from 'vue'

import { useAgentComposerStore } from '@/workbench/extensions/agent/stores/agent/agentComposerStore'

const THREAD_PREFIX = 'thread:'

function threadDraftKey(threadId: string): string {
  return `${THREAD_PREFIX}${threadId}`
}

/** Keeps the composer draft with the chat it was typed in. */
export function useAgentChatDrafts(options: {
  threadId: Readonly<Ref<string | null>>
  activeBlankChatId: Readonly<Ref<string>>
}) {
  const composerStore = useAgentComposerStore()

  const draftKey = computed(() =>
    options.threadId.value === null
      ? options.activeBlankChatId.value
      : threadDraftKey(options.threadId.value)
  )

  watch(
    draftKey,
    (key) => {
      composerStore.activateDraft(key)
    },
    { immediate: true, flush: 'sync' }
  )

  function rekeyBlankDraft(blankChatId: string, threadId: string): void {
    composerStore.rekeyDraft(blankChatId, threadDraftKey(threadId))
  }

  function discardChatDraft(threadId: string): void {
    composerStore.discardDraft(threadDraftKey(threadId))
  }

  return { draftKey, rekeyBlankDraft, discardChatDraft }
}
