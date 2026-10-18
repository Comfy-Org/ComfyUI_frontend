import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { resolveNodeRootGraphId } from '@/lib/litegraph/src/utils/widget'
import { defineDeprecatedProperty } from '@/lib/litegraph/src/utils/feedback'
import {
  bindMultilineTextareaWidget,
  createMultilineInputElement
} from '@/renderer/extensions/vueNodes/widgets/utils/multilineTextarea'
import { isStringInputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'
import type { InputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'
import { useApp } from '@/scripts/appInstance'
import type { DOMWidget, DOMWidgetOptions } from '@/types/domWidget'
import type { ComfyWidgetConstructorV2 } from '@/types/widgetConstructor'
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

  let widget: DOMWidget<HTMLTextAreaElement, string> | undefined = undefined
  // A DynamicGroup row shift renames the widget, so resolve the store id
  // from its current name rather than the name it was created with.
  function storeId() {
    const graphId = resolveNodeRootGraphId(node, useApp().rootGraph.id)
    return widgetId(graphId, node.id, widget?.name ?? name)
  }

  // Declared separately (rather than reading `widget.options` from the
  // outer closure below) because `addDOMWidget` can invoke `setValue`
  // synchronously, while restoring a saved value, before the `widget`
  // binding it returns is initialized.
  const widgetOptions: DOMWidgetOptions<string> = {
    getValue(): string {
      const widgetState = widgetStore.getWidget(storeId())

      return typeof widgetState?.value === 'string'
        ? widgetState.value
        : inputEl.value
    },
    setValue(v: string) {
      inputEl.value = v
      const id = storeId()
      const widgetState = widgetStore.getWidget(id)
      if (widgetState) {
        widgetState.value = v
        return
      }
      widgetStore.registerWidget(id, {
        type: 'customtext',
        value: v,
        options: widgetOptions
      })
    }
  }

  widget = node.addDOMWidget(name, 'customtext', inputEl, widgetOptions)

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
