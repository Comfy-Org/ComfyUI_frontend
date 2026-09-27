import TextPreviewWidget from '@/components/graph/widgets/TextPreviewWidget.vue'
import { resolveNodeRootGraphId } from '@/lib/litegraph/src/litegraph'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { InputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'
import { ComponentWidgetImpl, addWidget } from '@/scripts/domWidget'
import type { ComponentWidgetStandardProps } from '@/scripts/domWidget'
import { app } from '@/scripts/app'
import type { ComfyWidgetConstructorV2 } from '@/scripts/widgets'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { widgetId } from '@/types/widgetId'

type TextPreviewCustomProps = Omit<
  InstanceType<typeof TextPreviewWidget>['$props'],
  ComponentWidgetStandardProps
>

const PADDING = 16

export function useTextPreviewWidget(
  options: {
    minHeight?: number
  } = {}
): ComfyWidgetConstructorV2 {
  function widgetConstructor(
    node: LGraphNode,
    inputSpec: InputSpec
  ): IBaseWidget {
    const widget = new ComponentWidgetImpl<
      string | object,
      TextPreviewCustomProps
    >({
      node,
      name: inputSpec.name,
      component: TextPreviewWidget,
      inputSpec,
      props: {
        nodeId: node.id
      },
      options: {
        getValue: () => {
          const value =
            useWidgetValueStore().getWidget(
              widgetId(
                resolveNodeRootGraphId(node, app.rootGraph.id),
                node.id,
                inputSpec.name
              )
            )?.value ?? ''
          return typeof value === 'number' || typeof value === 'boolean'
            ? String(value)
            : value
        },
        setValue: (value: string | object) => {
          const graphId = resolveNodeRootGraphId(node, app.rootGraph.id)
          const widgetState = useWidgetValueStore().getWidget(
            widgetId(graphId, node.id, inputSpec.name)
          )
          if (widgetState)
            widgetState.value =
              typeof value === 'string' ? value : String(value)
        },
        getMinHeight: () => options.minHeight ?? 42 + PADDING,
        serialize: false,
        read_only: true
      },
      type: inputSpec.type
    })
    widget.serialize = false
    addWidget(node, widget)
    return widget
  }

  return widgetConstructor
}
