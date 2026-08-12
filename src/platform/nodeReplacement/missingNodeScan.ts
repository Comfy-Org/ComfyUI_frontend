import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { LGraph } from '@/lib/litegraph/src/litegraph'
import { LGraphEventMode } from '@/lib/litegraph/src/types/globalEnums'
import { useNodeReplacementStore } from '@/platform/nodeReplacement/nodeReplacementStore'
import { useWorkflowService } from '@/platform/workflow/core/services/workflowService'
import {
  replacePendingMissingNodeTypes,
  updatePendingWarnings
} from '@/platform/workflow/core/utils/pendingWarnings'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import type { MissingNodeType } from '@/types/comfy'
import {
  collectAllNodes,
  getExecutionIdByNode
} from '@/utils/graphTraversalUtil'
import { getCnrIdFromNode } from '@/platform/nodeReplacement/cnrIdUtil'

/** Scan the live graph for unregistered node types and build a full MissingNodeType list. */
function scanMissingNodes(rootGraph: LGraph): MissingNodeType[] {
  const nodeReplacementStore = useNodeReplacementStore()
  const missingNodeTypes: MissingNodeType[] = []

  const allNodes = collectAllNodes(rootGraph)

  for (const node of allNodes) {
    if (
      node.mode === LGraphEventMode.NEVER ||
      node.mode === LGraphEventMode.BYPASS
    )
      continue

    const originalType = node.last_serialization?.type ?? node.type ?? 'Unknown'

    if (originalType in LiteGraph.registered_node_types) continue

    const cnrId = getCnrIdFromNode(node)
    const replacement = nodeReplacementStore.getReplacementFor(originalType)
    const executionId = getExecutionIdByNode(rootGraph, node)

    missingNodeTypes.push({
      type: originalType,
      nodeId: executionId ?? String(node.id),
      cnrId,
      isReplaceable: replacement !== null,
      replacement: replacement ?? undefined
    })
  }

  return missingNodeTypes
}

/** Re-scan the graph and project its missing nodes from pending warnings. */
export function rescanAndSurfaceMissingNodes(rootGraph: LGraph): void {
  const types = scanMissingNodes(rootGraph)
  const activeWorkflow = useWorkflowStore().activeWorkflow
  updatePendingWarnings(activeWorkflow, {
    missingNodeTypes: replacePendingMissingNodeTypes(types)
  })
  useWorkflowService().showPendingWarnings(activeWorkflow, {
    missingNodesOnly: true
  })
}
