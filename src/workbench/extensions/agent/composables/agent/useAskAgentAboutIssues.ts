import { computed } from 'vue'

import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useAgentConsent } from '@/workbench/extensions/agent/composables/agent/useAgentConsent'
import { useAgentComposerStore } from '@/workbench/extensions/agent/stores/agent/agentComposerStore'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'
import type { AgentErrorContext } from '@/platform/workflowErrors/agentErrorContext'

/**
 * Opens the agent composer, attaches the problems as an editable chip, and
 * leaves the caret after it; never sends. Opening a closed panel asks for
 * consent the same way the Agent button does.
 */
export function useAskAgentAboutIssues() {
  const panelStore = useAgentPanelStore()
  const composerStore = useAgentComposerStore()
  const workflowStore = useWorkflowStore()
  const { withConsent } = useAgentConsent()

  const canAskAgent = computed(() => panelStore.enabled)
  let isAwaitingConsent = false

  async function askAgentAboutIssues(
    context: AgentErrorContext
  ): Promise<void> {
    if (!panelStore.enabled || isAwaitingConsent) return
    const workflowName =
      context.workflowName ?? workflowStore.activeWorkflow?.filename

    const attach = (): void => {
      if (!panelStore.enabled) return
      panelStore.view = { screen: 'chat' }
      panelStore.open('error_context')
      composerStore.setErrorContext({ ...context, workflowName })
    }

    if (panelStore.isVisible) {
      attach()
      return
    }

    isAwaitingConsent = true
    try {
      panelStore.suppressRestoredOpen()
      await withConsent('button_click', attach)
    } finally {
      isAwaitingConsent = false
    }
  }

  return { canAskAgent, askAgentAboutIssues }
}
