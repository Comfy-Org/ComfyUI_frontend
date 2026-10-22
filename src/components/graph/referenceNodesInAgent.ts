import type { AgentPanelOpenedMetadata } from '@/platform/telemetry/types'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import type { NodeId } from '@/types/nodeId'
import { isLGraphNode } from '@/utils/litegraphUtil'
import type { SelectedNode } from '@/workbench/extensions/agent/composables/agent/useCanvasSelection'
import { selectedNodeKey } from '@/workbench/extensions/agent/composables/agent/useCanvasSelection'
import { useAgentComposerStore } from '@/workbench/extensions/agent/stores/agent/agentComposerStore'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'

function resolveNodes(nodeIds: readonly NodeId[]): SelectedNode[] {
  const canvasStore = useCanvasStore()
  const workflowStore = useWorkflowStore()
  const graph = canvasStore.currentGraph
  const selectedById = new Map(
    canvasStore.selectedItems
      .filter(isLGraphNode)
      .map((node) => [node.id, node] as const)
  )
  const resolved: SelectedNode[] = []
  const seen = new Set<NodeId>()

  for (const id of nodeIds) {
    if (seen.has(id)) continue
    const node = selectedById.get(id) ?? graph?.getNodeById(id)
    if (!node) continue
    seen.add(id)
    resolved.push({
      id: String(node.id),
      locatorId: workflowStore.nodeToNodeLocatorId(node),
      title: node.title || node.type
    })
  }
  return resolved
}

/**
 * Adds each node as a composer reference chip, focuses the composer after the
 * last chip, and opens the agent panel if it is closed.
 */
export function referenceNodesInAgent(
  nodeIds: readonly NodeId[],
  source: AgentPanelOpenedMetadata['source'] = 'selection_toolbox'
): boolean {
  const panel = useAgentPanelStore()
  if (!panel.enabled) return false

  const nodes = resolveNodes(nodeIds)
  if (nodes.length === 0) return false

  const workflow = useWorkflowStore().activeWorkflow
  if (!workflow) return false

  panel.setWorkflowTarget(workflow)
  const composer = useAgentComposerStore()
  composer.setNodeScope(workflow.instanceId)
  const existingKeys = new Set(composer.nodes.map(selectedNodeKey))
  composer.setNodes([
    ...composer.nodes,
    ...nodes.filter((node) => !existingKeys.has(selectedNodeKey(node)))
  ])
  composer.requestEditorFocus()
  if (!panel.isOpen) panel.open(source)
  return true
}
