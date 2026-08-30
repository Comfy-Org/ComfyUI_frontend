import { registerWorkflowTabActivityTracker } from '@/workbench/extensions/agent/services/agent/workflowTabActivityTracker'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'
import { useAgentFeatureGate } from '@/workbench/extensions/agent/composables/agent/useAgentFeatureGate'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useExtensionService } from '@/services/extensionService'
import { useAgentNodeSelectionStore } from '@/stores/agentNodeSelectionStore'
import { getNodeByLocatorId } from '@/utils/graphTraversalUtil'
import { isLGraphNode } from '@/utils/litegraphUtil'
import type { Ref } from 'vue'
import { watch } from 'vue'

let registered = false
let agentEnabled: Readonly<Ref<boolean>> | null = null

export function registerAgentPanelExtension(): void {
  if (registered) return
  registered = true

  useExtensionService().registerExtension({
    name: 'Comfy.AgentPanel',
    beforeLoadGraph() {
      if (agentEnabled?.value !== true) return
      const agentPanelStore = useAgentPanelStore()
      if (!agentPanelStore.isOpen) return

      const nodeSelectionStore = useAgentNodeSelectionStore()
      nodeSelectionStore.beginWorkflowLoad()
    },
    afterLoadGraph(app) {
      if (agentEnabled?.value !== true) return
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
      agentEnabled = useAgentFeatureGate()
      let agentPanelStore: ReturnType<typeof useAgentPanelStore> | null = null
      let stopTracker: (() => void) | null = null
      watch(
        agentEnabled,
        (enabled) => {
          if (enabled) {
            agentPanelStore ??= useAgentPanelStore()
            agentPanelStore.enabled = true
            agentPanelStore.gateSettled = true
            stopTracker ??= registerWorkflowTabActivityTracker()
            return
          }
          stopTracker?.()
          stopTracker = null
          if (agentPanelStore !== null) agentPanelStore.enabled = false
        },
        { immediate: true }
      )
    }
  })
}

registerAgentPanelExtension()
