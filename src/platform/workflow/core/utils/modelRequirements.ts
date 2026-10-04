import { LGraphEventMode } from '@/lib/litegraph/src/types/globalEnums'
import type { DeclaredModelFile } from '@/platform/workflow/validation/schemas/workflowSchema'
import { zDeclaredModelFile } from '@/platform/workflow/validation/schemas/workflowSchema'
import { getParentExecutionIds } from '@/types/nodeIdentification'
import type { FlattenableWorkflowNode } from './workflowFlattening'

type NodeModelMetadata = {
  type: string
  widgets_values?: readonly unknown[] | Record<string, unknown>
  /**
   * `models` is whatever the workflow carried. The legacy schema passes it
   * through unparsed, so nothing upstream has checked that it is an array, or
   * that its entries are model records.
   */
  properties?: { models?: unknown }
}

function declaredModels(models: unknown): DeclaredModelFile[] {
  if (!Array.isArray(models)) return []
  return models.flatMap((entry) => {
    const model = zDeclaredModelFile.safeParse(entry)
    return model.success ? [model.data] : []
  })
}

/**
 * The declared models a node actually has selected in its widgets.
 *
 * Returns `undefined` when there is nothing to match against - the node
 * declares no models, or carries no widget values to select them with - and
 * an empty array when it declares models but none of them are selected.
 * Callers that only care whether a node contributes requirements can treat
 * both as "nothing"; callers that distinguish "no metadata" from "metadata
 * that matched nothing" have to check for `undefined`.
 */
export function getSelectedModelsMetadata(
  node: NodeModelMetadata
): DeclaredModelFile[] | undefined {
  const models = declaredModels(node.properties?.models)
  if (!models.length || !node.widgets_values) return

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
