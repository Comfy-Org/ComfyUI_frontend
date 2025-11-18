import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { transformInputSpecV1ToV2 } from '@/schemas/nodeDef/migration'

import type { ComboInputSpec, InputSpec } from '@/schemas/nodeDefSchema'
import { zDynamicComboInputSpec } from '@/schemas/nodeDefSchema'
import { app } from '@/scripts/app'
import type { ComfyApp } from '@/scripts/app'

function COMFY_DYNAMICCOMBO_V3(
  node: LGraphNode,
  inputName: string,
  untypedInputData: InputSpec,
  appArg: ComfyApp,
  widgetName?: string
) {
  const parseResult = zDynamicComboInputSpec.safeParse(untypedInputData)
  if (!parseResult.success) throw new Error('invalid DynamicCombo spec')
  const inputData = parseResult.data
  const options = Object.fromEntries(
    inputData[1].options.map(({ key, inputs }) => [key, inputs])
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
    const inputInsertionPoint =
      node.inputs.findIndex((i) => i.name === widget.name) + 1
    const startingInputLength = node.inputs.length
    if (insertionPoint === 0)
      throw new Error("Dynamic widget doesn't exist on node")
    //FIXME: inputs MUST be well ordered
    //FIXME check for duplicates
    const inputTypes: [Record<string, InputSpec> | undefined, boolean][] = [
      [newSpec.required, false],
      [newSpec.optional, true]
    ]
    for (const [inputType, isOptional] of inputTypes)
      for (const name in inputType ?? {}) {
        //@ts-expect-error temporary duck violence
        node._addInput(
          transformInputSpecV1ToV2(inputType![name], {
            name,
            isOptional
          })
        )
        currentDynamicNames.push(`${widget.name}.${name}`)
      }

    const addedWidgets = node.widgets.splice(startingLength)
    for (const addedWidget of addedWidgets) {
      addedWidget.name = `${widget.name}.${addedWidget.name}`
    }
    node.widgets.splice(insertionPoint, 0, ...addedWidgets)
    node.size[1] = node.computeSize([...node.size])[1]
    for (const input of node.inputs.slice(startingInputLength)) {
      input.name = `${widget.name}.${input.name}`
      if (input.widget)
        input.widget.name = `${widget.name}.${input.widget.name}`
    }
    if (inputInsertionPoint === 0) {
      if (
        addedWidgets.length === 0 &&
        node.inputs.length !== startingInputLength
      )
        //input is inputOnly, but lacks an insertion point
        throw new Error('Failed to find input socket for ' + widget.name)
      return
    }
    const addedInputs = node.spliceInputs(startingInputLength)
    node.spliceInputs(inputInsertionPoint, 0, ...addedInputs)
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
