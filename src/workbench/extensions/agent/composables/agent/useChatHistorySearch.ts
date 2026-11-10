import { computed, ref } from 'vue'

import type { ChatSession } from '@/workbench/extensions/agent/stores/agent/agentChatHistoryStore'
import type { ChatSearchResult } from '@/workbench/extensions/agent/utils/chatHistorySearch'
import { searchChatHistory } from '@/workbench/extensions/agent/utils/chatHistorySearch'
import { readablePreview } from '@/workbench/extensions/agent/utils/chatPreviewText'

import type { ChatHistorySearchEffect } from './chatHistorySearchState'
import {
  initialChatHistorySearchState,
  transitionChatHistorySearch
} from './chatHistorySearchState'

export interface SearchableChatSession extends ChatSession {
  workflowName?: string
  isCurrent: boolean
}

export type ChatHistorySearchResult = ChatSearchResult<SearchableChatSession>

interface ChatHistorySearchOptions {
  sessions: () => readonly ChatSession[]
  currentSessionId: () => string | null
  workflowNameFor: (session: { workflowId?: string }) => string | undefined
}

/** Chat history search state; nothing is persisted. */
export function useChatHistorySearch(options: ChatHistorySearchOptions) {
  const state = ref(initialChatHistorySearchState)

  const text = computed({
    get: () => state.value.text,
    set: (value: string) => {
      state.value = transitionChatHistorySearch(state.value, {
        type: 'type',
        text: value
      }).state
    }
  })

  function searchable(session: ChatSession): SearchableChatSession {
    const preview = readablePreview(session.preview)
    return {
      ...session,
      preview: preview === readablePreview(session.title) ? undefined : preview,
      workflowName: options.workflowNameFor(session),
      isCurrent: session.id === options.currentSessionId()
    }
  }

  const results = computed<ChatHistorySearchResult[] | null>(() => {
    if (state.value.status === 'idle') return null
    return searchChatHistory(
      options.sessions().map(searchable),
      state.value.text
    )
  })

  const isNoResults = computed(() => results.value?.length === 0)

  function onEscape(): ChatHistorySearchEffect {
    const transition = transitionChatHistorySearch(state.value, {
      type: 'escape'
    })
    state.value = transition.state
    return transition.effect
  }

  return { text, results, isNoResults, onEscape }
}
