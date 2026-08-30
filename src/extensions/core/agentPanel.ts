import { watch } from 'vue'

import { useAgentFeatureGate } from '@/workbench/extensions/agent/composables/agent/useAgentFeatureGate'
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
  const featureEnabled = useAgentFeatureGate()
  let agentPanelStore: ReturnType<typeof useAgentPanelStore> | null = null
  let disposeTracker: (() => void) | null = null

  useExtensionService().registerExtension({
    name: 'Comfy.AgentPanel',
    beforeLoadGraph() {
      if (!featureEnabled.value) return
      agentPanelStore ??= useAgentPanelStore()
      if (!agentPanelStore.isOpen) return

      const nodeSelectionStore = useAgentNodeSelectionStore()
      nodeSelectionStore.beginWorkflowLoad()
    },
    afterLoadGraph(app) {
      if (!featureEnabled.value) return
      agentPanelStore ??= useAgentPanelStore()
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
      watch(
        featureEnabled,
        (enabled) => {
          if (enabled) {
            agentPanelStore ??= useAgentPanelStore()
            agentPanelStore.enabled = true
            agentPanelStore.gateSettled = true
            disposeTracker ??=
              registerWorkflowTabActivityTracker(featureEnabled)
          } else if (agentPanelStore) {
            agentPanelStore.enabled = false
            disposeTracker?.()
            disposeTracker = null
          }
        },
        { immediate: true }
      )
    }
  })
}
