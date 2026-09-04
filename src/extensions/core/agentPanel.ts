import { storeToRefs } from 'pinia'
import { watch } from 'vue'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { reportError } from '@/platform/telemetry/reportError'
import { registerWorkflowTabActivityTracker } from '@/workbench/extensions/agent/services/agent/workflowTabActivityTracker'
import { useAgentConsentStore } from '@/workbench/extensions/agent/stores/agent/agentConsentStore'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useExtensionService } from '@/services/extensionService'
import { useAgentNodeSelectionStore } from '@/stores/agentNodeSelectionStore'
import { getNodeByLocatorId } from '@/utils/graphTraversalUtil'
import { isLGraphNode } from '@/utils/litegraphUtil'
import {
  notifyMintPortsAfterGraphConfigure,
  notifyMintPortsBeforeGraphLoad
} from '@/workbench/extensions/agent/crdt/mintPortWiring'

let registered = false

export function registerAgentPanelExtension(): void {
  if (registered) return
  registered = true

  useExtensionService().registerExtension({
    name: 'Comfy.AgentPanel',
    beforeLoadGraph() {
      notifyMintPortsBeforeGraphLoad()
      const agentPanelStore = useAgentPanelStore()
      if (!agentPanelStore.isVisible) return

      const nodeSelectionStore = useAgentNodeSelectionStore()
      nodeSelectionStore.beginWorkflowLoad()
    },
    afterLoadGraph(app) {
      const agentPanelStore = useAgentPanelStore()
      const nodeSelectionStore = useAgentNodeSelectionStore()
      if (!nodeSelectionStore.isLoadingWorkflow) return
      if (!agentPanelStore.isVisible) {
        nodeSelectionStore.finishWorkflowLoad()
        return
      }

      try {
        const canvas = app.canvas
        const workflowStore = useWorkflowStore()
        const workflowPath = workflowStore.activeWorkflow?.path
        const nodes = nodeSelectionStore
          .nodeIds(workflowPath)
          .map((locatorId) => getNodeByLocatorId(app.rootGraph, locatorId))
          .filter(isLGraphNode)
        nodeSelectionStore.restoreNodeIds(
          nodes.map((node) => workflowStore.nodeToNodeLocatorId(node))
        )
        canvas?.selectItems(nodes)
        useCanvasStore().updateSelectedItems()
      } catch (error) {
        nodeSelectionStore.finishWorkflowLoad()
        throw error
      }
    },
    onGraphLoadError() {
      const nodeSelectionStore = useAgentNodeSelectionStore()
      if (nodeSelectionStore.isLoadingWorkflow) {
        nodeSelectionStore.finishWorkflowLoad()
      }
    },
    afterConfigureGraph() {
      notifyMintPortsAfterGraphConfigure()
    },
    setup() {
      const agentPanelStore = useAgentPanelStore()
      const consentStore = useAgentConsentStore()
      const { enabled } = storeToRefs(agentPanelStore)
      const { resolvedUserInfo } = useCurrentUser()
      registerWorkflowTabActivityTracker(enabled)

      watch(
        () => consentStore.accepted,
        (value) => {
          agentPanelStore.consentAccepted = value
        },
        { immediate: true, flush: 'sync' }
      )

      const loadConsentIfEligible = (): void => {
        if (!agentPanelStore.enabled || !resolvedUserInfo.value) return
        void consentStore.load().catch((error: unknown) => {
          reportError(error, {
            errorType: 'agent_consent_setting_load_failure'
          })
        })
      }
      watch(() => resolvedUserInfo.value?.id, loadConsentIfEligible, {
        immediate: true
      })
      return setupFlagGate(loadConsentIfEligible)
    }
  })
}

async function setupFlagGate(loadConsentIfEligible: () => void): Promise<void> {
  const agentPanelStore = useAgentPanelStore()
  const settle = (): void => {
    agentPanelStore.gateSettled = true
  }
  try {
    const [
      { createPostHogFlagSource, FLAG_SETTLE_TIMEOUT_MS },
      { default: posthog }
    ] = await Promise.all([
      import('@/workbench/extensions/agent/utils/postHogFlagSource'),
      import('posthog-js')
    ])
    const source = createPostHogFlagSource(posthog)
    const sync = (): void => {
      const forceInDev = import.meta.env.MODE === 'development'
      agentPanelStore.enabled = forceInDev || source.isEnabled()
      loadConsentIfEligible()
      if (!agentPanelStore.enabled) {
        const nodeSelectionStore = useAgentNodeSelectionStore()
        if (nodeSelectionStore.isLoadingWorkflow)
          nodeSelectionStore.finishWorkflowLoad()
      }
    }
    source.onChange?.(() => {
      sync()
      settle()
    })
    sync()
    if (import.meta.env.MODE === 'development') settle()
    else setTimeout(settle, FLAG_SETTLE_TIMEOUT_MS)
  } catch (error) {
    console.error('[Comfy.AgentPanel] feature-flag gate failed to load', error)
    settle()
    reportError(error, { errorType: 'agent_flag_gate_load_failure' })
  }
}
