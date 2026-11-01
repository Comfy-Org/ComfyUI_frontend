import type { SerializedNodeId } from '@comfyorg/graph-model/nodeId'
import type { MissingMediaGroup } from '@/platform/workflowErrors/missingMedia/types'
import type { MissingModelGroup } from '@/platform/workflowErrors/missingModel/types'
import type {
  AgentErrorContext,
  AgentErrorContextScope,
  AgentErrorContextSeverity,
  AgentErrorProblem
} from '@/platform/workflowErrors/agentErrorContext'

import type { MissingPackGroup, SwapNodeGroup } from './useErrorGroups'
import type { ErrorCardData, ErrorGroup, ErrorItem } from './types'

export interface MissingGroupContext {
  missingPackGroups: MissingPackGroup[]
  swapNodeGroups: SwapNodeGroup[]
  missingModelGroups: MissingModelGroup[]
  missingMediaGroups: MissingMediaGroup[]
}

interface BuildOptions {
  workflowName?: string
}

function problemMessage(error: ErrorItem): string {
  const base = error.message || error.displayMessage || error.displayTitle || ''
  if (error.displayItemLabel && !base.includes(error.displayItemLabel))
    return `${base} [input: ${error.displayItemLabel}]`.trim()
  return base.trim()
}

function executionProblems(cards: ErrorCardData[]): AgentErrorProblem[] {
  return cards.flatMap((card) =>
    card.errors.map((error) => ({
      category: error.isRuntimeError
        ? ('execution_failure' as const)
        : ('validation' as const),
      message: problemMessage(error),
      details: error.details ?? error.displayDetails,
      nodeId: card.nodeId ?? card.graphNodeId ?? card.rawNodeId,
      nodeType: card.title,
      nodeTitle: card.nodeTitle
    }))
  )
}

interface NodeUse {
  nodeId: SerializedNodeId
  widgetName: string
}

function usedBy(references: NodeUse[]): string {
  if (references.length === 1) return ` (widget ${references[0].widgetName})`
  const uses = references.map(
    (reference) => `node #${reference.nodeId} widget ${reference.widgetName}`
  )
  return ` (used by ${uses.join(', ')})`
}

function resourceProblem(
  category: 'missing_model' | 'missing_media',
  message: string,
  references: NodeUse[],
  nodeType: string | undefined
): AgentErrorProblem {
  if (references.length === 0) return { category, message, nodeType }
  const problem: AgentErrorProblem = {
    category,
    message: `${message}${usedBy(references)}`
  }
  if (references.length !== 1) return problem
  return { ...problem, nodeId: String(references[0].nodeId), nodeType }
}

function missingModelProblems(
  groups: MissingModelGroup[]
): AgentErrorProblem[] {
  return groups.flatMap((group) =>
    group.models.map((model) => {
      const directory = group.directory ? ` in ${group.directory}` : ''
      const [only] = model.referencingNodes
      const nodeType =
        model.referencingNodes.length === 1 &&
        String(only.nodeId) === String(model.representative.nodeId)
          ? model.representative.nodeType
          : undefined
      return resourceProblem(
        'missing_model',
        `Missing model "${model.name}"${directory}`,
        model.referencingNodes,
        nodeType
      )
    })
  )
}

function missingMediaProblems(
  groups: MissingMediaGroup[]
): AgentErrorProblem[] {
  return groups.flatMap((group) =>
    group.items.map((item) =>
      resourceProblem(
        'missing_media',
        `Missing ${group.mediaType} input "${item.name}"`,
        item.referencingNodes,
        item.referencingNodes[0]?.nodeType ?? item.representative.nodeType
      )
    )
  )
}

function missingNodeTypeProblems(
  groups: MissingPackGroup[] | SwapNodeGroup[],
  suffix: string
): AgentErrorProblem[] {
  return groups.flatMap((group) =>
    group.nodeTypes.map((nodeType) => {
      const type = typeof nodeType === 'string' ? nodeType : nodeType.type
      const nodeId =
        typeof nodeType === 'string' || nodeType.nodeId == null
          ? undefined
          : String(nodeType.nodeId)
      return {
        category: 'missing_node' as const,
        message: `Missing node type "${type}"${suffix}`,
        nodeId,
        nodeType: type
      }
    })
  )
}

function problemsForGroup(
  group: ErrorGroup,
  context: MissingGroupContext
): AgentErrorProblem[] {
  switch (group.type) {
    case 'execution':
      return executionProblems(group.cards)
    case 'missing_model':
      return missingModelProblems(context.missingModelGroups)
    case 'missing_media':
      return missingMediaProblems(context.missingMediaGroups)
    case 'missing_node':
      return missingNodeTypeProblems(
        context.missingPackGroups,
        ' is not installed'
      )
    case 'swap_nodes':
      return missingNodeTypeProblems(
        context.swapNodeGroups,
        ' (a replacement is available)'
      )
  }
}

function severityFor(group: ErrorGroup): AgentErrorContextSeverity {
  return group.severity === 'error' ? 'error' : 'warning'
}

export function buildGroupErrorContext(
  group: ErrorGroup,
  context: MissingGroupContext,
  options: BuildOptions = {}
): AgentErrorContext {
  const problems = problemsForGroup(group, context)
  return {
    scope: 'card',
    count: problems.length,
    problems,
    label: group.displayTitle,
    severity: severityFor(group),
    workflowName: options.workflowName
  }
}

interface BuildAllOptions extends BuildOptions {
  label: string
  scope?: AgentErrorContextScope
}

export function buildAllErrorContext(
  groups: ErrorGroup[],
  context: MissingGroupContext,
  options: BuildAllOptions
): AgentErrorContext {
  const problems = groups.flatMap((group) => problemsForGroup(group, context))
  const severity: AgentErrorContextSeverity = groups.some(
    (group) => group.severity === 'error'
  )
    ? 'error'
    : 'warning'
  return {
    scope: options.scope ?? 'all',
    count: problems.length,
    problems,
    label: options.label,
    severity,
    workflowName: options.workflowName
  }
}
