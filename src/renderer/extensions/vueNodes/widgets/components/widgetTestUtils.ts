import { useWidgetValueStore } from '@/stores/widgetValueStore'
import type { WidgetRenderState } from '@/stores/widgetValueStore'
import type { WidgetValue } from '@comfyorg/graph-model/widgetValue'
import { toNodeId } from '@comfyorg/graph-model/nodeId'
import type { NodeId } from '@comfyorg/graph-model/nodeId'
import { widgetId } from '@comfyorg/graph-model/widgetId'
import type { WidgetId } from '@comfyorg/graph-model/widgetId'
import type { IWidgetOptions } from '@comfyorg/graph-model/widgets'

const TEST_WIDGET_GRAPH_ID = '00000000-0000-4000-8000-0000000000aa'

export function registerTestWidget(
  init: {
    name: string
    nodeId?: NodeId
    type?: string
    value: WidgetValue
    label?: string
    disabled?: boolean
    options?: IWidgetOptions
  },
  renderState?: WidgetRenderState
): WidgetId {
  const id = widgetId(
    TEST_WIDGET_GRAPH_ID,
    init.nodeId ?? toNodeId(1),
    init.name
  )
  useWidgetValueStore().registerWidget(
    id,
    {
      type: init.type ?? 'string',
      value: init.value,
      label: init.label,
      disabled: init.disabled,
      options: init.options ?? {}
    },
    renderState
  )
  return id
}
