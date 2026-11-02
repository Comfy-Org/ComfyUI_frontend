import { watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { useWorkflowTabActivityStore } from '@/stores/workflowTabActivityStore'
import { setAgentTabTitlePrefix } from '@/workbench/extensions/agent/services/agent/agentTabTitlePrefix'
import { useAgentConversationStore } from '@/workbench/extensions/agent/stores/agent/agentConversationStore'

/** Mirrors the agent's turns onto the workflow tabs and the browser tab title. */
export function useAgentTabSignals() {
  const { t } = useI18n()
  const conversationStore = useAgentConversationStore()
  const tabActivity = useWorkflowTabActivityStore()

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

  function clearTurnSignals(): void {
    tabActivity.setAgentTurnTabs([])
    setAgentTabTitlePrefix(null)
  }

  return { clearTurnSignals }
}
