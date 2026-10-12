import { defineStore } from 'pinia'
import { markRaw, watch } from 'vue'

import { t } from '@/i18n'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'

import { useAgentWorkflowResolver } from '../../composables/agent/useAgentWorkflowResolver'
import type { AgentThreadSummary } from '../../schemas/agentApiSchema'
import { createAgentRestClient } from '../../services/agent/agentRestClient'
import type { ChatSession } from './agentChatHistoryStore'
import { useAgentChatHistoryStore } from './agentChatHistoryStore'
import { useAgentPanelStore } from './agentPanelStore'
import { useAgentWorkflowTabBindingStore } from './agentWorkflowTabBindingStore'

/** A chat picked from a workflow's chat menu, or a new chat when `chatId` is null. */
interface WorkflowChatRequest {
  workflowPath: string
  chatId: string | null
}

type WorkflowChatOpener = (workflowPath: string, chatId: string | null) => void

type ChatListLoad = { ok: true } | { ok: false; error: unknown }

function toChatSession(thread: AgentThreadSummary): ChatSession {
  const updatedAt = Date.parse(thread.last_message_at)
  return {
    id: thread.id,
    title: thread.title || thread.preview || t('agent.untitledChat'),
    updatedAt: Number.isNaN(updatedAt) ? Date.now() : updatedAt,
    titleSource: thread.title ? 'server' : 'fallback',
    workflowId: thread.workflow_id || undefined
  }
}

/**
 * The agent's app-wide view of Cloud workflows and their chats: the one
 * workflow resolver (with its Cloud index), Chat history loading, and opening
 * a workflow's chat whether or not the panel is mounted.
 */
export const useAgentWorkflowChatsStore = defineStore(
  'agentWorkflowChats',
  () => {
    const rest = createAgentRestClient()
    const history = useAgentChatHistoryStore()
    const panel = useAgentPanelStore()
    const resolver = markRaw(
      useAgentWorkflowResolver({
        workflows: useWorkflowStore(),
        bindings: useAgentWorkflowTabBindingStore(),
        listCloudWorkflows: () => rest.listCloudWorkflows(),
        getCloudWorkflow: (workflowId) => rest.getCloudWorkflow(workflowId)
      })
    )

    let loadGeneration = 0

    /**
     * Replaces Chat history with the server list. Only the latest load applies
     * its result or returns its failure; an incomplete list counts as failed.
     */
    async function loadChats(): Promise<ChatListLoad> {
      const generation = ++loadGeneration
      const isLatest = () => generation === loadGeneration
      try {
        const { threads, complete } = await rest.listThreads()
        if (!isLatest()) return { ok: true }
        if (!complete)
          return {
            ok: false,
            error: 'Agent thread list ended before its last page'
          }
        history.replaceAll(threads.map(toChatSession))
        return { ok: true }
      } catch (error) {
        return isLatest() ? { ok: false, error } : { ok: true }
      }
    }

    let panelOpener: WorkflowChatOpener | null = null
    let pendingRequest: WorkflowChatRequest | null = null

    function openChat(workflowPath: string, chatId: string | null): void {
      if (panelOpener) {
        panelOpener(workflowPath, chatId)
        return
      }
      pendingRequest = { workflowPath, chatId }
      panel.open('workflow_chats')
    }

    function takePendingRequest(): WorkflowChatRequest | null {
      const request = pendingRequest
      pendingRequest = null
      return request
    }

    function attachPanel(opener: WorkflowChatOpener): () => void {
      panelOpener = opener
      return () => {
        if (panelOpener === opener) panelOpener = null
      }
    }

    watch(
      () => panel.isVisible,
      (visible) => {
        if (!visible) pendingRequest = null
      },
      { flush: 'sync' }
    )

    return {
      resolver,
      loadChats,
      openChat,
      takePendingRequest,
      attachPanel
    }
  }
)
