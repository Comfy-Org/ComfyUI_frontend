import { createPostHogFlagSource } from '@/workbench/extensions/agent/composables/agent/useAgentFeatureGate'
import { registerWorkflowTabActivityTracker } from '@/workbench/extensions/agent/services/agent/workflowTabActivityTracker'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useExtensionService } from '@/services/extensionService'
import { useAgentNodeSelectionStore } from '@/stores/agentNodeSelectionStore'
import { toNodeId } from '@/types/nodeId'
import { isLGraphNode } from '@/utils/litegraphUtil'

useExtensionService().registerExtension({
  name: 'Comfy.AgentPanel',
  beforeLoadGraph(app) {
    const agentPanelStore = useAgentPanelStore()
    if (!agentPanelStore.isOpen) return

    const nodeSelectionStore = useAgentNodeSelectionStore()
    nodeSelectionStore.saveNodeIds(
      useWorkflowStore().activeWorkflow?.path,
      [...(app.canvas?.selectedItems ?? [])]
        .filter(isLGraphNode)
        .map((node) => String(node.id))
    )
    nodeSelectionStore.beginWorkflowLoad()
  },
  afterLoadGraph(app) {
    const agentPanelStore = useAgentPanelStore()
    const nodeSelectionStore = useAgentNodeSelectionStore()
    if (!agentPanelStore.isOpen || !nodeSelectionStore.isLoadingWorkflow) return

    const canvas = app.canvas
    const workflowPath = useWorkflowStore().activeWorkflow?.path
    const nodes = nodeSelectionStore
      .nodeIds(workflowPath)
      .map((id) => canvas?.graph?.getNodeById(toNodeId(id)))
      .filter(isLGraphNode)
    nodeSelectionStore.restoreNodeIds(nodes.map((node) => String(node.id)))
    canvas?.selectItems(nodes)
    useCanvasStore().updateSelectedItems()
  },
  setup() {
    const agentPanelStore = useAgentPanelStore()
    registerWorkflowTabActivityTracker()

    async function setupFlagGate(): Promise<void> {
      // posthog-js is a lazy chunk and is commonly blocked by ad blockers; a failed
      // load must leave the panel gated off rather than surface as an unhandled rejection.
      try {
        const posthog = (await import('posthog-js')).default
        const source = createPostHogFlagSource(posthog)
        const sync = (): void => {
          const forceInDev = import.meta.env.MODE === 'development'
          agentPanelStore.enabled = forceInDev || source.isEnabled()
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
