import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { INodeInputSlot } from '@/lib/litegraph/src/interfaces'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import { transformInputSpecV1ToV2 } from '@/schemas/nodeDef/migration'
import type { ComboInputSpec, InputSpec } from '@/schemas/nodeDefSchema'
import { zDynamicComboInputSpec } from '@/schemas/nodeDefSchema'
import { useLitegraphService } from '@/services/litegraphService'
import { app } from '@/scripts/app'
import type { ComfyApp } from '@/scripts/app'

function dynamicComboWidget(
  node: LGraphNode,
  inputName: string,
  untypedInputData: InputSpec,
  appArg: ComfyApp,
  widgetName?: string
) {
  const { addNodeInput } = useLitegraphService()
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
    const inputsToRemove: Record<string, INodeInputSlot> = {}
    for (const name of currentDynamicNames) {
      const input = node.inputs.find((input) => input.name === name)
      if (input) inputsToRemove[input.name] = input
      const widgetIndex = node.widgets.findIndex(
        (widget) => widget.name === name
      )
      if (widgetIndex === -1) continue
      node.widgets[widgetIndex].value = undefined
      node.widgets.splice(widgetIndex, 1)
    }
    currentDynamicNames = []
    if (!newSpec) {
      for (const input of Object.values(inputsToRemove)) {
        const inputIndex = node.inputs.findIndex((inp) => inp === input)
        if (inputIndex === -1) continue
        node.removeInput(inputIndex)
      }
      return
    }

    const insertionPoint = node.widgets.findIndex((w) => w === widget) + 1
    const startingLength = node.widgets.length
    const inputInsertionPoint =
      node.inputs.findIndex((i) => i.name === widget.name) + 1
    const startingInputLength = node.inputs.length
    if (insertionPoint === 0)
      throw new Error("Dynamic widget doesn't exist on node")
    const inputTypes: [Record<string, InputSpec> | undefined, boolean][] = [
      [newSpec.required, false],
      [newSpec.optional, true]
    ]
    for (const [inputType, isOptional] of inputTypes)
      for (const name in inputType ?? {}) {
        addNodeInput(
          node,
          transformInputSpecV1ToV2(inputType![name], {
            name,
            isOptional
          })
        )
        currentDynamicNames.push(name)
        if (
          !inputsToRemove[name] ||
          Array.isArray(inputType![name][0]) ||
          !LiteGraph.isValidConnection(
            inputsToRemove[name].type,
            inputType![name][0]
          )
        )
          continue
        node.inputs.at(-1)!.link = inputsToRemove[name].link
        inputsToRemove[name].link = null
      }

    for (const input of Object.values(inputsToRemove)) {
      const inputIndex = node.inputs.findIndex((inp) => inp === input)
      if (inputIndex === -1) continue
      node.removeInput(inputIndex)
    }
    const addedWidgets = node.widgets.splice(startingLength)
    node.widgets.splice(insertionPoint, 0, ...addedWidgets)
    if (inputInsertionPoint === 0) {
      if (
        addedWidgets.length === 0 &&
        node.inputs.length !== startingInputLength
      )
        //input is inputOnly, but lacks an insertion point
        throw new Error('Failed to find input socket for ' + widget.name)
      return
    }
    const addedInputs = node
      .spliceInputs(startingInputLength)
      .map((addedInput) => {
        const existingInput = node.inputs.findIndex(
          (existingInput) => addedInput.name === existingInput.name
        )
        return existingInput === -1
          ? addedInput
          : node.spliceInputs(existingInput, 1)[0]
      })
    //assume existing inputs are in correct order
    node.spliceInputs(inputInsertionPoint, 0, ...addedInputs)
    node.size[1] = node.computeSize([...node.size])[1]
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

export const dynamicWidgets = { COMFY_DYNAMICCOMBO_V3: dynamicComboWidget }
