import type { ResultItem } from '@/schemas/apiSchema'
import { createAnnotatedPath } from '@/utils/createAnnotatedPath'

import type { TemplateInfo } from '../types/template'

interface TransformableNode {
  id: string | number
  type: string
  widgets_values?: unknown
}

interface TransformableWorkflow {
  nodes: TransformableNode[]
}

interface NodeSelector {
  nodeId: string | number
  nodeType: string
}

function replaceWidgetValue(
  widgetValues: unknown,
  currentValue: unknown,
  nextValue: unknown
): unknown {
  if (Array.isArray(widgetValues)) {
    const matchingIndexes = widgetValues.flatMap((value, index) =>
      value === currentValue ? [index] : []
    )
    if (matchingIndexes.length !== 1)
      throw new Error('Expected one matching template widget value')

    return widgetValues.map((value, index) =>
      index === matchingIndexes[0] ? nextValue : value
    )
  }

  if (typeof widgetValues === 'object' && widgetValues !== null) {
    const entries = Object.entries(widgetValues)
    const matchingKeys = entries.flatMap(([key, value]) =>
      value === currentValue ? [key] : []
    )
    if (matchingKeys.length !== 1)
      throw new Error('Expected one matching template widget value')

    return Object.fromEntries(
      entries.map(([key, value]) => [
        key,
        key === matchingKeys[0] ? nextValue : value
      ])
    )
  }

  throw new Error('Template input node has no configurable widgets')
}

function replaceNodeWidgetValue<T extends TransformableWorkflow>(
  workflow: T,
  selector: NodeSelector,
  currentValue: unknown,
  nextValue: unknown
): T {
  const matchingNodes = workflow.nodes.filter(
    (node) =>
      node.type === selector.nodeType &&
      String(node.id) === String(selector.nodeId)
  )
  if (matchingNodes.length !== 1)
    throw new Error('Expected one matching template node')

  const target = matchingNodes[0]
  return {
    ...workflow,
    nodes: workflow.nodes.map((node) =>
      node === target
        ? {
            ...node,
            widgets_values: replaceWidgetValue(
              node.widgets_values,
              currentValue,
              nextValue
            )
          }
        : node
    )
  }
}

export function replaceTemplateImageInput<T extends TransformableWorkflow>(
  workflow: T,
  template: TemplateInfo,
  image: ResultItem
): T {
  if (!image.filename) throw new Error('Image output has no filename')

  const input = template.io?.inputs?.find(
    ({ mediaType }) => mediaType === 'image'
  )
  if (!input) throw new Error('Template has no declared image input')
  const hasNodeId =
    (typeof input.nodeId === 'number' && Number.isFinite(input.nodeId)) ||
    (typeof input.nodeId === 'string' && input.nodeId.length > 0)
  if (
    !hasNodeId ||
    typeof input.nodeType !== 'string' ||
    input.nodeType.length === 0 ||
    typeof input.file !== 'string' ||
    input.file.length === 0
  )
    throw new Error('Template image input declaration is invalid')

  return replaceNodeWidgetValue(
    workflow,
    { nodeId: input.nodeId, nodeType: input.nodeType },
    input.file,
    createAnnotatedPath({ ...image, type: image.type ?? 'output' })
  )
}
