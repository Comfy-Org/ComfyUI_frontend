import { remove } from 'es-toolkit'
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
import { transformInputSpecV1ToV2 } from '@/schemas/nodeDef/migration'
import type { ComboInputSpec, InputSpec } from '@/schemas/nodeDefSchema'
import type { InputSpec as InputSpecV2 } from '@/schemas/nodeDef/nodeDefSchemaV2'
import {
  zAutogrowOptions,
  zDynamicComboInputSpec,
  zMatchTypeOptions
} from '@/schemas/nodeDefSchema'
import { useLitegraphServiceAccess } from '@/core/graph/litegraphServiceAccess'
import { useApp } from '@/scripts/appInstance'
import type { ComfyApp } from '@/types/comfy'
import {
  captureInputLayout,
  replaceNodeInputs
} from '@/lib/litegraph/src/node/slotLinks'
import type { InputLayoutSnapshot } from '@/lib/litegraph/src/node/slotLinks'
import { SUBGRAPH_INPUT_ID } from '@/lib/litegraph/src/constants'
import { nextUniqueName } from '@/lib/litegraph/src/strings'
import type {
  ResolvedConnection,
  Subgraph,
  SubgraphInput,
  SubgraphNode
} from '@comfyorg/graph-model/entityRegistry'
import { useLinkStore } from '@/stores/linkStore'
import { graphScopeOf } from '@comfyorg/graph-model/graphScopeId'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import type { WidgetValue } from '@/types/simplifiedWidget'
import { widgetId } from '@comfyorg/graph-model/widgetId'
import { dynamicGroupWidget } from './dynamicGroupWidget'

type MatchTypeNode = LGraphNode &
  Pick<Required<LGraphNode>, 'onConnectionsChange'> & {
    comfyDynamic: { matchType: Record<string, Record<string, string>> }
  }
interface AutogrowTemplate {
  min: number
  max: number
  inputSpecs: InputSpecV2[]
  prefix?: string
  names?: string[]
}
type AutogrowNode = LGraphNode &
  Pick<Required<LGraphNode>, 'onConnectionsChange' | 'widgets'> & {
    comfyDynamic: { autogrow: Record<string, AutogrowTemplate> }
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
  node.widgets ??= []
  const { widget } = input
  if (widget && node.widgets.some((w) => w.name === widget.name)) return
  node.widgets.push({
    draw(ctx, _n, _w, y) {
      ctx.save()
      ctx.fillStyle = LiteGraph.NODE_TEXT_COLOR
      ctx.fillText(input.label ?? input.name, 20, y + 15)
      ctx.restore()
    },
    name: input.name,
    options: {},
    serialize: false,
    type: 'shim',
    y: 0
  })
  input.alwaysVisible = true
  input.widget = { name: input.name }
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
  const insertionIndex = lastIndex === -1 ? node.inputs.length : lastIndex + 1
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
function autogrowInputConnected(index: number, node: AutogrowNode) {
  const input = node.inputs.at(index)
  if (!input) return
  const groupName = input.name.slice(0, input.name.lastIndexOf('.'))
  if (listSourceOf(node, index)) return feedFromList(node, input, groupName)
  const lastInput = node.inputs.findLast((inp) =>
    inp.name.startsWith(groupName + '.')
  )
  const ordinal = resolveAutogrowOrdinal(input.name, groupName, node)
  if (
    !lastInput ||
    ordinal == undefined ||
    (ordinal !== resolveAutogrowOrdinal(lastInput.name, groupName, node) &&
      !useApp().configuringGraph)
  )
    return
  addAutogrowGroup(ordinal + 1, groupName, node)
}

const listLabel = (groupName: string) => groupName.replace(/\[\]$/, '')

function feedFromList(
  node: AutogrowNode,
  input: INodeInputSlot,
  groupName: string
) {
  const ordinal = resolveAutogrowOrdinal(input.name, groupName, node) ?? 0
  const later = node.inputs.filter(
    (inp) =>
      inp.name.startsWith(groupName + '.') &&
      (resolveAutogrowOrdinal(inp.name, groupName, node) ?? -1) > ordinal
  )
  const previous = captureInputLayout(node)
  const kept = node.inputs.filter((inp) => !later.includes(inp))
  if (later.length && !replaceNodeInputs(node, previous, kept).ok) return
  const min = node.comfyDynamic.autogrow[groupName].min - ordinal
  input.label = `${listLabel(groupName)} (list${min > 1 ? `, min ${min}` : ''})`
  node.size = [node.size[0], node.computeSize([...node.size])[1]]
}

function listTemplateAt(
  node: LGraphNode,
  slot: number
): (AutogrowTemplate & { slotNames: string[] }) | undefined {
  const input = node.inputs.at(slot)
  const groupName = input && liveAutogrowGroupOf(node, input.name)
  if (!groupName || !hasAutogrowGroups(node)) return undefined
  const { min, max, inputSpecs } = node.comfyDynamic.autogrow[groupName]
  const ordinal = resolveAutogrowOrdinal(input.name, groupName, node)
  //Single-input templates only, so that one list item fills one slot
  if (inputSpecs.length !== 1 || ordinal === undefined) return undefined
  const slots = Array.from({ length: max - ordinal }, (_, offset) =>
    autogrowOrdinalToName(ordinal + offset, inputSpecs[0].name, groupName, node)
  )
  return {
    min: Math.max(0, min - ordinal),
    max: slots.length,
    names: slots.map(({ display_name }) => display_name),
    slotNames: slots.map(({ name }) => name),
    inputSpecs
  }
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

function highestAutogrowOrdinal(node: AutogrowNode, groupName: string): number {
  let highest = -1
  for (const input of node.inputs) {
    if (!input.name.startsWith(`${groupName}.`)) continue
    const ordinal = resolveAutogrowOrdinal(input.name, groupName, node)
    if (ordinal !== undefined && ordinal > highest) highest = ordinal
  }
  return highest
}

/**
 * Grows the autogrow group `name` belongs to until the node holds an input by
 * that name, and returns its live index. A local connect onto a slot the bound
 * document has not seen mints a `grow` op (`docOpMinter.mintConnect`); this is
 * the read leg of that exchange, for a slot the host grew whose live
 * counterpart does not exist yet. Growth starts above the group's highest live
 * ordinal, so the slots already carrying links are left alone. Undefined when
 * `name` belongs to no autogrow group of this node, or the group's `max` stops
 * short of it.
 */
export function growAutogrowInput(
  node: LGraphNode,
  name: string
): number | undefined {
  if (!hasAutogrowGroups(node)) return undefined
  const groupName = liveAutogrowGroupOf(node, name)
  if (groupName === undefined) return undefined
  const ordinal = resolveAutogrowOrdinal(name, groupName, node)
  if (ordinal === undefined) return undefined
  for (
    let next = highestAutogrowOrdinal(node, groupName) + 1;
    next <= ordinal;
    next++
  ) {
    addAutogrowGroup(next, groupName, node)
  }
  const index = node.inputs.findIndex((input) => input.name === name)
  return index === -1 ? undefined : index
}

function autogrowInputDisconnected(index: number, node: AutogrowNode) {
  const input = node.inputs.at(index)
  if (!input) return
  //The slot was reconnected before this deferred compaction ran (e.g. a
  //connect/disconnect/reconnect sequence in immediate succession); the
  //compaction is stale and must not run against the slot's new link.
  if (node.inputs.at(index)?.link != null) return
  const groupName = input.name.slice(0, input.name.lastIndexOf('.'))
  const autogrowGroup = Object.hasOwn(node.comfyDynamic.autogrow, groupName)
    ? node.comfyDynamic.autogrow[groupName]
    : undefined
  if (!autogrowGroup) return

  const { min, inputSpecs } = autogrowGroup
  const ordinal = resolveAutogrowOrdinal(input.name, groupName, node)
  if (ordinal == undefined || ordinal + 1 < min) return

  //resolve all inputs in group
  const groupInputs = node.inputs.filter(
    (inp) =>
      inp.name.startsWith(groupName + '.') &&
      inp.name.lastIndexOf('.') === groupName.length
  )
  const stride = inputSpecs.length
  if (stride + index >= node.inputs.length) return
  if (groupInputs.length % stride !== 0) {
    console.error('Failed to group multi-input autogrow inputs')
    return
  }
  node.graph?.setDirtyCanvas(true, true)
  const previous = captureInputLayout(node)
  const inputLinks = new Map(previous.links)
  const transplants: { input: INodeInputSlot; link: LLink }[] = []

  for (let column = 0; column < stride; column++) {
    for (
      let bubbleOrdinal = ordinal * stride + column;
      bubbleOrdinal + stride < groupInputs.length;
      bubbleOrdinal += stride
    ) {
      const input = groupInputs[bubbleOrdinal]
      const donor = groupInputs[bubbleOrdinal + stride]
      const link = inputLinks.get(donor)
      inputLinks.delete(input)
      inputLinks.delete(donor)
      if (link) {
        inputLinks.set(input, link)
        transplants.push({ input, link })
      }
    }
  }

  const removalChecks = groupInputs.slice(min * stride)
  let i
  for (i = removalChecks.length - stride; i >= 0; i -= stride) {
    if (
      removalChecks.slice(i, i + stride).some((input) => inputLinks.has(input))
    )
      break
  }
  const toRemove = removalChecks.slice(i + stride * 2)
  const finalInputs = node.inputs.filter((input) => !toRemove.includes(input))
  const result = replaceNodeInputs(node, previous, finalInputs, inputLinks)
  if (!result.ok) return

  for (const { input, link } of transplants) {
    const slot = node.inputs.indexOf(input)
    if (slot === -1) continue
    node.onConnectionsChange(LiteGraph.INPUT, slot, true, link, input)
  }
  for (const input of toRemove) {
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

function withComfyAutogrow(node: LGraphNode): asserts node is AutogrowNode {
  if (node.comfyDynamic?.autogrow) return
  node.comfyDynamic ??= {}
  node.comfyDynamic.autogrow = {}
  node.getListSlotNames = (slot) => listTemplateAt(node, slot)?.slotNames

  let pendingConnection: number | undefined
  //Whether the input-side `connect` event for `pendingConnection` has
  //already fired. `connectSlots` (LGraphNode.ts) calls `onConnectInput`
  //synchronously before it does anything else, then - only when the slot
  //is replacing an existing link (a real swap) - fires the *disconnect*
  //event for the old link before the *connect* event for the new one, all
  //in the same synchronous call. So a disconnect that arrives for
  //`pendingConnection` before its connect event has been seen is the
  //synchronous tail of that swap. A disconnect that arrives *after* the
  //connect event has already fired is a separate, later operation (e.g.
  //the user - or an agent applying CRDT ops with no render yield between
  //them - immediately disconnecting the slot it just connected) and must
  //not be mistaken for a swap just because it lands within the same
  //rAF-bounded window (PM-1496).
  let pendingConnectionSeen = false
  //Which slot, if any, is mid a same-slot swap: `connectSlots` just fired
  //that slot's disconnect (the swap's tail, detected above) and its
  //matching connect event is expected synchronously right after. Scoped
  //to a single slot - not node-wide - so a genuine connect on a
  //*different* slot of this node in between is never mistaken for the
  //swap's own connect and silently dropped. Cleared deterministically by
  //the connection lifecycle itself (the matching connect event) rather
  //than solely by a frame boundary, so it cannot stay armed indefinitely
  //while `requestAnimationFrame` is suspended (e.g. a hidden background
  //tab); the frame-boundary reset below is only a defensive fallback.
  let swappingSlot: number | undefined

  const originalOnConnectInput = node.onConnectInput
  node.onConnectInput = function (slot: number, ...args) {
    pendingConnection = slot
    pendingConnectionSeen = false
    requestAnimationFrame(() => {
      pendingConnection = undefined
      pendingConnectionSeen = false
    })
    return originalOnConnectInput?.apply(this, [slot, ...args]) ?? true
  }

  node.onConnectionsChange = useChainCallback(
    node.onConnectionsChange,
    function (
      this: AutogrowNode,
      contype: ISlotType,
      slot: number,
      iscon: boolean,
      linf: LLink | null | undefined
    ) {
      const input = this.inputs.at(slot)
      if (contype !== LiteGraph.INPUT || !input) return
      //Return if input isn't known autogrow
      const key = input.name.slice(0, input.name.lastIndexOf('.'))
      const autogrowGroup = Object.hasOwn(this.comfyDynamic.autogrow, key)
        ? this.comfyDynamic.autogrow[key]
        : undefined
      if (!autogrowGroup) return
      if (
        !listSourceOf(this, slot) &&
        input.label?.startsWith(`${listLabel(key)} (list`)
      )
        input.label = undefined
      if (useApp().configuringGraph && input.widget)
        ensureWidgetForInput(node, input)
      if (iscon) {
        if (pendingConnection === slot) pendingConnectionSeen = true
        if (swappingSlot === slot) {
          swappingSlot = undefined
          return
        }
        if (!linf) return
        autogrowInputConnected(slot, this)
      } else {
        if (pendingConnection === slot && !pendingConnectionSeen) {
          swappingSlot = slot
          requestAnimationFrame(() => {
            if (swappingSlot === slot) swappingSlot = undefined
          })
          return
        }
        //Find the slot again: others may have moved it by the next frame
        requestAnimationFrame(() => {
          const index = this.inputs.indexOf(input)
          if (index !== -1) autogrowInputDisconnected(index, this)
        })
      }
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
  applyAutogrowTemplate(node, inputSpecV2.name, {
    names,
    min,
    max: names?.length ?? max,
    prefix,
    inputSpecs: inputsV2
  })
}

function applyAutogrowTemplate(
  node: LGraphNode,
  groupName: string,
  template: AutogrowTemplate
) {
  withComfyAutogrow(node)
  const { min, max, inputSpecs, prefix, names } = template
  node.comfyDynamic.autogrow[groupName] = {
    min,
    max,
    inputSpecs,
    prefix,
    names
  }
  for (let i = 0; i === 0 || i < template.min + 1; i++)
    addAutogrowGroup(i, groupName, node)
}

function listSourceOf(node: LGraphNode, slot: number) {
  const { graph } = node
  const link = graph?.getLink(node.inputs.at(slot)?.link)
  if (!graph || graph.isRootGraph || link?.origin_id !== SUBGRAPH_INPUT_ID)
    return undefined
  const source = (graph as Subgraph).inputs.at(link.origin_slot)
  return source?.list ? source : undefined
}

const listSlotsOf = (host: SubgraphNode, input: SubgraphInput) =>
  host.inputs.filter((slot) => slot._subgraphSlot === input)

export function syncListInputs(host: SubgraphNode) {
  // Wire autogrow now: hooks that save and restore callbacks later drop handlers chained after them
  withComfyAutogrow(host)
  for (const input of host.subgraph.inputs) {
    const slots = listSlotsOf(host, input)
    const isGroup = slots.some((slot) => slot.name !== input.name)
    if (input.list && !isGroup) {
      const target = innerTarget(host.subgraph, input)
      const template = target && listTemplateAt(...target)
      if (!template) continue
      applyAutogrowTemplate(host, `${input.name}[]`, template)
      replaceSlots(host, slots, listSlotsOf(host, input).slice(slots.length))
    } else if (!input.list && isGroup) {
      host.addInput(input.name, input.type, { _subgraphSlot: input })
      replaceSlots(host, slots, [host.inputs.at(-1)!])
    } else if (input.list) {
      replaceSlots(host, slots, slots)
    }
  }
}

function innerTarget(subgraph: Subgraph, input: SubgraphInput) {
  const link = subgraph.getLink(input.linkIds[0])
  const { inputNode, input: slot } = link?.resolve(subgraph) ?? {}
  return inputNode && slot
    ? ([inputNode, inputNode.inputs.indexOf(slot)] as const)
    : undefined
}

function replaceSlots(
  host: SubgraphNode,
  from: INodeInputSlot[],
  to: INodeInputSlot[]
) {
  const previous = captureInputLayout(host)
  const at = host.inputs.indexOf(from[0] ?? to[0])
  const kept = host.inputs.filter((i) => !from.includes(i) && !to.includes(i))
  const before = host.inputs.slice(0, at).filter((i) => kept.includes(i))
  kept.splice(before.length, 0, ...to)
  const links = new Map(previous.links)
  const carried = links.get(from[0])
  if (carried && !links.has(to[0])) links.set(to[0], carried)
  if (to[0] !== from[0]) links.delete(from[0])
  if (!replaceNodeInputs(host, previous, kept, links).ok || !carried) return
  const slot = host.inputs.indexOf(to[0])
  // Firing the connect is what lets the group grow past the slot
  host.onConnectionsChange?.(LiteGraph.INPUT, slot, true, carried, to[0])
}

const singleTarget = (subgraph: Subgraph, input: SubgraphInput) =>
  input.linkIds.length === 1 ? innerTarget(subgraph, input) : undefined

function listRunFrom(subgraph: Subgraph, anchor: SubgraphInput) {
  const [node, slot] = singleTarget(subgraph, anchor) ?? []
  const names = node?.getListSlotNames?.(slot!)
  if (!node || !names) return undefined
  const inputs: SubgraphInput[] = []
  for (const name of names) {
    const next = subgraph.inputs.find((input) => {
      const [n, s] = singleTarget(subgraph, input) ?? []
      return n === node && node.inputs[s!].name === name
    })
    if (!next) break
    inputs.push(next)
  }
  const fedAfter = names
    .slice(inputs.length)
    .some((name) => node.inputs.find((i) => i.name === name)?.link != null)
  return fedAfter ? undefined : { inputs, group: names[0] }
}

function renameList(host: SubgraphNode, list: SubgraphInput, slotName: string) {
  const group = slotName
    .slice(0, slotName.lastIndexOf('.'))
    .replace(/\[\]$/, '')
  const others = host.subgraph.inputs.filter((i) => i !== list)
  list.name = nextUniqueName(
    group,
    others.map((i) => i.name)
  )
  for (const slot of listSlotsOf(host, list)) slot.name = list.name
  list.localized_name = list.label = undefined
}

function connectListItems(
  host: SubgraphNode,
  list: SubgraphInput,
  sources: (ResolvedConnection | null | undefined)[]
) {
  for (const [item, source] of sources.entries()) {
    const slotIndex = host.inputs.indexOf(listSlotsOf(host, list)[item])
    if (item === 0 || !source || slotIndex === -1) continue
    if (source.subgraphInput)
      source.subgraphInput.connect(host.inputs[slotIndex], host)
    else source.outputNode?.connect(source.link.origin_slot, host, slotIndex)
  }
}

export function mergeListRuns(host: SubgraphNode) {
  const { subgraph } = host
  const bySlot = (input: SubgraphInput) =>
    singleTarget(subgraph, input)?.[1] ?? -1
  const runs: {
    anchor: SubgraphInput
    sources: (ResolvedConnection | null | undefined)[]
  }[] = []
  for (const anchor of [...subgraph.inputs].sort(
    (a, b) => bySlot(a) - bySlot(b)
  )) {
    const run = subgraph.inputs.includes(anchor)
      ? listRunFrom(subgraph, anchor)
      : undefined
    if (!run) continue
    const sources = run.inputs.map((input) => {
      const link = host.graph?.getLink(listSlotsOf(host, input)[0]?.link)
      return host.graph && link?.resolve(host.graph)
    })
    for (const input of run.inputs.slice(1)) subgraph.removeInput(input)
    // Rename now: a group's new slots adopt any slot already named like them
    renameList(host, anchor, run.group)
    runs.push({ anchor, sources })
  }
  // Remove first: a disconnect right after a connect on one slot looks like a swap to autogrow
  for (const { anchor, sources } of runs) {
    subgraph.setInputList(anchor, { list: true })
    connectListItems(host, anchor, sources)
  }
}
