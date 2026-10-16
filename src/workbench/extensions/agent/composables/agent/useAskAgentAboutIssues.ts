import { computed } from 'vue'

import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'

import { useAgentComposerStore } from '../../stores/agent/agentComposerStore'
import { useAgentPanelStore } from '../../stores/agent/agentPanelStore'
import type { AgentErrorContext } from '../../types/agentErrorContext'

/** Opens the agent composer and attaches the problems as an editable chip; never sends. */
export function useAskAgentAboutIssues() {
  const panelStore = useAgentPanelStore()
  const composerStore = useAgentComposerStore()
  const workflowStore = useWorkflowStore()

  const canAskAgent = computed(() => panelStore.enabled)

  function askAgentAboutIssues(context: AgentErrorContext): void {
    if (!panelStore.enabled) return
    panelStore.view = { screen: 'chat' }
    panelStore.open('error_context')
    composerStore.setErrorContext({
      ...context,
      workflowName:
        context.workflowName ?? workflowStore.activeWorkflow?.filename
    })
  }

  return { canAskAgent, askAgentAboutIssues }
}
