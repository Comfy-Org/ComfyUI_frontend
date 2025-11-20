import { useChainCallback } from '@/composables/functional/useChainCallback'
import { NodeSlotType } from '@/lib/litegraph/src/types/globalEnums'
import type { ISlotType } from '@/lib/litegraph/src/interfaces'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { INodeInputSlot } from '@/lib/litegraph/src/interfaces'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import { transformInputSpecV1ToV2 } from '@/schemas/nodeDef/migration'
import type { ComboInputSpec, InputSpec } from '@/schemas/nodeDefSchema'
import type { InputSpec as InputSpecV2 } from '@/schemas/nodeDef/nodeDefSchemaV2'
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
    const initialInputIndex =
      node.inputs.findIndex((i) => i.name === widget.name) + 1
    let startingInputLength = node.inputs.length
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
      if (inputIndex < initialInputIndex) startingInputLength--
      node.removeInput(inputIndex)
    }
    const inputInsertionPoint =
      node.inputs.findIndex((i) => i.name === widget.name) + 1
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

export function applyAutoGrow(node: LGraphNode, inputSpec: InputSpecV2) {
  const { addNodeInput } = useLitegraphService()
  //@ts-expect-error - implement min, define inputSpec
  const { input, min, names, prefix, max } = inputSpec.template
  const inputTypes: [Record<string, InputSpec> | undefined, boolean][] = [
    [input.required, false],
    [input.optional, true]
  ]
  const inputsV2 = inputTypes.flatMap(([inputType, isOptional]) =>
    Object.entries(inputType ?? {}).map(([name, v]) =>
      transformInputSpecV1ToV2(v, { name, isOptional })
    )
  )
  if (inputsV2.length !== 1) throw new Error('Not Implemented')

  function nameToInputIndex(name: string) {
    const index = node.inputs.findIndex((input) => input.name === name)
    if (index === -1) throw new Error('Failed to find input')
    return index
  }
  function nameToInput(name: string) {
    return node.inputs[nameToInputIndex(name)]
  }

  //In the distance, someone shouting YAGNI
  const trackedInputs: string[][] = []
  function addInputGroup(insertionIndex: number) {
    const ordinal = trackedInputs.length
    const inputGroup: string[] = []
    for (const input of inputsV2) {
      const namedSpec = {
        ...input,
        name: names ? names[ordinal] : prefix + ordinal
      }
      addNodeInput(node, namedSpec)
      const addedInput = node.spliceInputs(node.inputs.length - 1, 1)[0]
      node.spliceInputs(insertionIndex++, 0, addedInput)
      inputGroup.push(namedSpec.name)
    }
    trackedInputs.push(inputGroup)
    app.canvas.setDirty(true, true)
  }
  addInputGroup(node.inputs.length)
  function removeInputGroup(inputName: string) {
    const groupIndex = trackedInputs.findIndex((ig) =>
      ig.some((inpName) => inpName === inputName)
    )
    if (groupIndex == -1) throw new Error('Failed to find group')
    const group = trackedInputs[groupIndex]
    for (const nameToRemove of group) {
      const inputIndex = nameToInputIndex(nameToRemove)
      node.spliceInputs(inputIndex, 1)
    }
    trackedInputs.splice(groupIndex, 1)
    node.size[1] = node.computeSize([...node.size])[1]
    app.canvas.setDirty(true, true)
  }

  function inputConnected(index: number) {
    const input = node.inputs[index]
    const groupIndex = trackedInputs.findIndex((ig) =>
      ig.some((inputName) => inputName === input.name)
    )
    if (groupIndex == -1) throw new Error('Failed to find group')
    if (
      groupIndex + 1 === trackedInputs.length &&
      trackedInputs.length < (max ?? names.length)
    ) {
      const lastInput = trackedInputs[groupIndex].at(-1)
      if (!lastInput) return
      const insertionIndex = nameToInputIndex(lastInput) + 1
      if (insertionIndex === 0) throw new Error('Failed to find Input')
      addInputGroup(insertionIndex)
    }
  }
  function inputDisconnected(index: number) {
    const input = node.inputs[index]
    if (trackedInputs.length === 1) return
    const groupIndex = trackedInputs.findIndex((ig) =>
      ig.some((inputName) => inputName === input.name)
    )
    if (groupIndex == -1) throw new Error('Failed to find group')
    if (
      trackedInputs[groupIndex].some(
        (inputName) => nameToInput(inputName).link != null
      )
    )
      return
    //For each group from here to last group, bubble swap links
    for (let column = 0; column < trackedInputs[0].length; column++) {
      let prevInput = nameToInputIndex(trackedInputs[groupIndex][column])
      for (let i = groupIndex + 1; i < trackedInputs.length; i++) {
        const curInput = nameToInputIndex(trackedInputs[i][column])
        const linkId = node.inputs[curInput].link
        node.inputs[prevInput].link = linkId
        const link = linkId && node.graph?.links?.[linkId]
        if (link) link.target_slot = prevInput
        prevInput = curInput
      }
      node.inputs[prevInput].link = null
    }
    if (
      trackedInputs.at(-2) &&
      !trackedInputs.at(-2)?.some((name) => !!nameToInput(name).link)
    )
      removeInputGroup(trackedInputs.at(-1)![0])
  }

  let pendingConnection: number | undefined
  let swappingConnection = false
  const originalOnConnectInput = node.onConnectInput
  node.onConnectInput = function (slot: number, ...args) {
    pendingConnection = slot
    setTimeout(() => (pendingConnection = undefined), 50)
    return originalOnConnectInput?.apply(this, [slot, ...args]) ?? true
  }
  node.onConnectionsChange = useChainCallback(
    node.onConnectionsChange,
    (type: ISlotType, index: number, isConnected: boolean) => {
      if (type !== NodeSlotType.INPUT) return
      const inputName = node.inputs[index].name
      if (!trackedInputs.flat().some((name) => name === inputName)) return
      if (isConnected) {
        if (swappingConnection) return
        inputConnected(index)
      } else {
        if (pendingConnection === index) {
          swappingConnection = true
          setTimeout(() => (swappingConnection = false), 50)
          return
        }
        inputDisconnected(index)
      }
    }
  )
}
//COMFY_AUTOGROW_V3
