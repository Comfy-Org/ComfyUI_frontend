import { t } from '@/i18n'
import type {
  ExecutableLGraphNode,
  LGraph,
  LGraphNode,
  Subgraph
} from '@/lib/litegraph/src/litegraph'
import { ExecutableNodeDTO } from '@/lib/litegraph/src/litegraph'
import { LGraphEventMode } from '@/lib/litegraph/src/types/globalEnums'
import { usePartnerNodeGovernanceStore } from '@/platform/workspace/stores/partnerNodeGovernanceStore'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { useExtensionService } from '@/services/extensionService'
import { registerQueuePromptGuard } from '@/services/queuePromptGuardService'
import type { NodeExecutionId } from '@/types/nodeIdentification'
import { getNodeByExecutionId } from '@/utils/graphTraversalUtil'
import { isOutputNode } from '@/utils/nodeFilterUtil'

const QUEUE_GUARD_ID = 'workspace.partner-node-governance'

function isExcludedFromPrompt(node: Pick<LGraphNode, 'mode'>): boolean {
  return (
    node.mode === LGraphEventMode.NEVER || node.mode === LGraphEventMode.BYPASS
  )
}

function createExecutableNodeMap(
  graph: LGraph
): Map<string, ExecutableLGraphNode> {
  const nodesByExecutionId = new Map<string, ExecutableLGraphNode>()
  for (const node of graph.computeExecutionOrder(false)) {
    const nodeDto = new ExecutableNodeDTO(node, [], nodesByExecutionId)
    nodesByExecutionId.set(nodeDto.id, nodeDto)
    if (isExcludedFromPrompt(node)) continue

    for (const innerNode of nodeDto.getInnerNodes()) {
      nodesByExecutionId.set(innerNode.id, innerNode)
    }
  }
  return nodesByExecutionId
}

function hasDisabledPartnerNodeInPartialExecution(
  graph: LGraph,
  queueNodeIds: readonly NodeExecutionId[],
  isNodeDisabled: (nodeType: string) => boolean
): boolean {
  const nodesByExecutionId = createExecutableNodeMap(graph)
  const visited = new Set<string>()

  function hasDisabledDependency(executionId: string): boolean {
    if (visited.has(executionId)) return false
    visited.add(executionId)

    const node = nodesByExecutionId.get(executionId)
    if (!node || node.isVirtualNode || isExcludedFromPrompt(node)) return false
    if (node.type && isNodeDisabled(node.type)) return true

    return node.inputs.some((_input, index) => {
      const resolvedInput = node.resolveInput(index)
      return (
        !!resolvedInput &&
        !resolvedInput.widgetInfo &&
        hasDisabledDependency(resolvedInput.origin_id)
      )
    })
  }

  return queueNodeIds.some((executionId) => {
    const node = getNodeByExecutionId(graph, executionId)
    return !!node && isOutputNode(node) && hasDisabledDependency(executionId)
  })
}

function hasDisabledPartnerNode(
  graph: LGraph | Subgraph,
  isNodeDisabled: (nodeType: string) => boolean
): boolean {
  return graph.nodes.some((node) => {
    if (isExcludedFromPrompt(node)) return false
    if (
      node.isSubgraphNode?.() &&
      node.subgraph &&
      hasDisabledPartnerNode(node.subgraph, isNodeDisabled)
    ) {
      return true
    }
    return !!node.type && isNodeDisabled(node.type)
  })
}

useExtensionService().registerExtension({
  name: 'Comfy.Cloud.PartnerNodeGovernance',

  setup: () => {
    usePartnerNodeGovernanceStore()
    registerQueuePromptGuard(QUEUE_GUARD_ID, async (context) => {
      const governanceStore = usePartnerNodeGovernanceStore()
      if (governanceStore.status === 'loading') {
        await governanceStore.loadPolicy()
      }
      const isNodeDisabled = (nodeType: string) =>
        governanceStore.isNodeDisabled(nodeType)
      const isBlocked = context.queueNodeIds?.length
        ? hasDisabledPartnerNodeInPartialExecution(
            context.rootGraph,
            context.queueNodeIds,
            isNodeDisabled
          )
        : hasDisabledPartnerNode(context.rootGraph, isNodeDisabled)
      if (!isBlocked) return true

      useToastStore().add({
        severity: 'error',
        summary: t('workspacePanel.allowlist.runBlocked.summary'),
        detail: t('workspacePanel.allowlist.runBlocked.detail'),
        life: 6000
      })
      return false
    })
  }
})
