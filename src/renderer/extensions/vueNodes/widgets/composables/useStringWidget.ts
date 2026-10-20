import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { resolveNodeRootGraphId } from '@/lib/litegraph/src/utils/widget'
import { defineDeprecatedProperty } from '@/lib/litegraph/src/utils/feedback'
import {
  bindMultilineTextareaWidget,
  createMultilineInputElement
} from '@/renderer/extensions/vueNodes/widgets/utils/multilineTextarea'
import { isStringInputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'
import type { InputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'
import { useApp } from '@/scripts/appInstance'
import { isDOMWidget } from '@/scripts/domWidget'
import type { DOMWidgetOptions } from '@/types/domWidget'
import type { ComfyWidgetConstructorV2 } from '@/types/widgetConstructor'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { widgetId } from '@/types/widgetId'
import type { WidgetId } from '@/types/widgetId'
import type { WidgetState } from '@/types/widgetState'

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

  let owner: IBaseWidget | undefined
  let ownState: WidgetState | undefined
  /**
   * Resolves the store entry under the widget's current name and adopts it as
   * its own, or returns undefined once the widget has left its node and the
   * entry belongs to another widget. The widget is found by its element
   * because `addDOMWidget` can invoke `setValue` synchronously, while restoring
   * a saved value, before the `widget` binding it returns is initialized.
   */
  function adoptOwnEntry():
    | { id: WidgetId; state: WidgetState | undefined }
    | undefined {
    owner ??= node.widgets?.find(
      (widget) => isDOMWidget(widget) && widget.element === inputEl
    )
    const graphId = resolveNodeRootGraphId(node, useApp().rootGraph.id)
    const id = widgetId(graphId, node.id, owner?.name ?? name)
    const state = widgetStore.getWidget(id)
    const listed = owner !== undefined && node.widgets?.includes(owner) === true
    const takenByAnother =
      !listed && ownState !== undefined && state !== ownState
    if (takenByAnother) return undefined
    ownState = state
    return { id, state }
  }

  const widgetOptions: DOMWidgetOptions<string> = {
    getValue(): string {
      const value = adoptOwnEntry()?.state?.value
      return typeof value === 'string' ? value : inputEl.value
    },
    setValue(v: string) {
      inputEl.value = v
      const entry = adoptOwnEntry()
      if (entry === undefined) return
      if (entry.state) {
        entry.state.value = v
        return
      }
      ownState = widgetStore.registerWidget(entry.id, {
        type: 'customtext',
        value: v,
        options: widgetOptions
      })
    }
  }

  const widget = node.addDOMWidget(name, 'customtext', inputEl, widgetOptions)

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
