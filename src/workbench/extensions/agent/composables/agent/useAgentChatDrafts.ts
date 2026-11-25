import { computed, ref, watch } from 'vue'
import type { Ref } from 'vue'

import { useAgentComposerStore } from '@/workbench/extensions/agent/stores/agent/agentComposerStore'
import type { PendingSendOrigin } from '@/workbench/extensions/agent/stores/agent/agentConversationStore'
import { useAgentPromptQueueStore } from '@/workbench/extensions/agent/stores/agent/agentPromptQueueStore'

const THREAD_PREFIX = 'thread:'
const MAX_UPLOAD_SCOPES = 64

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
  const promptQueueStore = useAgentPromptQueueStore()
  const uploadScopes = new Map<string, string>()
  let nextUploadScopeId = 0

  function trimUploadScopes(): void {
    for (const key of uploadScopes.keys()) {
      if (uploadScopes.size <= MAX_UPLOAD_SCOPES) break
      uploadScopes.delete(key)
    }
  }

  function uploadScopeFor(key: string): string {
    const existing = uploadScopes.get(key)
    if (existing !== undefined) {
      uploadScopes.delete(key)
      uploadScopes.set(key, existing)
      return existing
    }
    const token = `upload-scope:${++nextUploadScopeId}`
    uploadScopes.set(key, token)
    trimUploadScopes()
    return token
  }

  const draftKey = computed(() =>
    options.threadId.value === null
      ? draftKeyForOrigin({
          kind: 'blank',
          blankChatId: options.activeBlankChatId.value
        })
      : draftKeyForOrigin({ kind: 'thread', threadId: options.threadId.value })
  )

  const draftGeneration = ref(0)

  watch(
    draftKey,
    (key) => {
      draftGeneration.value += 1
      promptQueueStore.activateQueue(key)
      composerStore.activateDraft(key)
    },
    { immediate: true, flush: 'sync' }
  )

  function uploadScope(): string {
    return uploadScopeFor(draftKey.value)
  }

  function resetUploadScope(key: string): void {
    uploadScopes.delete(key)
  }

  function rekeyBlankDraft(blankChatId: string, threadId: string): void {
    const nextKey = threadDraftKey(threadId)
    const token = uploadScopes.get(blankChatId)
    if (token !== undefined) {
      uploadScopes.delete(blankChatId)
      uploadScopes.set(nextKey, token)
      trimUploadScopes()
    }
    promptQueueStore.rekeyQueue(blankChatId, nextKey)
    composerStore.rekeyDraft(blankChatId, nextKey)
  }

  function discardChatDraft(threadId: string): void {
    const key = threadDraftKey(threadId)
    uploadScopes.delete(key)
    promptQueueStore.discardQueue(key)
    composerStore.discardDraft(key)
    composerStore.discardPendingSendBackupsForThread(threadId)
  }

  return {
    draftKey,
    draftGeneration,
    uploadScope,
    resetUploadScope,
    rekeyBlankDraft,
    discardChatDraft
  }
}
