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
  const nodeModels = getDeclaredModels(node.properties?.models)

  // Selection keeps whatever a node declared, down to a bare name. A template
  // download needs the url and directory, so narrow back to the strict shape
  // here rather than widening what this module promises.
  const selected =
    getSelectedModelsMetadata({
      type: node.type,
      widgets_values: node.widgets_values,
      properties: { models: [...nodeModels, ...workflowModels] }
    }) ?? []

  return selected.flatMap((model) => {
    const strict = toModelFile(model)
    return strict ? [strict] : []
  })
}

export type TemplateModelRequirementDetail = {
  model: ModelFile
  usedBy: readonly string[]
}

function getNodeDisplayName(
  node: FlattenableWorkflowNode & { title?: unknown }
): string {
  const title = node.title
  if (typeof title === 'string' && title.trim()) return title.trim()

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
  workflow: FlattenableWorkflowGraph & { models?: unknown }
): readonly TemplateModelRequirementDetail[] {
  const workflowModels = getDeclaredModels(workflow.models)
  const nodes = flattenWorkflowNodes(workflow)
  const nodesById = new Map(nodes.map((node) => [String(node.id), node]))
  const nodeDetails = nodes
    .filter((node) => isNodeAndAncestorsActive(node, nodesById))
    .flatMap((node) => getSelectedNodeModelDetails(node, workflowModels))

  return mergeModelRequirementDetails(nodeDetails)
}
