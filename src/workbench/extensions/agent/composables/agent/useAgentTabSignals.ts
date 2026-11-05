import { watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { pendingServerFact } from '@/platform/serverFacts/pendingServerFact'
import { useWorkflowTabActivityStore } from '@/stores/workflowTabActivityStore'
import {
  holdAgentTabTitlePrefixUntil,
  setAgentTabTitlePrefix
} from '@/workbench/extensions/agent/services/agent/agentTabTitlePrefix'
import { useAgentConversationStore } from '@/workbench/extensions/agent/stores/agent/agentConversationStore'

const answerWaitLimitMs = pendingServerFact('BE-25470', 15 * 60_000)

interface AgentTabSignalsOptions {
  onIdentityChange(listener: () => void): () => void
}

/** Mirrors the agent's turns onto the workflow tabs and the browser tab title. */
export function useAgentTabSignals({
  onIdentityChange
}: AgentTabSignalsOptions) {
  const { t } = useI18n()
  const conversationStore = useAgentConversationStore()
  const tabActivity = useWorkflowTabActivityStore()
  const askSeenAt = new Map<string, number>()

  conversationStore.onTurnCompleted((path) => tabActivity.markModified(path))
  watch(
    () => conversationStore.turnTabs,
    (tabs) => tabActivity.setAgentTurnTabs(tabs),
    { immediate: true, flush: 'sync' }
  )
  watch(
    () =>
      conversationStore.awaitingApproval ? t('g.agentInputNeededShort') : null,
    setAgentTabTitlePrefix,
    { immediate: true, flush: 'sync' }
  )
  watch(
    () => conversationStore.awaitedAskIds,
    (askIds) => {
      const now = Date.now()
      for (const askId of askSeenAt.keys())
        if (!askIds.includes(askId)) askSeenAt.delete(askId)
      for (const askId of askIds)
        if (!askSeenAt.has(askId)) askSeenAt.set(askId, now)
    },
    { immediate: true, flush: 'sync' }
  )

  function clearTurnSignals(): void {
    tabActivity.setAgentTurnTabs([])
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
