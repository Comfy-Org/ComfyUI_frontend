import { storeToRefs } from 'pinia'

import { registerWorkflowTabActivityTracker } from '@/workbench/extensions/agent/services/agent/workflowTabActivityTracker'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useExtensionService } from '@/services/extensionService'
import { useAgentNodeSelectionStore } from '@/stores/agentNodeSelectionStore'
import { getNodeByLocatorId } from '@/utils/graphTraversalUtil'
import { isLGraphNode } from '@/utils/litegraphUtil'
import { reportError } from '@/platform/telemetry/reportError'
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
      if (!agentPanelStore.enabled || !agentPanelStore.isOpen) return

      const nodeSelectionStore = useAgentNodeSelectionStore()
      nodeSelectionStore.beginWorkflowLoad()
    },
    afterLoadGraph(app) {
      const agentPanelStore = useAgentPanelStore()
      const nodeSelectionStore = useAgentNodeSelectionStore()
      if (!nodeSelectionStore.isLoadingWorkflow) return
      if (!agentPanelStore.enabled || !agentPanelStore.isOpen) {
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
      const { enabled } = storeToRefs(useAgentPanelStore())
      registerWorkflowTabActivityTracker(enabled)
      return setupFlagGate()
    }
  })
}

async function setupFlagGate(): Promise<void> {
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
    // Two harnesses force the panel on regardless of the flag: development,
    // and the standalone (local agent) build. The standalone panel has no
    // cloud identity for PostHog to evaluate the flag against, so gating it on
    // the flag left it permanently off in a production bundle — the harness
    // itself is the opt-in, since the panel is tree-shaken out of every other
    // non-cloud build (see extensions/core/index.ts).
    const forcedOn =
      import.meta.env.MODE === 'development' ||
      import.meta.env.VITE_AGENT_STANDALONE === 'true'
    const sync = (): void => {
      agentPanelStore.enabled = forcedOn || source.isEnabled()
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
    if (forcedOn) settle()
    else setTimeout(settle, FLAG_SETTLE_TIMEOUT_MS)
  } catch (error) {
    settle()
    reportError(error, { errorType: 'agent_flag_gate_load_failure' })
  }
}
