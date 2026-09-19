import type {
  FlattenableWorkflowGraph,
  FlattenableWorkflowNode
} from '@/platform/workflow/core/utils/workflowFlattening'
import { flattenWorkflowNodes } from '@/platform/workflow/core/utils/workflowFlattening'
import {
  getModelFileKey,
  getSelectedModelsMetadata,
  isNodeAndAncestorsActive
} from '@/platform/workflow/core/utils/modelRequirements'
import type { ModelFile } from '@/platform/workflow/validation/schemas/workflowSchema'
import { zModelFile } from '@/platform/workflow/validation/schemas/workflowSchema'

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
  const result = zModelFile.safeParse(value)
  return result.success ? result.data : undefined
}

function getDeclaredModels(value: unknown): ModelFile[] {
  if (!Array.isArray(value)) return []

  return value.flatMap((candidate) => {
    const model = toModelFile(candidate)
    return model ? [model] : []
  })
}

function getSelectedNodeModels(
  node: FlattenableWorkflowNode,
  workflowModels: readonly ModelFile[]
): ModelFile[] {
  const nodeModels = isRecord(node.properties)
    ? getDeclaredModels(node.properties.models)
    : []

  return (
    getSelectedModelsMetadata({
      type: node.type,
      widgets_values: node.widgets_values,
      properties: { models: [...nodeModels, ...workflowModels] }
    }) ?? []
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
  node: FlattenableWorkflowNode,
  workflowModels: readonly ModelFile[]
): TemplateModelRequirementDetail[] {
  const usedBy = getNodeDisplayName(node)
  return getSelectedNodeModels(node, workflowModels).map((model) => ({
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
    const key = getModelFileKey(model)
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

  const workflowModels = getDeclaredModels(workflow.models)
  const nodes = flattenWorkflowNodes(toFlattenableWorkflow(workflow))
  const nodesById = new Map(nodes.map((node) => [String(node.id), node]))
  const nodeDetails = nodes
    .filter((node) => isNodeAndAncestorsActive(node, nodesById))
    .flatMap((node) => getSelectedNodeModelDetails(node, workflowModels))

  return mergeModelRequirementDetails(nodeDetails)
}
