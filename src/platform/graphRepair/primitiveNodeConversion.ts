import { reportError } from '@comfyorg/telemetry/reportError'
import type { IBaseWidget } from '@comfyorg/graph-model/widgets'

import {
  isValueControlWidget,
  numberControlRange
} from '@/core/graph/widgets/valueControl'
import { SUBGRAPH_OUTPUT_ID } from '@/lib/litegraph/src/constants'
import type { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { LGraphEventMode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import { outputLinks } from '@/lib/litegraph/src/node/slotLinks'
import { processDynamicPrompt } from '@/utils/formatUtil'
import type { NodeReplacement } from '@/platform/workflowErrors/nodeReplacement/types'
import { replacePlaceholder } from '@/platform/workflowErrors/nodeReplacement/useNodeReplacement'

export type PrimitiveNodeSkipReason =
  | 'bypassed'
  | 'locked'
  | 'noOutput'
  | 'combo'
  | 'unsupportedType'
  | 'subgraphIO'
  | 'unsupportedTarget'
  | 'textReplacement'
  | 'dynamicPrompts'
  | 'controlMode'
  | 'valueChanged'

interface PrimitiveNodeConversion {
  node: LGraphNode
  replacement: NodeReplacement
}

export interface PrimitiveNodeConversionPlan {
  convertible: PrimitiveNodeConversion[]
  skipped: { node: LGraphNode; reason: PrimitiveNodeSkipReason }[]
}

type Planned =
  | { ok: true; replacement: NodeReplacement }
  | { ok: false; reason: PrimitiveNodeSkipReason }

interface DrivenWidget {
  node: LGraphNode
  widget: IBaseWidget
  inputType: string
}

const textReplacementProperty = 'Run widget replace on values'

export function isPrimitiveNode(node: LGraphNode): boolean {
  return node.type === 'PrimitiveNode'
}

function skip(reason: PrimitiveNodeSkipReason): Planned {
  return { ok: false, reason }
}

function drivenWidgets(
  graph: LGraph,
  node: LGraphNode
): DrivenWidget[] | PrimitiveNodeSkipReason {
  const driven: DrivenWidget[] = []
  for (const link of outputLinks(graph, node.id, 0)) {
    if (link.target_id === SUBGRAPH_OUTPUT_ID) return 'subgraphIO'
    const target = graph.getNodeById(link.target_id)
    const input = target?.inputs.at(link.target_slot)
    const widget = target?.widgets?.find(
      (candidate) => candidate.name === input?.widget?.name
    )
    if (
      !target ||
      target.isVirtualNode ||
      !widget ||
      typeof input?.type !== 'string'
    )
      return 'unsupportedTarget'
    driven.push({ node: target, widget, inputType: input.type })
  }
  return driven
}

function candidateTypes(drivenType: string, source: IBaseWidget): string[] {
  switch (drivenType) {
    case 'INT':
      return ['PrimitiveInt', 'SeedNode']
    case 'FLOAT':
      return ['PrimitiveFloat']
    case 'BOOLEAN':
      return ['PrimitiveBoolean']
    case 'STRING':
      return [
        source.type === 'customtext'
          ? 'PrimitiveStringMultiline'
          : 'PrimitiveString'
      ]
    default:
      return []
  }
}

function expandsDynamicPrompts(driven: DrivenWidget[], value: unknown) {
  return (
    typeof value === 'string' &&
    driven.some(({ widget }) => widget.dynamicPrompts) &&
    processDynamicPrompt(value) !== value
  )
}

function sameControlRange(a: IBaseWidget, b: IBaseWidget): boolean {
  const left = numberControlRange(a)
  const right = numberControlRange(b)
  return (
    left.min === right.min &&
    left.max === right.max &&
    left.step2 === right.step2
  )
}

function keepsValue(widget: IBaseWidget, value: IBaseWidget['value']) {
  try {
    widget.value = value
    widget.callback?.(widget.value)
    return widget.value === value
  } catch (error) {
    reportError(error, {
      surface: 'graph',
      errorType: 'failure_probing_primitive_conversion_value'
    })
    return false
  }
}

function planTarget(
  type: string,
  source: IBaseWidget,
  sourceControl: IBaseWidget | undefined
): Planned {
  const probe = LiteGraph.createNode(type)
  const valueWidget = probe?.widgets?.at(0)
  if (!valueWidget || valueWidget.type !== source.type)
    return skip('unsupportedTarget')
  const control = probe?.widgets?.slice(1).find(isValueControlWidget)
  const mode = sourceControl?.value ?? 'fixed'
  if (mode !== 'fixed' && (!control || !sameControlRange(valueWidget, source)))
    return skip('controlMode')
  if (!keepsValue(valueWidget, source.value)) return skip('valueChanged')

  const inputMapping: NonNullable<NodeReplacement['input_mapping']> = [
    { old_id: source.name, new_id: valueWidget.name }
  ]
  if (control && sourceControl)
    inputMapping.push({ old_id: sourceControl.name, new_id: control.name })
  else if (control) inputMapping.push({ new_id: control.name, set_value: mode })
  return {
    ok: true,
    replacement: {
      old_node_id: 'PrimitiveNode',
      new_node_id: type,
      old_widget_ids: [
        source.name,
        ...(sourceControl ? [sourceControl.name] : [])
      ],
      input_mapping: inputMapping,
      output_mapping: null,
      editorOnly: true
    }
  }
}

function planConversion(graph: LGraph, node: LGraphNode): Planned {
  if (node.mode !== LGraphEventMode.ALWAYS) return skip('bypassed')
  if (node.removable === false || node.block_delete || node.ignore_remove)
    return skip('locked')
  const source = node.widgets?.at(0)
  if (!source || !outputLinks(graph, node.id, 0).length) return skip('noOutput')
  const drivenType = node.outputs[0]?.type
  if (drivenType === 'COMBO') return skip('combo')
  if (typeof drivenType !== 'string') return skip('unsupportedType')
  const candidates = candidateTypes(drivenType, source)
  if (!candidates.length) return skip('unsupportedType')

  const driven = drivenWidgets(graph, node)
  if (typeof driven === 'string') return skip(driven)
  if (
    driven.some(
      ({ inputType }) => !LiteGraph.isValidConnection(drivenType, inputType)
    )
  )
    return skip('unsupportedTarget')
  if (drivenType === 'STRING' && node.properties[textReplacementProperty])
    return skip('textReplacement')
  if (expandsDynamicPrompts(driven, source.value)) return skip('dynamicPrompts')

  const sourceControl = node.widgets?.slice(1).find(isValueControlWidget)
  const planned = candidates.map((type) =>
    planTarget(type, source, sourceControl)
  )
  return planned.find((plan) => plan.ok) ?? planned[0]
}

/** Splits legacy Primitive nodes into those that can become typed core primitives and those left unchanged, with the reason. */
export function planPrimitiveNodeConversion(
  graph: LGraph,
  nodes: Iterable<LGraphNode>
): PrimitiveNodeConversionPlan {
  const plan: PrimitiveNodeConversionPlan = { convertible: [], skipped: [] }
  for (const node of nodes) {
    if (!isPrimitiveNode(node) || node.graph !== graph) continue
    const planned = planConversion(graph, node)
    if (planned.ok)
      plan.convertible.push({ node, replacement: planned.replacement })
    else plan.skipped.push({ node, reason: planned.reason })
  }
  return plan
}

/** Replaces each planned Primitive node with its core primitive in place; returns the replacements. */
export function convertPrimitiveNodes(
  graph: LGraph,
  conversions: readonly PrimitiveNodeConversion[]
): LGraphNode[] {
  const converted = conversions.flatMap(({ node, replacement }) => {
    if (node.graph !== graph || !replacePlaceholder(node, replacement))
      return []
    const replaced = graph.getNodeById(node.id)
    if (!replaced) return []
    delete replaced.properties[textReplacementProperty]
    return [replaced]
  })
  if (converted.length) {
    graph.rootGraph.updateExecutionOrder()
    graph.setDirtyCanvas(true, true)
  }
  return converted
}
