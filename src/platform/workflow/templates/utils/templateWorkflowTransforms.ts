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

type TemplateTransformResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string }

/**
 * Both serializations of `widgets_values` — the positional array and the
 * name-keyed object — replace the one entry holding the template's declared
 * file, so they differ only in how the entries are taken apart and put back.
 */
function replaceWidgetValue(
  widgetValues: unknown,
  currentValue: unknown,
  nextValue: unknown
): TemplateTransformResult<unknown> {
  const isArray = Array.isArray(widgetValues)
  if (!isArray && (typeof widgetValues !== 'object' || widgetValues === null))
    return {
      ok: false,
      error: 'Template input node has no configurable widgets'
    }

  const entries = Object.entries(widgetValues)
  const matches = entries.filter(([, value]) => value === currentValue)
  if (matches.length !== 1)
    return { ok: false, error: 'Expected one matching template widget value' }

  const [matchedKey] = matches[0]
  const replaced = entries.map(([key, value]) => [
    key,
    key === matchedKey ? nextValue : value
  ])
  return {
    ok: true,
    value: isArray
      ? replaced.map(([, value]) => value)
      : Object.fromEntries(replaced)
  }
}

function replaceNodeWidgetValue<T extends TransformableWorkflow>(
  workflow: T,
  selector: NodeSelector,
  currentValue: unknown,
  nextValue: unknown
): TemplateTransformResult<T> {
  // The fetched JSON is unvalidated, so say what is wrong with it rather than
  // letting a served error page reach `.filter` as an anonymous TypeError.
  if (!Array.isArray(workflow.nodes))
    return { ok: false, error: 'Template workflow has no nodes' }

  const matchingNodes = workflow.nodes.filter(
    (node) =>
      node.type === selector.nodeType &&
      String(node.id) === String(selector.nodeId)
  )
  if (matchingNodes.length !== 1)
    return { ok: false, error: 'Expected one matching template node' }

  const target = matchingNodes[0]
  const replaced = replaceWidgetValue(
    target.widgets_values,
    currentValue,
    nextValue
  )
  if (!replaced.ok) return replaced

  return {
    ok: true,
    value: {
      ...workflow,
      nodes: workflow.nodes.map((node) =>
        node === target ? { ...node, widgets_values: replaced.value } : node
      )
    }
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
 * that declares one receives a failure result rather than loading unseeded.
 */
export function replaceTemplateImageInput<T extends TransformableWorkflow>(
  workflow: T,
  template: TemplateInfo,
  image: ResultItem
): TemplateTransformResult<T> {
  if (!image.filename)
    return { ok: false, error: 'Image output has no filename' }

  const input = findImageInput(template)
  if (!input)
    return { ok: false, error: 'Template has no declared image input' }
  if (!isSeedable(input))
    return { ok: false, error: 'Template image input declaration is invalid' }

  return replaceNodeWidgetValue(
    workflow,
    { nodeId: input.nodeId, nodeType: input.nodeType },
    input.file,
    createAnnotatedPath({ ...image, type: image.type ?? 'output' })
  )
}
