import { watch } from 'vue'
import { useI18n } from 'vue-i18n'

import type { ComfyWorkflow } from '@/platform/workflow/management/stores/comfyWorkflow'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useWorkflowTabActivityStore } from '@/stores/workflowTabActivityStore'
import { setAgentTabTitlePrefix } from '@/workbench/extensions/agent/services/agent/agentTabTitlePrefix'
import { useAgentChatHistoryStore } from '@/workbench/extensions/agent/stores/agent/agentChatHistoryStore'
import { useAgentConversationStore } from '@/workbench/extensions/agent/stores/agent/agentConversationStore'
import { useAgentOpenChatsStore } from '@/workbench/extensions/agent/stores/agent/agentOpenChatsStore'

type AgentTabSignalsDeps = {
  cloudIdFor: (workflow: ComfyWorkflow) => string | undefined
}

/** Mirrors the agent's turns onto the workflow tabs and the browser tab title. */
export function useAgentTabSignals({ cloudIdFor }: AgentTabSignalsDeps) {
  const { t } = useI18n()
  const conversationStore = useAgentConversationStore()
  const workflowStore = useWorkflowStore()
  const history = useAgentChatHistoryStore()
  const openChats = useAgentOpenChatsStore()
  const tabActivity = useWorkflowTabActivityStore()

  conversationStore.onTurnCompleted((path) => {
    const endedInBackground = path !== workflowStore.activeWorkflow?.path
    if (endedInBackground) tabActivity.markModified(path)
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
