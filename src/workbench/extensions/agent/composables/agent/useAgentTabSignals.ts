import { watch } from 'vue'
import { useI18n } from 'vue-i18n'

import type { ComfyWorkflow } from '@/platform/workflow/management/stores/comfyWorkflow'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { pendingServerFact } from '@/platform/serverFacts/pendingServerFact'
import { useWorkflowTabActivityStore } from '@/stores/workflowTabActivityStore'
import {
  holdAgentTabTitlePrefixUntil,
  setAgentTabTitlePrefix
} from '@/workbench/extensions/agent/services/agent/agentTabTitlePrefix'
import { useAgentChatHistoryStore } from '@/workbench/extensions/agent/stores/agent/agentChatHistoryStore'
import { useAgentConversationStore } from '@/workbench/extensions/agent/stores/agent/agentConversationStore'
import { useAgentOpenChatsStore } from '@/workbench/extensions/agent/stores/agent/agentOpenChatsStore'

const answerWaitLimitMs = pendingServerFact('BE-25470', 15 * 60_000)

interface AgentTabSignalsOptions {
  onIdentityChange(listener: () => void): () => void
  cloudIdFor(workflow: ComfyWorkflow): string | undefined
}

/** Mirrors the agent's turns onto the workflow tabs and the browser tab title. */
export function useAgentTabSignals({
  onIdentityChange,
  cloudIdFor
}: AgentTabSignalsOptions) {
  const { t } = useI18n()
  const conversationStore = useAgentConversationStore()
  const workflowStore = useWorkflowStore()
  const history = useAgentChatHistoryStore()
  const openChats = useAgentOpenChatsStore()
  const tabActivity = useWorkflowTabActivityStore()
  const askSeenAt = new Map<string, number>()

  conversationStore.onTurnCompleted((path) => {
    if (path !== workflowStore.activeWorkflow?.path)
      tabActivity.markModified(path)
  })
  watch(
    () => conversationStore.turnTabs,
    (tabs) => tabActivity.setAgentTurnTabs(tabs),
    { immediate: true, flush: 'sync' }
  )
  watch(
    () =>
      workflowStore.openWorkflows.flatMap((tab) => {
        const workflowId = cloudIdFor(tab)
        const hasChat =
          workflowId !== undefined &&
          (history.workflowIdsWithChats.has(workflowId) ||
            openChats.recall(workflowId) !== undefined)
        return hasChat ? [tab.path] : []
      }),
    (paths) => tabActivity.setChatPaths(paths),
    { immediate: true }
  )
  watch(
    () =>
      conversationStore.awaitingApproval ? t('g.agentInputNeededShort') : null,
    setAgentTabTitlePrefix,
    { immediate: true, flush: 'sync' }
  )
  watch(
    () => conversationStore.pendingAskIds,
    (askIds) => {
      const now = Date.now()
      for (const askId of askIds)
        if (!askSeenAt.has(askId)) askSeenAt.set(askId, now)
    },
    { immediate: true, flush: 'sync' }
  )

  function clearTurnSignals(): void {
    tabActivity.setAgentTurnTabs([])
    const askIds = conversationStore.pendingAskIds
    for (const askId of askSeenAt.keys())
      if (!askIds.includes(askId)) askSeenAt.delete(askId)
    if (!conversationStore.awaitingApproval || askSeenAt.size === 0)
      setAgentTabTitlePrefix(null)
    else
      holdAgentTabTitlePrefixUntil(
        Math.max(...askSeenAt.values()) + answerWaitLimitMs,
        onIdentityChange
      )
  }

  return { clearTurnSignals }
}
