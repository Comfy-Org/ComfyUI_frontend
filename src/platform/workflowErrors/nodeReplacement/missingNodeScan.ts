import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { LGraph } from '@/lib/litegraph/src/litegraph'
import { LGraphEventMode } from '@comfyorg/graph-model/globalEnums'
import { updatePendingWarnings } from '@/platform/workflow/core/utils/pendingWarnings'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useNodeReplacementStore } from '@/platform/workflowErrors/nodeReplacement/nodeReplacementStore'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'
import { useMissingNodesErrorStore } from '@/platform/workflowErrors/nodeReplacement/missingNodesErrorStore'
import type { MissingNodeType } from '@/platform/workflowErrors/nodeReplacement/types'
import {
  collectAllNodes,
  getExecutionIdByNode
} from '@/utils/graphTraversalUtil'
import { getCnrIdFromNode } from '@/platform/workflowErrors/nodeReplacement/cnrIdUtil'

function replacementFieldsFor(nodeType: string) {
  const replacement = useNodeReplacementStore().getReplacementFor(nodeType)
  return {
    isReplaceable: replacement !== null,
    replacement: replacement ?? undefined
  }
}

function withCurrentReplacement(nodeType: MissingNodeType): MissingNodeType {
  if (typeof nodeType === 'string') return nodeType
  return { ...nodeType, ...replacementFieldsFor(nodeType.type) }
}

/** Scan the live graph for unregistered node types and build a full MissingNodeType list. */
function scanMissingNodes(rootGraph: LGraph): MissingNodeType[] {
  const missingNodeTypes: MissingNodeType[] = []

  const allNodes = collectAllNodes(rootGraph)

  for (const node of allNodes) {
    if (
      node.mode === LGraphEventMode.NEVER ||
      node.mode === LGraphEventMode.BYPASS
    )
      continue

    const originalType = node.last_serialization?.type ?? node.type

    if (originalType in LiteGraph.registered_node_types) continue

    const cnrId = getCnrIdFromNode(node)
    const executionId = getExecutionIdByNode(rootGraph, node)

    missingNodeTypes.push({
      type: originalType,
      nodeId: executionId ?? String(node.id),
      cnrId,
      ...replacementFieldsFor(originalType)
    })
  }

  return missingNodeTypes
}

/** Re-scan the graph for missing nodes and update the error store. */
export function rescanAndSurfaceMissingNodes(rootGraph: LGraph): void {
  const types = scanMissingNodes(rootGraph)
  if (useMissingNodesErrorStore().surfaceMissingNodes(types)) {
    useExecutionErrorStore().showErrorOverlay()
  }
}

/** Re-resolve replacements on surfaced and pending missing nodes, for replacements that loaded after the workflow. */
export function refreshMissingNodeReplacements(): void {
  const store = useMissingNodesErrorStore()
  const surfaced = store.missingNodesError?.nodeTypes
  if (surfaced) store.setMissingNodeTypes(surfaced.map(withCurrentReplacement))

  for (const workflow of useWorkflowStore().openWorkflows) {
    const pending = workflow.pendingWarnings?.missingNodeTypes
    if (!pending) continue
    updatePendingWarnings(workflow, {
      missingNodeTypes: pending.map(withCurrentReplacement)
    })
  }
}
