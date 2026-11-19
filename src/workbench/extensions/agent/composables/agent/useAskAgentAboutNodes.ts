import { computed } from 'vue'

import { reportError } from '@comfyorg/telemetry/reportError'
import type { AgentPanelOpenedMetadata } from '@comfyorg/telemetry/types'

import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useAgentConsent } from '@/workbench/extensions/agent/composables/agent/useAgentConsent'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'
import type { AgentNodeAsk } from '@/workbench/extensions/agent/types/agentNodeAsk'

/**
 * Sends a question about canvas nodes to the current chat in the agent panel,
 * with the nodes as references, and opens a chat from its canvas pin. Opens
 * the panel, after consent, when it is closed.
 */
export function useAskAgentAboutNodes() {
  const panelStore = useAgentPanelStore()
  const workflowStore = useWorkflowStore()
  const { withConsent } = useAgentConsent()

  const canAskAgent = computed(() => panelStore.enabled)

  async function askAgentAboutNodes(
    text: string,
    nodes: readonly LGraphNode[]
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
      workflowPath: workflowStore.activeWorkflow?.path
    }

    await inPanel('selection_toolbox', () => {
      panelStore.pendingNodeAsk = request
    })
  }

  async function openAgentChat(threadId: string): Promise<void> {
    if (!panelStore.enabled) return
    await inPanel('canvas_pin', () => {
      panelStore.pendingChatOpen = threadId
    })
  }

  async function inPanel(
    source: AgentPanelOpenedMetadata['source'],
    hand: () => void
  ): Promise<void> {
    const open = (): void => {
      if (!panelStore.enabled) return
      panelStore.view = { screen: 'chat' }
      panelStore.open(source)
      hand()
    }

    if (panelStore.isVisible) {
      open()
      return
    }

    panelStore.suppressRestoredOpen()
    try {
      await withConsent('button_click', open)
    } catch (error) {
      reportError(error, {
        surface: 'agent',
        errorType: 'agent_consent_setting_load_failure'
      })
    }
  }

  return { canAskAgent, askAgentAboutNodes, openAgentChat }
}
