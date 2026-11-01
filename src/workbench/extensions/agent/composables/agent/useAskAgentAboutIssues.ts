import { computed } from 'vue'

import { reportError } from '@comfyorg/telemetry/reportError'

import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useAgentConsent } from '@/workbench/extensions/agent/composables/agent/useAgentConsent'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'
import type { AgentErrorContext } from '@/platform/workflowErrors/agentErrorContext'

export function useAskAgentAboutIssues() {
  const panelStore = useAgentPanelStore()
  const workflowStore = useWorkflowStore()
  const { withConsent } = useAgentConsent()

  const canAskAgent = computed(() => panelStore.enabled)

  async function askAgentAboutIssues(
    context: AgentErrorContext
  ): Promise<void> {
    if (!panelStore.enabled) return
    const origin = workflowStore.activeWorkflow
    const request: AgentErrorContext = {
      ...context,
      workflowName: context.workflowName ?? origin?.filename,
      workflowPath: origin?.path
    }

    const attach = (): void => {
      if (!panelStore.enabled) return
      panelStore.view = { screen: 'chat' }
      panelStore.open('error_context')
      if (workflowStore.activeWorkflow?.path !== origin?.path) return
      panelStore.pendingErrorContext = request
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
