import { watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { useWorkflowTabActivityStore } from '@/stores/workflowTabActivityStore'
import {
  holdAgentTabTitlePrefixUntil,
  setAgentTabTitlePrefix
} from '@/workbench/extensions/agent/services/agent/agentTabTitlePrefix'
import { useAgentConversationStore } from '@/workbench/extensions/agent/stores/agent/agentConversationStore'

/**
 * How long the server waits for an answer to a run approval or question
 * before it gives up on the turn (BE-24109).
 */
const AGENT_ANSWER_WAIT_LIMIT_MS = 15 * 60_000

/** Mirrors the agent's turns onto the workflow tabs and the browser tab title. */
export function useAgentTabSignals() {
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

  /**
   * Clears the signals when the panel closes. Closing the panel does not end a
   * server turn that waits for an answer, so the page-wide prefix stays until
   * the panel opens again or the server's wait would have run out.
   */
  function clearTurnSignals(): void {
    tabActivity.setAgentTurnTabs([])
    if (awaitingSince === null) setAgentTabTitlePrefix(null)
    else
      holdAgentTabTitlePrefixUntil(awaitingSince + AGENT_ANSWER_WAIT_LIMIT_MS)
  }

  return { clearTurnSignals }
}
