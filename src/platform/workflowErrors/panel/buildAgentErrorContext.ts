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

/** Missing-resource sub-groups `useErrorGroups` derives alongside `ErrorGroup[]`. */
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
      nodeId: card.graphNodeId ?? card.rawNodeId,
      nodeType: card.title,
      nodeTitle: card.nodeTitle
    }))
  )
}

function missingModelProblems(
  groups: MissingModelGroup[]
): AgentErrorProblem[] {
  return groups.flatMap((group) =>
    group.models.flatMap((model) => {
      const directory = group.directory ? ` in ${group.directory}` : ''
      const message = `Missing model "${model.name}"${directory}`
      if (model.referencingNodes.length === 0)
        return [{ category: 'missing_model' as const, message }]
      return model.referencingNodes.map((reference) => ({
        category: 'missing_model' as const,
        message: `${message} (widget ${reference.widgetName})`,
        nodeId: String(reference.nodeId),
        nodeType: reference.nodeType ?? model.representative.nodeType
      }))
    })
  )
}

function missingMediaProblems(
  groups: MissingMediaGroup[]
): AgentErrorProblem[] {
  return groups.flatMap((group) =>
    group.items.flatMap((item) => {
      const message = `Missing ${group.mediaType} input "${item.name}"`
      if (item.referencingNodes.length === 0)
        return [
          {
            category: 'missing_media' as const,
            message,
            nodeType: item.representative.nodeType
          }
        ]
      return item.referencingNodes.map((reference) => ({
        category: 'missing_media' as const,
        message: `${message} (widget ${reference.widgetName})`,
        nodeId: String(reference.nodeId),
        nodeType: reference.nodeType ?? item.representative.nodeType
      }))
    })
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

/** Context for a single issue card (one `ErrorGroup`). */
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

/** Context for every currently listed issue (overview footer action). */
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
