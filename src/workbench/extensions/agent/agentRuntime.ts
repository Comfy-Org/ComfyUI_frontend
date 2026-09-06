import type { WatchHandle } from 'vue'
import { watch } from 'vue'

import { api } from '@/scripts/api'

import type { AgentSessionDeps } from './composables/agent/useAgentSession'
import { useAgentSession } from './composables/agent/useAgentSession'
import type { AgentThreadSummary } from './schemas/agentApiSchema'
import { createAgentEventSource } from './services/agent/agentEventSource'
import { createAgentRestClient } from './services/agent/agentRestClient'
import type { AgentRestClient } from './services/agent/agentRestClient'
import { useAgentChatHistoryStore } from './stores/agent/agentChatHistoryStore'
import type { ChatSession } from './stores/agent/agentChatHistoryStore'

type RestFactory = () => AgentRestClient

export interface AgentRuntimeOptions {
  enabled: boolean
  untitledChatTitle: string | (() => string)
  workflow?: AgentSessionDeps['workflow']
  createRest?: RestFactory
  createEvents?: () => AgentSessionDeps['events']
  onError?: (error: unknown) => void
}

function toChatSession(
  thread: AgentThreadSummary,
  untitledChatTitle: string | (() => string)
): ChatSession {
  const stamp = thread.last_message_at ?? thread.updated_at ?? thread.created_at
  const updatedAt = stamp ? Date.parse(stamp) : Date.now()
  const fallbackTitle =
    typeof untitledChatTitle === 'function'
      ? untitledChatTitle()
      : untitledChatTitle
  return {
    id: thread.id,
    title: thread.title || thread.preview || fallbackTitle,
    updatedAt: Number.isNaN(updatedAt) ? Date.now() : updatedAt
  }
}

function createEnabledAgentRuntime(options: AgentRuntimeOptions) {
  const rest = (options.createRest ?? createAgentRestClient)()
  const events = (options.createEvents ?? (() => createAgentEventSource(api)))()
  const session = useAgentSession({
    rest,
    events,
    workflow: options.workflow
  })
  const history = useAgentChatHistoryStore()
  let started = false
  let noticesSeen = 0
  let watchers: WatchHandle[] = []

  function propagate(error: unknown): void {
    options.onError?.(error)
  }

  async function refreshHistory(): Promise<void> {
    try {
      history.replaceAll(
        (await session.listThreads()).map((thread) =>
          toChatSession(thread, options.untitledChatTitle)
        )
      )
    } catch (error) {
      propagate(error)
    }
  }

  function start(): void {
    if (started) return
    started = true
    noticesSeen = session.notices.value.length
    session.start()
    watchers = [
      watch(session.threadId, (id) => history.setActive(id), {
        immediate: true
      }),
      watch(
        () => session.notices.value.length,
        (length) => {
          for (const notice of session.notices.value.slice(noticesSeen))
            propagate(new Error(notice.text))
          noticesSeen = length
        }
      )
    ]
    void refreshHistory()
  }

  function stop(): void {
    if (!started) return
    started = false
    watchers.forEach((unwatch) => unwatch())
    watchers = []
    session.stop()
  }

  function retarget(workflowId: string): void {
    session.bindWorkflow(workflowId)
  }

  return {
    ...session,
    rest,
    history,
    refreshHistory,
    start,
    stop,
    retarget
  }
}

type AgentRuntime = ReturnType<typeof createEnabledAgentRuntime>

export function createAgentRuntime(
  options: AgentRuntimeOptions & { enabled: true }
): AgentRuntime
export function createAgentRuntime(
  options: AgentRuntimeOptions
): AgentRuntime | null
export function createAgentRuntime(
  options: AgentRuntimeOptions
): AgentRuntime | null {
  return options.enabled ? createEnabledAgentRuntime(options) : null
}
