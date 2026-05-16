import { isEqual } from 'es-toolkit/compat'

import type {
  ComfyNode,
  ComfyWorkflowJSON
} from '@/platform/workflow/validation/schemas/workflowSchema'

import type { TemplateChangeType } from '../types'

const SEED_WIDGET_NAME_PATTERN = /(^|_)seed($|_)|noise_seed/i
const PROMPT_WIDGET_NAME_PATTERN = /(^|_)(prompt|text|positive|negative)($|_)/i

export type LiveWidgetInfo = {
  name?: string
  type?: string
}

export type LiveNodeInfo = {
  widgets?: LiveWidgetInfo[]
}

export type LiveNodeLookup = Map<string | number, LiveNodeInfo>

type WidgetKind = 'seed' | 'prompt' | 'other'

function widgetKind(widget: LiveWidgetInfo | undefined): WidgetKind {
  const name = widget?.name
  if (!name) return 'other'
  if (SEED_WIDGET_NAME_PATTERN.test(name)) return 'seed'
  if (PROMPT_WIDGET_NAME_PATTERN.test(name)) return 'prompt'
  return 'other'
}

function nodesById(
  workflow: ComfyWorkflowJSON
): Map<string | number, ComfyNode> {
  const map = new Map<string | number, ComfyNode>()
  for (const node of workflow.nodes ?? []) {
    if (node?.id !== undefined) map.set(node.id, node as ComfyNode)
  }
  return map
}

function structurallyDifferent(
  baselineNode: ComfyNode,
  currentNode: ComfyNode
): boolean {
  if (baselineNode.type !== currentNode.type) return true
  if (!isEqual(baselineNode.inputs ?? [], currentNode.inputs ?? [])) return true
  if (!isEqual(baselineNode.outputs ?? [], currentNode.outputs ?? []))
    return true
  return false
}

function linksDiffer(
  baseline: ComfyWorkflowJSON,
  current: ComfyWorkflowJSON
): boolean {
  const baselineLinks = (baseline.links ?? []).map((link) => {
    const [, src, srcSlot, dst, dstSlot, dataType] = link as unknown as [
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown
    ]
    return [src, srcSlot, dst, dstSlot, dataType]
  })
  const currentLinks = (current.links ?? []).map((link) => {
    const [, src, srcSlot, dst, dstSlot, dataType] = link as unknown as [
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown
    ]
    return [src, srcSlot, dst, dstSlot, dataType]
  })
  return !isEqual(
    baselineLinks.map((l) => JSON.stringify(l)).sort(),
    currentLinks.map((l) => JSON.stringify(l)).sort()
  )
}

function combine(
  hasSeedChange: boolean,
  hasPromptChange: boolean
): TemplateChangeType {
  if (hasSeedChange && hasPromptChange) return 'seed_and_prompt'
  if (hasSeedChange) return 'seed_only'
  if (hasPromptChange) return 'prompt_only'
  return 'unchanged'
}

export function classifyTemplateChange(
  baseline: ComfyWorkflowJSON,
  current: ComfyWorkflowJSON,
  liveNodes: LiveNodeLookup
): TemplateChangeType {
  const baselineNodes = nodesById(baseline)
  const currentNodes = nodesById(current)

  if (baselineNodes.size !== currentNodes.size) return 'structural'
  for (const id of baselineNodes.keys()) {
    if (!currentNodes.has(id)) return 'structural'
  }

  if (linksDiffer(baseline, current)) return 'structural'

  let hasSeedChange = false
  let hasPromptChange = false

  for (const [id, baselineNode] of baselineNodes) {
    const currentNode = currentNodes.get(id)!

    if (structurallyDifferent(baselineNode, currentNode)) return 'structural'

    const baselineValues = baselineNode.widgets_values ?? []
    const currentValues = currentNode.widgets_values ?? []
    if (!Array.isArray(baselineValues) || !Array.isArray(currentValues)) {
      if (!isEqual(baselineValues, currentValues)) return 'structural'
      continue
    }

    if (baselineValues.length !== currentValues.length) return 'structural'

    const widgets = liveNodes.get(id)?.widgets ?? []

    for (let i = 0; i < baselineValues.length; i++) {
      if (isEqual(baselineValues[i], currentValues[i])) continue

      const kind = widgetKind(widgets[i])
      if (kind === 'seed') hasSeedChange = true
      else if (kind === 'prompt') hasPromptChange = true
      else return 'structural'
    }
  }

  return combine(hasSeedChange, hasPromptChange)
}
