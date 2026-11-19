import { computed, watch } from 'vue'
import type { Ref } from 'vue'

import { useAgentComposerStore } from '@/workbench/extensions/agent/stores/agent/agentComposerStore'
import type { PendingSendOrigin } from '@/workbench/extensions/agent/stores/agent/agentConversationStore'

const THREAD_PREFIX = 'thread:'

function threadDraftKey(threadId: string): string {
  return `${THREAD_PREFIX}${threadId}`
}

/** Stable composer-draft key for either a blank chat or a persisted thread. */
export function draftKeyForOrigin(origin: PendingSendOrigin): string {
  return origin.kind === 'blank'
    ? origin.blankChatId
    : threadDraftKey(origin.threadId)
}

/** Keeps the composer draft with the chat it was typed in. */
export function useAgentChatDrafts(options: {
  threadId: Readonly<Ref<string | null>>
  activeBlankChatId: Readonly<Ref<string>>
}) {
  const composerStore = useAgentComposerStore()

  const draftKey = computed(() =>
    options.threadId.value === null
      ? draftKeyForOrigin({
          kind: 'blank',
          blankChatId: options.activeBlankChatId.value
        })
      : draftKeyForOrigin({ kind: 'thread', threadId: options.threadId.value })
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
