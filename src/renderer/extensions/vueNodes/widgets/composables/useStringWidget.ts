import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { resolveNodeRootGraphId } from '@/lib/litegraph/src/litegraph'
import { defineDeprecatedProperty } from '@/lib/litegraph/src/utils/feedback'
import {
  bindMultilineTextareaWidget,
  createMultilineInputElement
} from '@/renderer/extensions/vueNodes/widgets/utils/multilineTextarea'
import { isStringInputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'
import type { InputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'
import { app } from '@/scripts/app'
import type { ComfyWidgetConstructorV2 } from '@/scripts/widgets'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { widgetId } from '@/types/widgetId'

function addMultilineWidget(
  node: LGraphNode,
  name: string,
  opts: { defaultVal: string; placeholder?: string }
) {
  const widgetStore = useWidgetValueStore()
  const inputEl = createMultilineInputElement(
    opts.defaultVal,
    opts.placeholder || name
  )

  const widget = node.addDOMWidget(name, 'customtext', inputEl, {
    getValue(): string {
      const graphId = resolveNodeRootGraphId(node, app.rootGraph.id)
      const widgetState = widgetStore.getWidget(
        widgetId(graphId, node.id, name)
      )

      return (widgetState?.value as string) ?? inputEl.value
    },
    setValue(v: string) {
      inputEl.value = v
      const graphId = resolveNodeRootGraphId(node, app.rootGraph.id)
      const id = widgetId(graphId, node.id, name)
      const widgetState = widgetStore.getWidget(id)
      if (widgetState) {
        widgetState.value = v
        return
      }
      widgetStore.registerWidget(id, {
        type: 'customtext',
        value: v,
        options: widget.options ?? {}
      })
    }
  })

  widget.element = inputEl

  /** @deprecated Use {@link widget.element} instead (renamed in PR #8594). */
  defineDeprecatedProperty(
    widget,
    'inputEl',
    'element',
    'widget.inputEl is deprecated. Use widget.element instead.'
  )
  widget.options.minNodeSize = [400, 200]

  bindMultilineTextareaWidget(widget, inputEl)

  return widget
}

export const useStringWidget = () => {
  const widgetConstructor: ComfyWidgetConstructorV2 = (
    node: LGraphNode,
    inputSpec: InputSpec
  ) => {
    if (!isStringInputSpec(inputSpec)) {
      throw new Error(`Invalid input data: ${inputSpec}`)
    }

    const defaultVal = inputSpec.default ?? ''
    const multiline = inputSpec.multiline

    const widget = multiline
      ? addMultilineWidget(node, inputSpec.name, {
          defaultVal,
          placeholder: inputSpec.placeholder
        })
      : node.addWidget('text', inputSpec.name, defaultVal, () => {}, {})

    if (typeof inputSpec.dynamicPrompts === 'boolean') {
      widget.dynamicPrompts = inputSpec.dynamicPrompts
    }

    return widget
  }

  return widgetConstructor
}
