import { without } from 'es-toolkit'
import { z } from 'zod'

import { useChainCallback } from '@/composables/functional/useChainCallback'
import { NodeSlotType } from '@/lib/litegraph/src/types/globalEnums'
import type {
  ISlotType,
  INodeInputSlot,
  INodeOutputSlot
} from '@/lib/litegraph/src/interfaces'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { LLink } from '@/lib/litegraph/src/LLink'
import { transformInputSpecV1ToV2 } from '@/schemas/nodeDef/migration'
import type { ComboInputSpec, InputSpec } from '@/schemas/nodeDefSchema'
import type { InputSpec as InputSpecV2 } from '@/schemas/nodeDef/nodeDefSchemaV2'
import { zBaseInputOptions, zComfyInputsSpec } from '@/schemas/nodeDefSchema'
import { useLitegraphService } from '@/services/litegraphService'
import { app } from '@/scripts/app'
import type { ComfyApp } from '@/scripts/app'

type MatchTypeNode = LGraphNode & {
  comfyMatchType?: Record<string, Record<string, string>>
}
const zAutogrowOptions = z.object({
  ...zBaseInputOptions.shape,
  template: z.object({
    input: zComfyInputsSpec,
    names: z.array(z.string()).optional(),
    max: z.number().optional(),
    //Backend defines as mandatory with min 1, Frontend is more forgiving
    min: z.number().optional(),
    prefix: z.string().optional()
  })
})

const zDynamicComboInputSpec = z.tuple([
  z.literal('COMFY_DYNAMICCOMBO_V3'),
  zBaseInputOptions.extend({
    options: z.array(
      z.object({
        inputs: zComfyInputsSpec,
        key: z.string()
      })
    )
  })
])

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
const dynamicInputs: Record<
  string,
  (node: LGraphNode, inputSpec: InputSpecV2) => void
> = {
  COMFY_AUTOGROW_V3: applyAutogrow,
  COMFY_MATCHTYPE_V3: applyMatchType
}

export function applyDynamicInputs(
  node: LGraphNode,
  inputSpec: InputSpecV2
): boolean {
  if (!(inputSpec.type in dynamicInputs)) return false
  //TODO: move parsing/validation of inputSpec here?
  dynamicInputs[inputSpec.type](node, inputSpec)
  return true
}

function changeOutputType(
  node: LGraphNode,
  output: INodeOutputSlot,
  combinedType: ISlotType
) {
  if (output.type === combinedType) return
  output.type = combinedType

  //check and potentially remove links
  if (!node.graph) return
  for (const link_id of output.links ?? []) {
    const link = node.graph.links[link_id]
    if (!link) continue
    const { input, inputNode, subgraphOutput } = link.resolve(node.graph)
    const inputType = (input ?? subgraphOutput)?.type
    if (!inputType) continue
    const keep = LiteGraph.isValidConnection(combinedType, inputType)
    if (!keep && subgraphOutput) subgraphOutput.disconnect()
    else if (!keep && inputNode) inputNode.disconnectInput(link.target_slot)
    if (input && inputNode?.onConnectionsChange)
      inputNode.onConnectionsChange(
        LiteGraph.INPUT,
        link.target_slot,
        keep,
        link,
        input
      )
  }
}

function isStrings(types: ISlotType[]): types is string[] {
  return !types.some((t) => typeof t !== 'string')
}

function combineTypes(...types: ISlotType[]): ISlotType | undefined {
  if (!isStrings(types)) return undefined

  const withoutWildcards = without(types, '*')
  if (withoutWildcards.length === 0) return '*'

  const typeLists: string[][] = withoutWildcards.map((type) => type.split(','))

  const combinedTypes = intersection(...typeLists)
  if (combinedTypes.length === 0) return undefined

  return combinedTypes.join(',')
}

function intersection(...sets: string[][]): string[] {
  const itemCounts: Record<string, number> = {}
  for (const set of sets)
    for (const item of new Set(set))
      itemCounts[item] = (itemCounts[item] ?? 0) + 1
  return Object.entries(itemCounts)
    .filter(([, count]) => count == sets.length)
    .map(([key]) => key)
}

function applyMatchType(node: LGraphNode, inputSpec: InputSpecV2) {
  const { addNodeInput } = useLitegraphService()
  const name = inputSpec.name
  const { allowed_types, template_id } = (
    inputSpec as InputSpecV2 & {
      template: { allowed_types: string; template_id: string }
    }
  ).template
  const typedSpec = { ...inputSpec, type: allowed_types }
  addNodeInput(node, typedSpec)
  //Sorry
  const augmentedNode = node as MatchTypeNode
  if (!augmentedNode.comfyMatchType) {
    augmentedNode.comfyMatchType = {}
    const outputGroups = node.constructor.nodeData?.output_matchtypes
    node.onConnectionsChange = useChainCallback(
      node.onConnectionsChange,
      function (
        this: LGraphNode,
        contype: ISlotType,
        slot: number,
        iscon: boolean,
        linf: LLink | null | undefined
      ) {
        const input = this.inputs[slot]
        if (contype !== LiteGraph.INPUT || !this.graph || !input) return
        const [matchKey, matchGroup] = Object.entries(
          augmentedNode.comfyMatchType!
        ).find(([, group]) => input.name in group) ?? ['', undefined]
        if (!matchGroup) return
        if (iscon && linf) {
          const { output, subgraphInput } = linf.resolve(this.graph)
          //TODO: fix this bug globally. A link type (and therefore color)
          //should be the combinedType of origin and target type
          const connectingType = (output ?? subgraphInput)?.type
          if (connectingType) linf.type = connectingType
        }
        //NOTE: inputs contains input
        const groupInputs: INodeInputSlot[] = node.inputs.filter(
          (inp) => inp.name in matchGroup
        )
        const connectedTypes = groupInputs.map((inp) => {
          if (!inp.link) return '*'
          const link = this.graph!.links[inp.link]
          if (!link) return '*'
          const { output, subgraphInput } = link.resolve(this.graph!)
          return (output ?? subgraphInput)?.type ?? '*'
        })
        //An input slot can accept a connection that is
        // - Compatible with original type
        // - Compatible with all other input types
        //An output slot can output
        // - Only what every input can output
        groupInputs.forEach((input, idx) => {
          const otherConnected = [
            ...connectedTypes.slice(0, idx),
            ...connectedTypes.slice(idx + 1)
          ]
          const combinedType = combineTypes(
            ...otherConnected,
            matchGroup[input.name]
          )
          if (!combinedType) throw new Error('invalid connection')
          input.type = combinedType
        })
        const outputType = combineTypes(...connectedTypes)
        if (!outputType) throw new Error('invalid connection')
        this.outputs.forEach((output, idx) => {
          if (!(outputGroups?.[idx] == matchKey)) return
          changeOutputType(this, output, outputType)
        })
        app.canvas?.setDirty(true, true)
      }
    )
  }
  augmentedNode.comfyMatchType[template_id] ??= {}
  augmentedNode.comfyMatchType[template_id][name] = allowed_types

  //TODO: instead apply on output add?
  //ensure outputs get updated
  const index = node.inputs.length - 1
  const input = node.inputs.at(-1)!
  setTimeout(
    () =>
      node.onConnectionsChange!(
        LiteGraph.INPUT,
        index,
        false,
        undefined,
        input
      ),
    50
  )
}

function applyAutogrow(node: LGraphNode, untypedInputSpec: InputSpecV2) {
  const { addNodeInput } = useLitegraphService()

  const parseResult = zAutogrowOptions.safeParse(untypedInputSpec)
  if (!parseResult.success) throw new Error('invalid Autogrow spec')
  const inputSpec = parseResult.data

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
        name: names ? names[ordinal] : (prefix ?? '') + ordinal,
        isOptional: ordinal >= (min ?? 0) || input.isOptional
      }
      inputGroup.push(namedSpec.name)
      if (node.inputs.some((inp) => inp.name === namedSpec.name)) continue
      addNodeInput(node, namedSpec)
      const addedInput = node.spliceInputs(node.inputs.length - 1, 1)[0]
      node.spliceInputs(insertionIndex++, 0, addedInput)
    }
    trackedInputs.push(inputGroup)
    app.canvas?.setDirty(true, true)
  }
  for (let i = 0; i < (min || 1); i++) addInputGroup(node.inputs.length)
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
    app.canvas?.setDirty(true, true)
  }

  function inputConnected(index: number) {
    const input = node.inputs[index]
    const groupIndex = trackedInputs.findIndex((ig) =>
      ig.some((inputName) => inputName === input.name)
    )
    if (groupIndex == -1) throw new Error('Failed to find group')
    if (
      groupIndex + 1 === trackedInputs.length &&
      trackedInputs.length < (max ?? names?.length ?? 100)
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
    if (groupIndex + 1 < (min ?? 0)) return
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
    (
      type: ISlotType,
      index: number,
      iscon: boolean,
      linf: LLink | null | undefined
    ) => {
      if (type !== NodeSlotType.INPUT) return
      const inputName = node.inputs[index].name
      if (!trackedInputs.flat().some((name) => name === inputName)) return
      if (iscon) {
        if (swappingConnection || !linf) return
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
