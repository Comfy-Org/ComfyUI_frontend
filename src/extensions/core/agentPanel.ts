import { watch } from 'vue'

import {
  ServerFeatureFlag,
  useFeatureFlags
} from '@/composables/useFeatureFlags'
import { registerWorkflowTabActivityTracker } from '@/workbench/extensions/agent/services/agent/workflowTabActivityTracker'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useExtensionService } from '@/services/extensionService'
import { useAgentNodeSelectionStore } from '@/stores/agentNodeSelectionStore'
import { getNodeByLocatorId } from '@/utils/graphTraversalUtil'
import { isLGraphNode } from '@/utils/litegraphUtil'

let registered = false

export function registerAgentPanelExtension(): void {
  if (registered) return
  registered = true

  useExtensionService().registerExtension({
    name: 'Comfy.AgentPanel',
    beforeLoadGraph() {
      const agentPanelStore = useAgentPanelStore()
      if (!agentPanelStore.isOpen) return

      const nodeSelectionStore = useAgentNodeSelectionStore()
      nodeSelectionStore.beginWorkflowLoad()
    },
    afterLoadGraph(app) {
      const agentPanelStore = useAgentPanelStore()
      const nodeSelectionStore = useAgentNodeSelectionStore()
      if (!nodeSelectionStore.isLoadingWorkflow) return
      if (!agentPanelStore.isOpen) {
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
      registerWorkflowTabActivityTracker()
      return setupFlagGate()
    }
  })
}

function setupFlagGate(): void {
  const agentPanelStore = useAgentPanelStore()
  const { featureFlag } = useFeatureFlags()
  const agentEnabled = featureFlag(
    ServerFeatureFlag.AGENT_IN_APP_EXPERIENCE,
    false
  )

  watch(
    agentEnabled,
    (enabled) => {
      const forceInDev = import.meta.env.MODE === 'development'
      agentPanelStore.enabled = forceInDev || enabled === true
    },
    { immediate: true }
  )

  if (!agentPanelStore.gateSettled) {
    agentPanelStore.gateSettled = true
  }
}

registerAgentPanelExtension()
