import { computed, ref } from 'vue'

import type { ChatSession } from '@/workbench/extensions/agent/stores/agent/agentChatHistoryStore'
import type { ChatSearchResult } from '@/workbench/extensions/agent/utils/chatHistorySearch'
import { searchChatHistory } from '@/workbench/extensions/agent/utils/chatHistorySearch'
import { readablePreview } from '@/workbench/extensions/agent/utils/chatPreviewText'
import { withCurrentSessionTitle } from '@/workbench/extensions/agent/utils/sessionTitle'

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
  /** Local-first sessions carrying `preview`; the caller sorts by recency. */
  sessions: () => readonly ChatSession[]
  currentSessionId: () => string | null
  /** Live title of the current chat, as History displays it. */
  currentSessionTitle: () => string | undefined
  workflowNameFor: (session: { workflowId?: string }) => string | undefined
}

/**
 * Search state local to the History screen; nothing is persisted, so leaving
 * History (or calling `reset`) discards it.
 */
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
    const isCurrent = session.id === options.currentSessionId()
    // Same helper History uses, so the matched title is the displayed title.
    const titled = isCurrent
      ? withCurrentSessionTitle(
          { current: [session], today: [], yesterday: [], earlier: [] },
          options.currentSessionTitle()
        ).current[0]
      : session
    return {
      ...titled,
      // Matched and displayed text are the same string, so highlight ranges
      // line up and a reference's `workflow://` URL never matches.
      preview: readablePreview(titled.preview),
      workflowName: options.workflowNameFor(session),
      isCurrent
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

  function reset() {
    state.value = transitionChatHistorySearch(state.value, {
      type: 'clear'
    }).state
  }

  return { text, results, isNoResults, onEscape, reset }
}
