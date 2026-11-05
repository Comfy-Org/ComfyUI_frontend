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
  /** Page-lifetime signal that the signed-in account or workspace changed. */
  onIdentityChange(listener: () => void): () => void
}

/** Mirrors the agent's turns onto the workflow tabs and the browser tab title. */
export function useAgentTabSignals({
  onIdentityChange
}: AgentTabSignalsOptions) {
  const { t } = useI18n()
  const conversationStore = useAgentConversationStore()
  const tabActivity = useWorkflowTabActivityStore()
  let awaitingSince: number | null = null

  conversationStore.onTurnCompleted((path) => tabActivity.markModified(path))
  watch(
    () => conversationStore.turnTabs,
    (tabs) => tabActivity.setAgentTurnTabs(tabs),
    { immediate: true, flush: 'sync' }
  )
  watch(
    () =>
      conversationStore.awaitingApproval ? t('g.agentInputNeededShort') : null,
    (text) => {
      awaitingSince = text === null ? null : (awaitingSince ?? Date.now())
      setAgentTabTitlePrefix(text)
    },
    { immediate: true, flush: 'sync' }
  )

  /** Clears the tab dots on panel close; a pending answer keeps the page-wide prefix. */
  function clearTurnSignals(): void {
    tabActivity.setAgentTurnTabs([])
    if (awaitingSince === null) setAgentTabTitlePrefix(null)
    else
      holdAgentTabTitlePrefixUntil(
        awaitingSince + answerWaitLimitMs,
        onIdentityChange
      )
  }

  return { clearTurnSignals }
}
