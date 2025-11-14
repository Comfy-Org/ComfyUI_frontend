import { useChainCallback } from '@/composables/functional/useChainCallback'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
//import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'

import type {
  ComboInputSpec,
  ComfyInputsSpec,
  InputSpec
} from '@/schemas/nodeDefSchema'
import { app } from '@/scripts/app'
import type { ComfyApp } from '@/scripts/app'

function COMFY_DYNAMICCOMBO_V3(
  node: LGraphNode,
  inputName: string,
  inputData: InputSpec,
  appArg: ComfyApp,
  widgetName?: string
) {
  debugger
  //FIXME: properly add to schema
  const options = inputData[1]?.options as Record<string, ComfyInputsSpec>

  const subSpec: ComboInputSpec = [Object.keys(options), {}]
  const { widget, minWidth, minHeight } = app.widgets['COMBO'](
    node,
    inputName,
    subSpec,
    appArg,
    widgetName
  )
  let currentDynamicNames: string[] = []
  widget.callback = useChainCallback(widget.callback, (value) => {
    if (!node.widgets) throw new Error('Not Reachable')
    const newSpec = options[value]
    //TODO: Calculate intersection for widgets that persist across options
    for (const name of currentDynamicNames) {
      const inputIndex = node.inputs.findIndex((input) => input.name === name)
      if (inputIndex !== -1) node.removeInput(inputIndex)
      const widgetIndex = node.widgets.findIndex(
        (widget) => widget.name === name
      )
      if (widgetIndex === -1) return
      node.widgets[widgetIndex].callback?.(undefined)
      node.widgets.splice(widgetIndex, 1)
    }
    currentDynamicNames = []
    if (!newSpec) return

    const insertionPoint = node.widgets.findIndex((w) => w === widget) + 1
    const startingLength = node.widgets.length
    if (insertionPoint === 0)
      throw new Error("Dynamic widget doesn't exist on node")
    //process new inputs
    //FIXME: inputs MUST be well ordered

    const addedWidgets = node.widgets.splice(startingLength)
    node.widgets.splice(insertionPoint, 0, ...addedWidgets)
  })
  //A little hacky, but onConfigure won't work.
  //It fires too late and is overly disruptive
  Object.defineProperty(widget, 'value', {
    get() {
      return this._value
    },
    set(value) {
      this._value = value
      this.callback!(value)
    }
  })
  return { widget, minWidth, minHeight }
}

app.registerExtension({
  name: 'Comfy.DynamicCombo',
  getCustomWidgets() {
    return { COMFY_DYNAMICCOMBO_V3 }
  }
})
