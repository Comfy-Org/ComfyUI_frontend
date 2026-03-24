import { resolveNodeRootGraphId } from '@/lib/litegraph/src/litegraph'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { InputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'
import { app } from '@/scripts/app'
import { ComponentWidgetImpl, addWidget } from '@/scripts/domWidget'
import type { BaseDOMWidget } from '@/scripts/domWidget'
import type { ComfyWidgetConstructorV2 } from '@/scripts/widgets'
import { useWidgetValueStore } from '@/stores/widgetValueStore'

import WidgetMarkdown from '../components/WidgetMarkdown.vue'

function addMarkdownWidget(
  node: LGraphNode,
  name: string,
  inputSpec: InputSpec,
  opts: { defaultVal: string }
) {
  const widget = new ComponentWidgetImpl({
    node,
    name,
    component: WidgetMarkdown,
    inputSpec,
    type: 'MARKDOWN',
    options: {
      minNodeSize: [400, 200],
      getValue: () =>
        (useWidgetValueStore().getWidget(
          resolveNodeRootGraphId(node, app.rootGraph.id),
          node.id,
          name
        )?.value as string) ?? opts.defaultVal,
      setValue: (v: string) => {
        const state = useWidgetValueStore().getWidget(
          resolveNodeRootGraphId(node, app.rootGraph.id),
          node.id,
          name
        )
        if (state) state.value = v
      }
    }
  })

  addWidget(node, widget as BaseDOMWidget<object | string>)
  widget.value = opts.defaultVal

  return widget
}

export const useMarkdownWidget = () => {
  const widgetConstructor: ComfyWidgetConstructorV2 = (
    node: LGraphNode,
    inputSpec: InputSpec
  ) => {
    return addMarkdownWidget(node, inputSpec.name, inputSpec, {
      defaultVal: inputSpec.default ?? ''
    })
  }

  return widgetConstructor
}
