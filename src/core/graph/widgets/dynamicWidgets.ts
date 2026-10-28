import { range, remove } from 'es-toolkit'
import { shallowReactive } from 'vue'

import { assert } from '@/base/assert'
import { useChainCallback } from '@/composables/functional/useChainCallback'
import type { ISlotType } from '@comfyorg/graph-model/interfaces'
import type { INodeInputSlot } from '@comfyorg/graph-model/slots'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { LLink } from '@/lib/litegraph/src/LLink'
import { commonType } from '@/lib/litegraph/src/utils/type'
import {
  getWidgetIds,
  resolveNodeRootGraphId
} from '@/lib/litegraph/src/utils/widget'
import { transformInputSpecV1ToV2 } from '@comfyorg/object-info-parser/migration'
import type { ComboInputSpec, InputSpec } from '@comfyorg/object-info-parser'
import type { InputSpec as InputSpecV2 } from '@comfyorg/object-info-parser/schemas/nodeDefSchemaV2'
import {
  zAutogrowOptions,
  zDynamicComboInputSpec,
  zMatchTypeOptions
} from '@comfyorg/object-info-parser'
import { useLitegraphServiceAccess } from '@/core/graph/litegraphServiceAccess'
import { addShimWidget } from '@/core/graph/widgets/inputWidgetStub'
import { useApp } from '@/scripts/appInstance'
import type { ComfyApp } from '@/types/comfy'
import {
  captureInputLayout,
  replaceNodeInputs
} from '@/lib/litegraph/src/node/slotLinks'
import type { InputLayoutSnapshot } from '@/lib/litegraph/src/node/slotLinks'
import { useLinkStore } from '@/stores/linkStore'
import { graphScopeOf } from '@comfyorg/graph-model/graphScopeId'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import type { WidgetValue } from '@/types/simplifiedWidget'
import { widgetId } from '@comfyorg/graph-model/widgetId'
import { dynamicGroupWidget } from './dynamicGroupWidget'
import { realignInputLinkSlots } from '@/lib/litegraph/src/linkDeduplication'
import type { ISerialisedNode } from '@comfyorg/graph-model/serialisation'

type MatchTypeNode = LGraphNode &
  Pick<Required<LGraphNode>, 'onConnectionsChange'> & {
    comfyDynamic: { matchType: Record<string, Record<string, string>> }
  }
type AutogrowNode = LGraphNode &
  Pick<Required<LGraphNode>, 'onConnectionsChange' | 'widgets'> & {
    comfyDynamic: {
      autogrow: Record<
        string,
        {
          min: number
          max: number
          inputSpecs: InputSpecV2[]
          prefix?: string
          names?: string[]
        }
      >
    }
  }

function commitMutatedInputs(
  node: LGraphNode,
  previous: InputLayoutSnapshot,
  assignments: ReadonlyMap<INodeInputSlot, LLink>
) {
  const finalInputs = [...node.inputs]
  node.inputs.splice(0, node.inputs.length, ...previous.inputs)
  return replaceNodeInputs(node, previous, finalInputs, assignments)
}

function syncNodeWidgetOrder(node: LGraphNode) {
  const graphId = resolveNodeRootGraphId(node)
  if (!graphId || !node.widgets) return
  useWidgetValueStore().setNodeWidgetOrder(
    graphId,
    node.id,
    getWidgetIds(node.widgets)
  )
}

function ensureWidgetForInput(node: LGraphNode, input: INodeInputSlot) {
  const { widget } = input
  if (!widget || !node.widgets?.some((w) => w.name === widget.name))
    addShimWidget(node, input)
}

function dynamicComboWidget(
  node: LGraphNode,
  inputName: string,
  untypedInputData: InputSpec,
  appArg: ComfyApp,
  widgetName?: string
) {
  const { addNodeInput } = useLitegraphServiceAccess()
  const { deleteWidget } = useWidgetValueStore()
  const parseResult = zDynamicComboInputSpec.safeParse(untypedInputData)
  if (!parseResult.success) throw new Error('invalid DynamicCombo spec')
  const inputData = parseResult.data
  const options = Object.fromEntries(
    inputData[1].options.map(({ key, inputs }) => [key, inputs])
  )
  const subSpec: ComboInputSpec = [Object.keys(options), {}]
  const result = useApp().widgets.COMBO(
    node,
    inputName,
    subSpec,
    appArg,
    widgetName
  )
  assert(
    result && 'widget' in result && result.widget,
    'COMBO widget constructor returned no widget'
  )
  const { widget, minWidth, minHeight } = result
  const removedWidgetValues = new Map<
    string | undefined,
    Map<string, { type: string; value: WidgetValue }>
  >()
  let activeOption = widget.value as string | undefined
  function isInGroup(e: { name: string }): boolean {
    return e.name.startsWith(inputName + '.')
  }
  function restoreRemovedValues(
    value: string | undefined,
    widgetNames: string[]
  ) {
    const widgets = node.widgets
    if (!widgets) return
    const graphId = resolveNodeRootGraphId(node)
    const removedValues = removedWidgetValues.get(value)
    const names = new Set(widgetNames)
    for (const name of removedValues?.keys() ?? []) names.add(name)
    for (const name of names) {
      const addedWidget = widgets.find((widget) => widget.name === name)
      if (!addedWidget) continue
      const removed = removedValues?.get(name)
      const positionalIndex = widgets
        .filter((widget) => widget.serialize !== false)
        .indexOf(addedWidget)
      const restored =
        graphId && positionalIndex >= 0
          ? useWidgetValueStore().getRestoredWidgetValue(
              graphId,
              node.id,
              addedWidget,
              positionalIndex
            )
          : undefined
      if (!restored && removed?.type === addedWidget.type) {
        addedWidget.value = removed.value
      }
    }
  }
  const updateWidgets = (value?: string) => {
    if (!node.widgets) throw new Error('Not Reachable')
    const newSpec = value ? options[value] : undefined
    const removedOption = activeOption
    activeOption = value

    const previous = captureInputLayout(node)
    const inputLinks = new Map(previous.links)
    const removedInputs = remove(node.inputs, isInGroup)
    for (const widget of remove(node.widgets, isInGroup)) {
      const optionValues = removedWidgetValues.get(removedOption) ?? new Map()
      optionValues.set(widget.name, {
        type: widget.type,
        value: widget.value
      })
      removedWidgetValues.set(removedOption, optionValues)
      widget.onRemove?.()
      if (widget.widgetId) deleteWidget(widget.widgetId)
    }

    if (!newSpec) {
      const result = commitMutatedInputs(node, previous, inputLinks)
      if (!result.ok) return
      syncNodeWidgetOrder(node)
      return
    }

    const insertionPoint = node.widgets.findIndex((w) => w === widget) + 1
    const startingLength = node.widgets.length
    const startingInputLength = node.inputs.length

    if (insertionPoint === 0)
      throw new Error("Dynamic widget doesn't exist on node")
    const inputTypes: (Record<string, InputSpec> | undefined)[] = [
      newSpec.required,
      newSpec.optional
    ]
    inputTypes.forEach((inputType, idx) => {
      for (const key in inputType ?? {}) {
        const name = `${widget.name}.${key}`
        const specToAdd = transformInputSpecV1ToV2(inputType![key], {
          name,
          isOptional: idx !== 0
        })
        specToAdd.display_name = key
        addNodeInput(node, specToAdd)
      }
    })

    const inputInsertionPoint =
      node.inputs.findIndex((i) => i.name === widget.name) + 1
    const addedWidgets = node.widgets.splice(startingLength)
    const addedWidgetNames = addedWidgets.map(({ name }) => name)
    node.widgets.splice(insertionPoint, 0, ...addedWidgets)
    syncNodeWidgetOrder(node)
    if (inputInsertionPoint === 0) {
      if (
        addedWidgets.length === 0 &&
        node.inputs.length !== startingInputLength
      )
        //input is inputOnly, but lacks an insertion point
        throw new Error('Failed to find input socket for ' + widget.name)
      const result = commitMutatedInputs(node, previous, inputLinks)
      if (!result.ok) return
      restoreRemovedValues(value, addedWidgetNames)
      return
    }
    const addedInputs = node.inputs
      .splice(startingInputLength)
      .map((addedInput) => {
        const existingInput = node.inputs.findIndex(
          (existingInput) => addedInput.name === existingInput.name
        )
        return existingInput === -1
          ? addedInput
          : node.inputs.splice(existingInput, 1)[0]
      })
    //assume existing inputs are in correct order
    node.inputs.splice(inputInsertionPoint, 0, ...addedInputs)

    for (const input of removedInputs) {
      const replacement = node.inputs.find((item) => item.name === input.name)
      const link = inputLinks.get(input)
      if (replacement && link) inputLinks.set(replacement, link)
    }
    const result = commitMutatedInputs(node, previous, inputLinks)
    if (!result.ok) return
    //A callback can grow the group it lands on, shifting every input after
    //it, so the slot captured before the batch is stale for later entries.
    for (const { input, link } of result.replacements) {
      const slot = node.inputs.indexOf(input)
      if (slot === -1) continue
      node.onConnectionsChange?.(LiteGraph.INPUT, slot, true, link, input)
    }
    restoreRemovedValues(value, addedWidgetNames)

    if (!node.graph) return
    node._setConcreteSlots()
    node.arrange()
    node.graph.setDirtyCanvas(true, true)
  }
  //Refit height on the callback channel: interaction fires it after the value
  //setter, while configure (load, clone, paste) only fires the setter and must
  //keep the serialised height.
  widget.callback = useChainCallback(widget.callback, () => {
    node.size = [node.size[0], node.computeSize([...node.size])[1]]
    node.graph?.setDirtyCanvas(true, true)
  })
  //A little hacky, but onConfigure won't work.
  //It fires too late and is overly disruptive
  let widgetValue = widget.value
  const getState = () => {
    const graphId = resolveNodeRootGraphId(node)
    if (!graphId) return undefined
    return useWidgetValueStore().getWidget(
      widgetId(graphId, node.id, widget.name)
    )
  }
  Object.defineProperty(widget, 'value', {
    get() {
      return getState()?.value ?? widgetValue
    },
    set(value) {
      const state = getState()
      if (state) state.value = value
      widgetValue = value
      updateWidgets(value)
    }
  })
  widget.value = widgetValue
  return { widget, minWidth, minHeight }
}

export const dynamicWidgets = {
  COMFY_DYNAMICCOMBO_V3: dynamicComboWidget,
  COMFY_DYNAMICGROUP_V3: dynamicGroupWidget
}
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
  slot: number,
  combinedType: ISlotType
) {
  const output = node.outputs[slot]
  if (output.type === combinedType) return
  output.type = combinedType

  //check and potentially remove links
  if (!node.graph) return
  const topologies = useLinkStore().getOutputSlotLinks(
    graphScopeOf(node.graph),
    node.id,
    slot
  )
  for (const topology of topologies) {
    const link = node.graph.getLink(topology.id)
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

function withComfyMatchType(node: LGraphNode): asserts node is MatchTypeNode {
  if (node.comfyDynamic?.matchType) return
  node.comfyDynamic ??= {}
  node.comfyDynamic.matchType = {}

  const outputGroups = node.constructor.nodeData?.output_matchtypes
  node.onConnectionsChange = useChainCallback(
    node.onConnectionsChange,
    function (
      this: MatchTypeNode,
      contype: ISlotType,
      slot: number,
      iscon: boolean,
      linf: LLink | null | undefined
    ) {
      const input = this.inputs.at(slot)
      const { graph } = this
      if (contype !== LiteGraph.INPUT || !graph || !input) return
      if (useApp().configuringGraph) return
      const [matchKey, matchGroup] = Object.entries(
        this.comfyDynamic.matchType
      ).find(([, group]) => input.name in group) ?? ['', undefined]
      if (!matchGroup) return
      if (iscon && linf) {
        const { output, subgraphInput } = linf.resolve(graph)
        const connectingType = (output ?? subgraphInput)?.type
        if (connectingType) linf.type = connectingType
      }
      //NOTE: inputs contains input
      const groupInputs: INodeInputSlot[] = node.inputs.filter(
        (inp) => inp.name in matchGroup
      )
      const connectedTypes = groupInputs.map((inp) => {
        const link = this.getInputLink(this.inputs.indexOf(inp))
        if (!link) return '*'
        const { output, subgraphInput } = link.resolve(graph)
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
        const combinedType = commonType(
          ...otherConnected,
          matchGroup[input.name]
        )
        if (!combinedType) throw new Error('invalid connection')
        input.type = combinedType
      })
      const outputType = commonType(...connectedTypes)
      if (!outputType) throw new Error('invalid connection')
      this.outputs.forEach((_output, idx) => {
        if (!(outputGroups?.[idx] == matchKey)) return
        changeOutputType(this, idx, outputType)
      })
      graph.setDirtyCanvas(true, true)
    }
  )
}

function applyMatchType(node: LGraphNode, inputSpec: InputSpecV2) {
  const { addNodeInput } = useLitegraphServiceAccess()
  const name = inputSpec.name
  const parseResult = zMatchTypeOptions.safeParse(inputSpec)
  if (!parseResult.success) {
    console.warn(
      `Unparseable COMFY_MATCHTYPE_V3 spec for input "${name}"; falling back to a wildcard socket.`,
      parseResult.error.issues
    )
    addNodeInput(node, { ...inputSpec, type: '*' })
    return
  }
  const matchTypeSpec = parseResult.data

  const { allowed_types, template_id } = matchTypeSpec.template
  const typedSpec = { ...inputSpec, type: allowed_types }
  addNodeInput(node, typedSpec)
  withComfyMatchType(node)
  node.comfyDynamic.matchType[template_id] ??= {}
  node.comfyDynamic.matchType[template_id][name] = allowed_types

  //TODO: instead apply on output add?
  //ensure outputs get updated
  const index = node.inputs.length - 1
  requestAnimationFrame(() => {
    const input = node.inputs.at(index)
    if (!input || !node.graph) return
    node.inputs[index] = shallowReactive(input)
    const existingLink = node.getInputLink(index)
    node.onConnectionsChange(
      LiteGraph.INPUT,
      index,
      !!existingLink,
      existingLink ?? undefined,
      input
    )
  })
}

function autogrowOrdinalToName(
  ordinal: number,
  key: string,
  groupName: string,
  node: AutogrowNode
) {
  const {
    names,
    prefix = '',
    inputSpecs
  } = node.comfyDynamic.autogrow[groupName]
  const baseName = names
    ? names[ordinal]
    : (inputSpecs.length == 1 ? prefix : key) + ordinal
  return { name: `${groupName}.${baseName}`, display_name: baseName }
}

function addAutogrowGroup(
  ordinal: number,
  groupName: string,
  node: AutogrowNode
) {
  const { addNodeInput } = useLitegraphServiceAccess()
  const { max, min, inputSpecs } = node.comfyDynamic.autogrow[groupName]
  if (ordinal >= max) return

  const previous = captureInputLayout(node)
  const inputLinks = new Map(previous.links)
  const namedSpecs = inputSpecs.map((input) => ({
    ...input,
    isOptional: ordinal >= min || input.isOptional,
    ...autogrowOrdinalToName(ordinal, input.name, groupName, node)
  }))

  const existingIndex = node.inputs.findIndex(
    (inp) => inp.name === namedSpecs[0].name
  )
  const newInputs = namedSpecs.map((namedSpec) => {
    addNodeInput(node, namedSpec)
    const input = node.inputs.splice(node.inputs.length - 1, 1)[0]
    if (inputSpecs.length !== 1) ensureWidgetForInput(node, input)
    return input
  })

  for (const newInput of newInputs) {
    for (const existingInput of remove(
      node.inputs,
      (inp) => inp.name === newInput.name
    )) {
      const link = inputLinks.get(existingInput)
      if (link && !inputLinks.has(newInput)) inputLinks.set(newInput, link)
      if (existingInput.label) newInput.label = existingInput.label
    }
  }

  const targetName = autogrowOrdinalToName(
    ordinal - 1,
    inputSpecs.at(-1)!.name,
    groupName,
    node
  ).name
  const lastIndex = node.inputs.findLastIndex((inp) =>
    inp.name.startsWith(targetName)
  )
  const insertionIndex =
    lastIndex !== -1
      ? lastIndex + 1
      : existingIndex !== -1
        ? existingIndex
        : node.inputs.length
  node.inputs.splice(insertionIndex, 0, ...newInputs)
  const result = commitMutatedInputs(node, previous, inputLinks)
  if (!result.ok) return
  node.graph?.setDirtyCanvas(true, true)
}

const ORDINAL_REGEX = /\d+$/

function resolveAutogrowOrdinal(
  inputName: string,
  groupName: string,
  node: AutogrowNode
): number | undefined {
  const name = inputName.slice(groupName.length + 1)
  const { names } = node.comfyDynamic.autogrow[groupName]
  if (names) {
    const index = names.indexOf(name)
    return index === -1 ? undefined : index
  }
  const match = name.match(ORDINAL_REGEX)
  return match ? parseInt(match[0]) : undefined
}
function hasAutogrowGroups(node: LGraphNode): node is AutogrowNode {
  return !!node.comfyDynamic?.autogrow
}

/**
 * The live autogrow group `name` belongs to, from the node's own
 * `comfyDynamic.autogrow` registration -- real provenance from
 * `applyAutogrow`/`addAutogrowGroup`, rather than inferred from the name's
 * shape. Confirms membership with `resolveAutogrowOrdinal`, the same check
 * growth and shrink use, so a name that merely starts with a group's prefix
 * without resolving to one of its members doesn't false-match. Undefined
 * when the node has no autogrow groups, or `name` isn't a member of any of
 * them.
 */
export function liveAutogrowGroupOf(
  node: LGraphNode,
  name: string
): string | undefined {
  if (!hasAutogrowGroups(node)) return undefined
  for (const groupName of Object.keys(node.comfyDynamic.autogrow)) {
    if (!name.startsWith(`${groupName}.`)) continue
    if (resolveAutogrowOrdinal(name, groupName, node) !== undefined) {
      return groupName
    }
  }
  return undefined
}

/**
 * Grows the autogrow group `name` belongs to until the node holds an input by
 * that name, and returns its live index. Undefined when `name` belongs to no
 * autogrow group of this node, or the group's `max` stops short of it.
 */
export function growAutogrowInput(
  node: LGraphNode,
  name: string
): number | undefined {
  const groupName = liveAutogrowGroupOf(node, name)
  if (groupName === undefined || !hasAutogrowGroups(node)) return undefined
  reconcileAutogrowGroup(groupName, node, {
    atLeast: resolveAutogrowOrdinal(name, groupName, node)
  })
  const index = node.inputs.findIndex((input) => input.name === name)
  return index === -1 ? undefined : index
}

function reconcileAutogrowGroup(
  groupName: string,
  node: AutogrowNode,
  { atLeast = -1, compactFrom = Infinity } = {}
) {
  if (!Object.hasOwn(node.comfyDynamic.autogrow, groupName)) return
  const { min, max, inputSpecs } = node.comfyDynamic.autogrow[groupName]
  const start = Math.min(compactFrom, max)
  const nameAt = (ordinal: number, column: number) =>
    autogrowOrdinalToName(ordinal, inputSpecs[column].name, groupName, node)
      .name
  const inputAt = (ordinal: number, column: number) =>
    node.inputs.find((input) => input.name === nameAt(ordinal, column))

  const before = captureInputLayout(node)
  const linkAt = (ordinal: number, column: number) => {
    const input = inputAt(ordinal, column)
    return input && before.links.get(input)
  }
  const packed = inputSpecs.map((_, column) =>
    range(start, max).flatMap((ordinal) => linkAt(ordinal, column) ?? [])
  )
  const highestLinked = Math.max(
    -1,
    ...range(0, start).filter((ordinal) =>
      inputSpecs.some((_, column) => linkAt(ordinal, column))
    ),
    ...packed.flatMap((links) =>
      links.length ? [start + links.length - 1] : []
    )
  )
  const last = Math.min(max - 1, Math.max(min, highestLinked + 1, atLeast))

  for (const ordinal of range(0, last + 1))
    if (!inputAt(ordinal, 0)) addAutogrowGroup(ordinal, groupName, node)

  const layout = captureInputLayout(node)
  const assignments = new Map(layout.links)
  const moved: { input: INodeInputSlot; link: LLink }[] = []
  for (const [column, links] of packed.entries()) {
    for (const ordinal of range(start, last + 1)) {
      const input = inputAt(ordinal, column)
      if (input) assignments.delete(input)
    }
    for (const [offset, link] of links.entries()) {
      const input = inputAt(start + offset, column)
      if (!input) continue
      assignments.set(input, link)
      if (layout.links.get(input) !== link) moved.push({ input, link })
    }
  }
  const removed = layout.inputs.filter((input) => {
    if (!input.name.startsWith(`${groupName}.`)) return false
    const ordinal = resolveAutogrowOrdinal(input.name, groupName, node)
    return ordinal !== undefined && ordinal > last && compactFrom !== Infinity
  })
  if (!moved.length && !removed.length) return

  const result = replaceNodeInputs(
    node,
    layout,
    layout.inputs.filter((input) => !removed.includes(input)),
    assignments
  )
  if (!result.ok) return
  node.graph?.setDirtyCanvas(true, true)

  for (const { input, link } of moved) {
    const slot = node.inputs.indexOf(input)
    if (slot !== -1)
      node.onConnectionsChange(LiteGraph.INPUT, slot, true, link, input)
  }
  for (const input of removed) {
    const widgetName = input.widget?.name
    if (!widgetName) continue
    for (const widget of remove(node.widgets, (w) => w.name === widgetName)) {
      widget.onRemove?.()
      if (widget.widgetId) useWidgetValueStore().deleteWidget(widget.widgetId)
    }
    syncNodeWidgetOrder(node)
  }
  node.size = [node.size[0], node.computeSize([...node.size])[1]]
}

function restoreAutogrowGroup(
  groupName: string,
  node: AutogrowNode,
  info: ISerialisedNode
) {
  const { min, max } = node.comfyDynamic.autogrow[groupName]
  const requiredOrdinals = (info.inputs ?? []).flatMap((input) => {
    if (!input.name.startsWith(`${groupName}.`)) return []
    const ordinal = resolveAutogrowOrdinal(input.name, groupName, node)
    if (ordinal === undefined) return []
    return [input.link == null ? ordinal : ordinal + 1]
  })
  const last = Math.min(Math.max(min, ...requiredOrdinals), max - 1)
  for (let ordinal = 0; ordinal <= last; ordinal++)
    addAutogrowGroup(ordinal, groupName, node)
}

function trimAutogrowGroups(node: AutogrowNode) {
  for (const [groupName, { max }] of Object.entries(node.comfyDynamic.autogrow))
    reconcileAutogrowGroup(groupName, node, { compactFrom: max })
}

function withComfyAutogrow(node: LGraphNode): asserts node is AutogrowNode {
  if (node.comfyDynamic?.autogrow) return
  node.comfyDynamic ??= {}
  node.comfyDynamic.autogrow = {}

  node.onConfigure = useChainCallback(
    node.onConfigure,
    function (this: AutogrowNode, info: ISerialisedNode) {
      for (const groupName of Object.keys(this.comfyDynamic.autogrow))
        restoreAutogrowGroup(groupName, this, info)
      if (this.graph) realignInputLinkSlots(this.graph, [[this.id, info]])
      else trimAutogrowGroups(this)
    }
  )

  node.onGraphConfigured = useChainCallback(
    node.onGraphConfigured,
    function (this: AutogrowNode) {
      trimAutogrowGroups(this)
    }
  )

  node.onConnectionsChange = useChainCallback(
    node.onConnectionsChange,
    function (this: AutogrowNode, contype: ISlotType, slot: number, iscon) {
      const input = this.inputs.at(slot)
      if (contype !== LiteGraph.INPUT || !input || useApp().configuringGraph)
        return
      const groupName = liveAutogrowGroupOf(this, input.name)
      if (groupName === undefined) return
      if (iscon) return reconcileAutogrowGroup(groupName, this)
      const { min } = this.comfyDynamic.autogrow[groupName]
      const ordinal = resolveAutogrowOrdinal(input.name, groupName, this)
      if (ordinal === undefined || ordinal + 1 < min) return
      requestAnimationFrame(() =>
        reconcileAutogrowGroup(groupName, this, { compactFrom: ordinal })
      )
    }
  )
}
function applyAutogrow(node: LGraphNode, inputSpecV2: InputSpecV2) {
  withComfyAutogrow(node)

  const parseResult = zAutogrowOptions.safeParse(inputSpecV2)
  if (!parseResult.success) throw new Error('invalid Autogrow spec')
  const inputSpec = parseResult.data
  const { input, min = 1, names, prefix, max = 100 } = inputSpec.template

  const inputTypes: (Record<string, InputSpec> | undefined)[] = [
    input.required,
    input.optional
  ]
  const inputsV2 = inputTypes.flatMap((inputType, index) =>
    Object.entries(inputType ?? {}).map(([name, v]) =>
      transformInputSpecV1ToV2(v, { name, isOptional: index === 1 })
    )
  )
  node.comfyDynamic.autogrow[inputSpecV2.name] = {
    names,
    min,
    max: names?.length ?? max,
    prefix,
    inputSpecs: inputsV2
  }
  for (let i = 0; i === 0 || i < min + 1; i++)
    addAutogrowGroup(i, inputSpecV2.name, node)
}
