import { computed } from 'vue'

import { reportError } from '@comfyorg/telemetry/reportError'

import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useAgentConsent } from '@/workbench/extensions/agent/composables/agent/useAgentConsent'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'
import type {
  AgentNodeAsk,
  NodeAskInputMethod
} from '@/workbench/extensions/agent/types/agentNodeAsk'

/**
 * Sends a question about canvas nodes to the current chat in the agent panel,
 * opening the panel after consent when it is closed.
 */
export function useAskAgentAboutNodes() {
  const panelStore = useAgentPanelStore()
  const workflowStore = useWorkflowStore()
  const { withConsent } = useAgentConsent()

  const canAskAgent = computed(() => panelStore.enabled)

  async function askAgentAboutNodes(
    text: string,
    nodes: readonly LGraphNode[],
    inputMethod: NodeAskInputMethod = 'selection_toolbox'
  ): Promise<void> {
    const question = text.trim()
    if (!panelStore.enabled || !question || !nodes.length) return
    const request: AgentNodeAsk = {
      text: question,
      nodes: nodes.map((node) => ({
        id: String(node.id),
        locatorId: workflowStore.nodeToNodeLocatorId(node),
        title: node.title || node.type
      })),
      workflowPath: workflowStore.activeWorkflow?.path,
      inputMethod
    }

    const send = (): void => {
      if (!panelStore.enabled) return
      panelStore.view = { screen: 'chat' }
      panelStore.open('selection_toolbox')
      panelStore.pendingNodeAsk = request
    }

    if (panelStore.isVisible) {
      send()
      return
    }

    panelStore.suppressRestoredOpen()
    try {
      await withConsent('button_click', send)
    } catch (error) {
      reportError(error, {
        surface: 'agent',
        errorType: 'agent_consent_setting_load_failure'
      })
    }
  }

  return { canAskAgent, askAgentAboutNodes }
}
