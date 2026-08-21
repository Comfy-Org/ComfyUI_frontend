import type {
  FlattenableWorkflowGraph,
  FlattenableWorkflowNode
} from '@/platform/workflow/core/utils/workflowFlattening'
import { flattenWorkflowNodes } from '@/platform/workflow/core/utils/workflowFlattening'
import type { ModelFile } from '@/platform/workflow/validation/schemas/workflowSchema'

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object'
}

function isFlattenableNode(value: unknown): value is FlattenableWorkflowNode {
  if (!isRecord(value)) return false

  return (
    (typeof value.id === 'string' || typeof value.id === 'number') &&
    typeof value.type === 'string'
  )
}

function getRootNodes(workflow: Record<string, unknown>) {
  return Array.isArray(workflow.nodes)
    ? workflow.nodes.filter(isFlattenableNode)
    : []
}

function getSubgraphDefinitions(workflow: Record<string, unknown>) {
  const definitions = workflow.definitions
  if (!isRecord(definitions) || !Array.isArray(definitions.subgraphs)) {
    return []
  }

  return definitions.subgraphs
}

function toFlattenableWorkflow(
  workflow: Record<string, unknown>
): FlattenableWorkflowGraph {
  return {
    nodes: getRootNodes(workflow),
    definitions: { subgraphs: getSubgraphDefinitions(workflow) }
  }
}

function toModelFile(value: unknown): ModelFile | undefined {
  if (!isRecord(value)) return
  if (
    typeof value.name !== 'string' ||
    typeof value.url !== 'string' ||
    typeof value.directory !== 'string'
  ) {
    return
  }
  if (value.hash !== undefined && typeof value.hash !== 'string') return
  if (value.hash_type !== undefined && typeof value.hash_type !== 'string') {
    return
  }

  return {
    name: value.name,
    url: value.url,
    directory: value.directory,
    ...(value.hash !== undefined && { hash: value.hash }),
    ...(value.hash_type !== undefined && { hash_type: value.hash_type })
  }
}

function getDeclaredModels(value: unknown): ModelFile[] {
  if (!Array.isArray(value)) return []

  return value.flatMap((candidate) => {
    const model = toModelFile(candidate)
    return model ? [model] : []
  })
}

function getSelectedModelNames(value: unknown): Set<string> {
  const widgetValues = Array.isArray(value)
    ? value
    : isRecord(value)
      ? Object.values(value)
      : []

  return new Set(
    widgetValues.filter(
      (widgetValue): widgetValue is string =>
        typeof widgetValue === 'string' && widgetValue.trim().length > 0
    )
  )
}

function getSelectedNodeModels(node: FlattenableWorkflowNode): ModelFile[] {
  if (!isRecord(node.properties)) return []

  const selectedModelNames = getSelectedModelNames(node.widgets_values)
  if (selectedModelNames.size === 0) return []

  return getDeclaredModels(node.properties.models).filter((model) =>
    selectedModelNames.has(model.name)
  )
}

export type TemplateModelRequirementDetail = {
  model: ModelFile
  usedBy: readonly string[]
}

function getNodeDisplayName(node: FlattenableWorkflowNode): string {
  if (isRecord(node)) {
    const title = node.title
    if (typeof title === 'string' && title.trim()) return title.trim()
  }

  return node.type
}

function getSelectedNodeModelDetails(
  node: FlattenableWorkflowNode
): TemplateModelRequirementDetail[] {
  const usedBy = getNodeDisplayName(node)
  return getSelectedNodeModels(node).map((model) => ({
    model,
    usedBy: [usedBy]
  }))
}

function mergeModelRequirementDetails(
  details: readonly TemplateModelRequirementDetail[]
): TemplateModelRequirementDetail[] {
  const aggregates = new Map<
    string,
    {
      model: ModelFile
      usedBy: string[]
      seenUsedBy: Set<string>
    }
  >()

  for (const { model, usedBy } of details) {
    const key = JSON.stringify([model.name, model.directory])
    const existing = aggregates.get(key)
    if (!existing) {
      aggregates.set(key, {
        model,
        usedBy: [...usedBy],
        seenUsedBy: new Set(usedBy)
      })
      continue
    }

    for (const nodeName of usedBy) {
      if (existing.seenUsedBy.has(nodeName)) continue

      existing.seenUsedBy.add(nodeName)
      existing.usedBy.push(nodeName)
    }
  }

  return [...aggregates.values()].map(({ model, usedBy }) => ({
    model,
    usedBy
  }))
}

/**
 * Preserves declaration precedence and stable usage order while merging the
 * same model selected by multiple nodes.
 */
export function extractTemplateModelRequirementDetails(
  workflow: unknown
): readonly TemplateModelRequirementDetail[] {
  if (!isRecord(workflow)) return []

  const nodeDetails = flattenWorkflowNodes(
    toFlattenableWorkflow(workflow)
  ).flatMap(getSelectedNodeModelDetails)
  const topLevelDetails = getDeclaredModels(workflow.models).map((model) => ({
    model,
    usedBy: []
  }))

  return mergeModelRequirementDetails([...nodeDetails, ...topLevelDetails])
}

export function extractTemplateModelRequirements(
  workflow: unknown
): readonly ModelFile[] {
  return extractTemplateModelRequirementDetails(workflow).map(
    ({ model }) => model
  )
}
