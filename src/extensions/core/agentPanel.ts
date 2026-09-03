import { watch } from 'vue'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { reportError } from '@/platform/telemetry/reportError'
import { createPostHogFlagSource } from '@/workbench/extensions/agent/composables/agent/useAgentFeatureGate'
import { registerWorkflowTabActivityTracker } from '@/workbench/extensions/agent/services/agent/workflowTabActivityTracker'
import { useAgentConsentStore } from '@/workbench/extensions/agent/stores/agent/agentConsentStore'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useExtensionService } from '@/services/extensionService'
import { useAgentNodeSelectionStore } from '@/stores/agentNodeSelectionStore'
import { getNodeByLocatorId } from '@/utils/graphTraversalUtil'
import { isLGraphNode } from '@/utils/litegraphUtil'

useExtensionService().registerExtension({
  name: 'Comfy.AgentPanel',
  beforeLoadGraph() {
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
  },
  setup() {
    const agentPanelStore = useAgentPanelStore()
    const consentStore = useAgentConsentStore()
    const { isLoggedIn } = useCurrentUser()
    registerWorkflowTabActivityTracker()

    const loadConsentIfEligible = (): void => {
      if (!agentPanelStore.enabled || !isLoggedIn.value) return
      void consentStore.load().catch((error: unknown) => {
        reportError(error, {
          errorType: 'agent_consent_setting_load_failure'
        })
      })
    }
    watch(isLoggedIn, loadConsentIfEligible, { immediate: true })

    async function setupFlagGate(): Promise<void> {
      // posthog-js is a lazy chunk and is commonly blocked by ad blockers; a failed
      // load must leave the panel gated off rather than surface as an unhandled rejection.
      try {
        const posthog = (await import('posthog-js')).default
        const source = createPostHogFlagSource(posthog)
        const sync = (): void => {
          const forceInDev = import.meta.env.MODE === 'development'
          agentPanelStore.enabled = forceInDev || source.isEnabled()
          loadConsentIfEligible()
        }
        source.onChange?.(sync)
        sync()
      } catch (error) {
        console.error(
          '[Comfy.AgentPanel] feature-flag gate failed to load',
          error
        )
      }
    }

    void setupFlagGate()
  }
})
