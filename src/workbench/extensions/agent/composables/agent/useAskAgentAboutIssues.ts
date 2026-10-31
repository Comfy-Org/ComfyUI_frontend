import { computed } from 'vue'

import { reportError } from '@comfyorg/telemetry/reportError'

import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useAgentConsent } from '@/workbench/extensions/agent/composables/agent/useAgentConsent'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'
import type { AgentErrorContext } from '@/platform/workflowErrors/agentErrorContext'

/**
 * Opens the agent panel and hands it the problems; the panel moves to the
 * workflow's chat and attaches them as an editable chip. Never sends. Opening a
 * closed panel asks for consent the same way the Agent button does.
 */
export function useAskAgentAboutIssues() {
  const panelStore = useAgentPanelStore()
  const workflowStore = useWorkflowStore()
  const { withConsent } = useAgentConsent()

  const canAskAgent = computed(() => panelStore.enabled)

  async function askAgentAboutIssues(
    context: AgentErrorContext
  ): Promise<void> {
    if (!panelStore.enabled) return
    const workflowName =
      context.workflowName ?? workflowStore.activeWorkflow?.filename

    const attach = (): void => {
      if (!panelStore.enabled) return
      panelStore.view = { screen: 'chat' }
      panelStore.open('error_context')
      panelStore.pendingErrorContext = { ...context, workflowName }
    }

    if (panelStore.isVisible) {
      attach()
      return
    }

    panelStore.suppressRestoredOpen()
    try {
      await withConsent('button_click', attach)
    } catch (error) {
      reportError(error, {
        surface: 'agent',
        errorType: 'agent_consent_setting_load_failure'
      })
    }
  }

  return { canAskAgent, askAgentAboutIssues }
}
