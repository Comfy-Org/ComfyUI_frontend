import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { transformInputSpecV1ToV2 } from '@/schemas/nodeDef/migration'

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
  //FIXME: properly add to schema
  const options = Object.fromEntries(
    (inputData[1]?.options as { inputs: ComfyInputsSpec; key: string }[]).map(
      ({ key, inputs }) => [key, inputs]
    )
  )

  const subSpec: ComboInputSpec = [Object.keys(options), {}]
  const { widget, minWidth, minHeight } = app.widgets['COMBO'](
    node,
    inputName,
    subSpec,
    appArg,
    widgetName
  )
  let currentDynamicNames: string[] = []
  const updateWidgets = (value?: string) => {
    if (!node.widgets) throw new Error('Not Reachable')
    const newSpec = value ? options[value] : undefined
    //TODO: Calculate intersection for widgets that persist across options
    for (const name of currentDynamicNames) {
      const inputIndex = node.inputs.findIndex((input) => input.name === name)
      if (inputIndex !== -1) node.removeInput(inputIndex)
      const widgetIndex = node.widgets.findIndex(
        (widget) => widget.name === name
      )
      if (widgetIndex === -1) continue
      node.widgets[widgetIndex].callback?.(undefined)
      node.widgets.splice(widgetIndex, 1)
    }
    currentDynamicNames = []
    if (!newSpec) return

    const insertionPoint = node.widgets.findIndex((w) => w === widget) + 1
    const startingLength = node.widgets.length
    if (insertionPoint === 0)
      throw new Error("Dynamic widget doesn't exist on node")
    //FIXME: inputs MUST be well ordered
    //FIXME check for duplicates

    if (newSpec.required)
      for (const name in newSpec.required) {
        //@ts-expect-error temporary duck violence
        node._addInput(
          transformInputSpecV1ToV2(newSpec.required[name], {
            name,
            isOptional: false
          })
        )
        currentDynamicNames.push(name)
      }
    if (newSpec.optional)
      for (const name in newSpec.optional) {
        //@ts-expect-error temporary duck violence
        node._addInput(
          transformInputSpecV1ToV2(newSpec.optional[name], {
            name,
            isOptional: false
          })
        )
        currentDynamicNames.push(name)
      }

    const addedWidgets = node.widgets.splice(startingLength)
    node.widgets.splice(insertionPoint, 0, ...addedWidgets)
    node.computeSize(node.size)
  }
  //A little hacky, but onConfigure won't work.
  //It fires too late and is overly disruptive
  let widgetValue = widget.value
  Object.defineProperty(widget, 'value', {
    get() {
      return widgetValue
    },
    set(value) {
      widgetValue = value
      updateWidgets(value)
    }
  })
  widget.value = widgetValue
  return { widget, minWidth, minHeight }
}

app.registerExtension({
  name: 'Comfy.DynamicCombo',
  getCustomWidgets() {
    return { COMFY_DYNAMICCOMBO_V3 }
  }
})
