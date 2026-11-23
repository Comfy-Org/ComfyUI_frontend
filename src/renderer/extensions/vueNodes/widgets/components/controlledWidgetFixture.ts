import { addValueControlWidget } from '@/core/graph/widgets/valueControlWidgets'
import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { ControlOptions } from '@/core/graph/widgets/controlWidget'
import { widgetId } from '@comfyorg/graph-model/widgetId'
import type { IWidgetOptions } from '@comfyorg/graph-model/widgets'

export function addControlledWidget({
  type = 'number',
  name = 'controlled_widget',
  value = 0,
  options = {},
  mode = 'randomize'
}: {
  type?: 'number' | 'combo'
  name?: string
  value?: number | string
  options?: IWidgetOptions
  mode?: ControlOptions
} = {}) {
  const graph = new LGraph()
  const node = new LGraphNode('Controlled')
  graph.add(node)
  const target = node.addWidget(type, name, value, () => {}, options)
  const control = addValueControlWidget(node, target, mode)
  target.linkedWidgets = [control]
  return { graph, widgetId: widgetId(graph.id, node.id, name), control }
}
