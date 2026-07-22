import { t } from '@/i18n'
import type {
  ExecutableLGraphNode,
  LGraph,
  LGraphNode
} from '@/lib/litegraph/src/litegraph'
import {
  ExecutableNodeDTO,
  LGraphEventMode
} from '@/lib/litegraph/src/litegraph'
import { WORKSPACE_PARTNER_NODE_DISABLED_TYPE } from '@/platform/errorCatalog/validationErrorResolver'
import { usePartnerNodeGovernanceStore } from '@/platform/workspace/stores/partnerNodeGovernanceStore'
import { useToastStore } from '@/platform/updates/common/toastStore'
import type { NodeError } from '@/schemas/apiSchema'
import { useExtensionService } from '@/services/extensionService'
import { registerQueuePromptGuard } from '@/services/queuePromptGuardService'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'
import type { NodeExecutionId } from '@/types/nodeIdentification'
import { tryNormalizeNodeExecutionId } from '@/types/nodeIdentification'
import { getNodeByExecutionId } from '@/utils/graphTraversalUtil'
import { isOutputNode } from '@/utils/nodeFilterUtil'

const QUEUE_GUARD_ID = 'workspace.partner-node-governance'
const POLICY_TOAST_GROUP = 'partner-node-policy'

interface DisabledPartnerNode {
  executionId: NodeExecutionId
  nodeType: string
  nodeTitle: string
}

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

function getDisabledPartnerNodes(
  graph: LGraph,
  queueNodeIds: readonly NodeExecutionId[] | undefined,
  isNodeDisabled: (nodeType: string) => boolean
): DisabledPartnerNode[] {
  const nodesByExecutionId = createExecutableNodeMap(graph)
  const visited = new Set<string>()
  const disabledNodes = new Map<NodeExecutionId, DisabledPartnerNode>()

  function visitDependency(executionId: string): void {
    if (visited.has(executionId)) return
    visited.add(executionId)

    const node = nodesByExecutionId.get(executionId)
    if (!node || node.isVirtualNode || isExcludedFromPrompt(node)) return
    const normalizedExecutionId = tryNormalizeNodeExecutionId(executionId)
    if (normalizedExecutionId && node.type && isNodeDisabled(node.type)) {
      const graphNode = getNodeByExecutionId(graph, normalizedExecutionId)
      disabledNodes.set(normalizedExecutionId, {
        executionId: normalizedExecutionId,
        nodeType: node.type,
        nodeTitle: graphNode?.title || node.title || node.type
      })
    }

    node.inputs.forEach((_input, index) => {
      const resolvedInput = node.resolveInput(index)
      if (resolvedInput && !resolvedInput.widgetInfo) {
        visitDependency(resolvedInput.origin_id)
      }
    })
  }

  if (queueNodeIds?.length) {
    for (const executionId of queueNodeIds) {
      const node = getNodeByExecutionId(graph, executionId)
      if (node && isOutputNode(node)) visitDependency(executionId)
    }
  } else {
    for (const executionId of nodesByExecutionId.keys()) {
      visitDependency(executionId)
    }
  }

  return [...disabledNodes.values()]
}

function createPolicyNodeErrors(
  disabledNodes: DisabledPartnerNode[]
): Record<string, NodeError> {
  const nodeErrors: Record<string, NodeError> = {}
  for (const node of disabledNodes) {
    nodeErrors[node.executionId] = {
      class_type: node.nodeType,
      dependent_outputs: [],
      errors: [
        {
          type: WORKSPACE_PARTNER_NODE_DISABLED_TYPE,
          message: t('workspacePanel.allowlist.runBlocked.nodeError'),
          details: '',
          extra_info: {}
        }
      ]
    }
  }
  return nodeErrors
}

function removePolicyNodeErrors(
  nodeErrors: Record<string, NodeError> | null
): Record<string, NodeError> | null {
  if (!nodeErrors) return nodeErrors

  let changed = false
  const remainingNodeErrors: Record<string, NodeError> = {}
  for (const [executionId, nodeError] of Object.entries(nodeErrors)) {
    const errors = nodeError.errors.filter(
      ({ type }) => type !== WORKSPACE_PARTNER_NODE_DISABLED_TYPE
    )
    if (errors.length !== nodeError.errors.length) changed = true
    if (errors.length > 0) {
      remainingNodeErrors[executionId] = { ...nodeError, errors }
    }
  }

  if (!changed) return nodeErrors
  return Object.keys(remainingNodeErrors).length > 0
    ? remainingNodeErrors
    : null
}

function mergePolicyNodeErrors(
  nodeErrors: Record<string, NodeError> | null,
  policyNodeErrors: Record<string, NodeError>
): Record<string, NodeError> {
  const mergedNodeErrors = { ...removePolicyNodeErrors(nodeErrors) }
  for (const [executionId, policyNodeError] of Object.entries(
    policyNodeErrors
  )) {
    const existingNodeError = mergedNodeErrors[executionId]
    mergedNodeErrors[executionId] = existingNodeError
      ? {
          ...existingNodeError,
          errors: [...existingNodeError.errors, ...policyNodeError.errors]
        }
      : policyNodeError
  }
  return mergedNodeErrors
}

useExtensionService().registerExtension({
  name: 'Comfy.Cloud.PartnerNodeGovernance',

  setup: () => {
    usePartnerNodeGovernanceStore()
    registerQueuePromptGuard(QUEUE_GUARD_ID, async (context) => {
      const executionErrorStore = useExecutionErrorStore()
      const governanceStore = usePartnerNodeGovernanceStore()
      if (governanceStore.status === 'loading') {
        await governanceStore.loadPolicy()
      }
      const isNodeDisabled = (nodeType: string) =>
        governanceStore.isNodeDisabled(nodeType)
      const disabledNodes = getDisabledPartnerNodes(
        context.rootGraph,
        context.queueNodeIds,
        isNodeDisabled
      )
      if (disabledNodes.length === 0) {
        const remainingNodeErrors = removePolicyNodeErrors(
          executionErrorStore.lastNodeErrors
        )
        if (remainingNodeErrors !== executionErrorStore.lastNodeErrors) {
          executionErrorStore.recordNodeErrors(remainingNodeErrors)
        }
        return true
      }

      executionErrorStore.recordNodeErrors(
        mergePolicyNodeErrors(
          executionErrorStore.lastNodeErrors,
          createPolicyNodeErrors(disabledNodes)
        )
      )
      const nodeNames = [
        ...new Set(disabledNodes.map((node) => node.nodeTitle))
      ]
      const messageParams = {
        count: disabledNodes.length,
        nodes: nodeNames.join(', ')
      }

      useToastStore().add({
        severity: 'error',
        summary: t(
          'workspacePanel.allowlist.runBlocked.summary',
          messageParams
        ),
        detail: t('workspacePanel.allowlist.runBlocked.detail', messageParams),
        group: POLICY_TOAST_GROUP,
        life: 8000
      })
      return false
    })
  }
})
