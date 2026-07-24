import type { INodeInputSlot } from '@/lib/litegraph/src/interfaces'
import type { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import type { NodeExecutionId } from '@/types/nodeIdentification'
import { getExecutionIdByNode } from '@/utils/graphTraversalUtil'

import { inputForWidget, promotedInputSource } from './promotedInputWidget'
import {
  buildPromotedSourceExecutionId,
  resolveConcretePromotedWidget
} from './resolveConcretePromotedWidget'

type PromotedWidgetInput = INodeInputSlot & {
  widgetId: NonNullable<INodeInputSlot['widgetId']>
}

function hasWidgetId(
  input: INodeInputSlot | undefined
): input is PromotedWidgetInput {
  return input?.widgetId !== undefined
}

interface ResolvedPromotedWidgetSource {
  input: PromotedWidgetInput
  sourceExecutionId?: NodeExecutionId
  sourceNode: LGraphNode
  sourceWidget: IBaseWidget
  sourceWidgetName: string
}

export function resolvePromotedWidgetSource(
  rootGraph: LGraph | null | undefined,
  node: LGraphNode,
  widget: IBaseWidget
): ResolvedPromotedWidgetSource | undefined {
  if (!node.isSubgraphNode?.()) return undefined

  const input = inputForWidget(node, widget)
  if (!hasWidgetId(input)) return undefined

  const source = promotedInputSource(node, input)
  if (!source) return undefined

  const resolution = resolveConcretePromotedWidget(
    node,
    source.nodeId,
    source.widgetName
  )
  if (resolution.status !== 'resolved') return undefined

  const { node: sourceNode, widget: sourceWidget } = resolution.resolved
  const hostExecutionId = rootGraph
    ? getExecutionIdByNode(rootGraph, node)
    : undefined
  return {
    input,
    sourceExecutionId: hostExecutionId
      ? buildPromotedSourceExecutionId(
          hostExecutionId,
          resolution.resolved.nodePath
        )
      : undefined,
    sourceNode,
    sourceWidget,
    sourceWidgetName: sourceWidget.name
  }
}
