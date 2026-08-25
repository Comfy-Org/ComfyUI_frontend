import type { ResultItem } from '@/schemas/apiSchema'
import { createAnnotatedPath } from '@/utils/createAnnotatedPath'

import type { TemplateInfo, TemplateMediaInfo } from '../types/template'

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

interface SeedableMediaInput extends NodeSelector {
  file: string
}

function findImageInput(template: TemplateInfo) {
  return template.io?.inputs?.find(({ mediaType }) => mediaType === 'image')
}

function isSeedable(input: TemplateMediaInfo): input is SeedableMediaInput {
  const { nodeId, nodeType, file } = input
  const hasNodeId =
    typeof nodeId === 'number' ? Number.isFinite(nodeId) : Boolean(nodeId)
  return hasNodeId && Boolean(nodeType) && Boolean(file)
}

/**
 * Whether `replaceTemplateImageInput` has enough metadata to seed this
 * template, so a caller can hide an action rather than fail it on click.
 */
export function acceptsTemplateImageInput(template: TemplateInfo): boolean {
  const input = findImageInput(template)
  return input !== undefined && isSeedable(input)
}

/**
 * Continues `image` into `template` by rewriting the widget value its declared
 * image input currently holds.
 *
 * The declared node has to live in `workflow.nodes`: a node nested inside
 * `definitions.subgraphs` is not reachable from `io.inputs`, and a template
 * that declares one throws here rather than loading unseeded.
 */
export function replaceTemplateImageInput<T extends TransformableWorkflow>(
  workflow: T,
  template: TemplateInfo,
  image: ResultItem
): T {
  if (!image.filename) throw new Error('Image output has no filename')

  const input = findImageInput(template)
  if (!input) throw new Error('Template has no declared image input')
  if (!isSeedable(input))
    throw new Error('Template image input declaration is invalid')

  return replaceNodeWidgetValue(
    workflow,
    { nodeId: input.nodeId, nodeType: input.nodeType },
    input.file,
    createAnnotatedPath({ ...image, type: image.type ?? 'output' })
  )
}
