import { LGraphEventMode } from '@/lib/litegraph/src/types/globalEnums'
import type { ModelFile } from '@/platform/workflow/validation/schemas/workflowSchema'
import { getParentExecutionIds } from '@/types/nodeIdentification'
import type { FlattenableWorkflowNode } from './workflowFlattening'

type NodeModelMetadata = {
  type: string
  widgets_values?: readonly unknown[] | Record<string, unknown>
  properties?: { models?: readonly ModelFile[] }
}

export function getModelFileKey(
  model: Pick<ModelFile, 'name' | 'directory'>
): string {
  return JSON.stringify([model.name, model.directory])
}

export function getSelectedModelsMetadata(
  node: NodeModelMetadata
): ModelFile[] | undefined {
  const models = node.properties?.models
  if (!models?.length || !node.widgets_values) return

  const widgetValues = Array.isArray(node.widgets_values)
    ? node.widgets_values
    : Object.values(node.widgets_values)
  if (!widgetValues.length) return

  const selectedNames = new Set(
    widgetValues.filter(
      (value): value is string =>
        typeof value === 'string' && value.trim().length > 0
    )
  )

  return models.filter((model) => selectedNames.has(model.name))
}

export function isInactiveWorkflowNodeMode(mode: number | undefined): boolean {
  return mode === LGraphEventMode.NEVER || mode === LGraphEventMode.BYPASS
}

export function isNodeAndAncestorsActive(
  node: FlattenableWorkflowNode,
  nodesById: ReadonlyMap<string, FlattenableWorkflowNode>
): boolean {
  if (isInactiveWorkflowNodeMode(node.mode)) return false

  return getParentExecutionIds(String(node.id)).every(
    (ancestorId) => !isInactiveWorkflowNodeMode(nodesById.get(ancestorId)?.mode)
  )
}
