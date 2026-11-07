import { remove } from 'es-toolkit'
import { shallowReactive } from 'vue'

import { assert } from '@/base/assert'
import { useChainCallback } from '@/composables/functional/useChainCallback'
import type { ISlotType } from '@comfyorg/graph-model/interfaces'
import type { INodeInputSlot } from '@comfyorg/graph-model/slots'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { LLink } from '@/lib/litegraph/src/LLink'
import { isSubgraphInput } from '@/lib/litegraph/src/subgraph/subgraphTypeGuards'
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
import { useApp } from '@/scripts/appInstance'
import type { ComfyApp } from '@/types/comfy'
import {
  captureInputLayout,
  inputLink,
  replaceNodeInputs
} from '@/lib/litegraph/src/node/slotLinks'
import type { InputLayoutSnapshot } from '@/lib/litegraph/src/node/slotLinks'
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
          inputSpec: InputSpecV2
        }
      >
    }
  }

type DynamicComboNode = LGraphNode & {
  comfyDynamic: {
    dynamicCombo: Record<string, { inputSpec: InputSpec; sync(): void }>
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

/** `onConnectionsChange` at each input's live slot: a callback can grow a group and shift later inputs. */
function notifyRelinked(
  node: LGraphNode,
  relinked: readonly { input: INodeInputSlot; link: LLink }[]
) {
  for (const { input, link } of relinked) {
    const slot = node.inputs.indexOf(input)
    if (slot !== -1)
      node.onConnectionsChange?.(LiteGraph.INPUT, slot, true, link, input)
  }
}

/** Moves each removed input's link onto the input that replaced it by name. */
function carryLinks(
  node: LGraphNode,
  removedInputs: INodeInputSlot[],
  inputLinks: Map<INodeInputSlot, LLink>
) {
  for (const input of removedInputs) {
    const replacement = node.inputs.find((item) => item.name === input.name)
    const link = inputLinks.get(input)
    if (replacement && link) inputLinks.set(replacement, link)
  }
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

function dynamicComboWidget(
  node: LGraphNode,
  inputName: string,
  untypedInputData: InputSpec,
  appArg: ComfyApp,
  widgetName?: string
) {
  const { addNodeInput } = useLitegraphServiceAccess()
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
      if (restored) addedWidget.value = restored.value
      else if (removed?.type === addedWidget.type)
        addedWidget.value = removed.value
    }
  }
  function addOptionInputs(spec: (typeof options)[string] | undefined) {
    const inputTypes: [Record<string, InputSpec> | undefined, boolean][] = [
      [spec?.required, false],
      [spec?.optional, true]
    ]
    for (const [inputs, isOptional] of inputTypes)
      for (const [key, inputSpec] of Object.entries(inputs ?? {})) {
        const name = `${widget.name}.${key}`
        const specToAdd = transformInputSpecV1ToV2(inputSpec, {
          name,
          isOptional
        })
        specToAdd.display_name = key
        addNodeInput(node, specToAdd)
      }
  }
  /** Moves inputs added past `start` to after the combo's socket, reusing same-named existing inputs. */
  function placeAddedInputs(start: number, hasAddedWidgets: boolean) {
    const socket = node.inputs.findIndex((i) => i.name === widget.name)
    if (socket === -1 && node.inputs.length > start && !hasAddedWidgets)
      throw new Error('Failed to find input socket for ' + widget.name)
    const added = node.inputs.splice(start).map((input) => {
      const existing = node.inputs.findIndex((i) => i.name === input.name)
      return existing === -1 ? input : node.inputs.splice(existing, 1)[0]
    })
    node.inputs.splice(socket + 1 || node.inputs.length, 0, ...added)
  }
  const updateWidgets = (value?: string) => {
    if (!node.widgets) throw new Error('Not Reachable')
    const newSpec =
      value && !widget.connectionSuppressed ? options[value] : undefined
    const optionValues = removedWidgetValues.get(activeOption) ?? new Map()
    removedWidgetValues.set(activeOption, optionValues)
    activeOption = value

    const previous = captureInputLayout(node)
    const inputLinks = new Map(previous.links)
    const removedInputs = remove(node.inputs, isInGroup)
    for (const child of node.widgets.filter(isInGroup)) {
      optionValues.set(child.name, { type: child.type, value: child.value })
      node.removeWidget(child)
    }
    forgetDynamicChildren(node, inputName)

    const insertionPoint = node.widgets.indexOf(widget) + 1
    if (insertionPoint === 0)
      throw new Error("Dynamic widget doesn't exist on node")
    const startingWidgets = new Set(node.widgets)
    const startingInputLength = node.inputs.length
    addOptionInputs(newSpec)

    const addedWidgets = remove(node.widgets, (w) => !startingWidgets.has(w))
    node.widgets.splice(insertionPoint, 0, ...addedWidgets)
    syncNodeWidgetOrder(node)
    placeAddedInputs(startingInputLength, addedWidgets.length > 0)
    carryLinks(node, removedInputs, inputLinks)

    const result = commitMutatedInputs(node, previous, inputLinks)
    if (!result.ok) return
    notifyRelinked(node, result.replacements)
    restoreRemovedValues(
      value,
      addedWidgets.map(({ name }) => name)
    )
    if (!node.graph) return
    node._setConcreteSlots()
    node.arrange()
    node.graph.setDirtyCanvas(true, true)
  }
  widget.callback = useChainCallback(widget.callback, () => refitHeight(node))
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
  withComfyDynamicCombo(node)
  node.comfyDynamic.dynamicCombo[widget.name] = {
    inputSpec: untypedInputData,
    sync() {
      const hasChildren =
        node.inputs.some(isInGroup) || !!node.widgets?.some(isInGroup)
      if (!!widget.connectionSuppressed !== hasChildren) return
      updateWidgets(activeOption)
      refitHeight(node)
    }
  }
  return { widget, minWidth, minHeight }
}

function refitHeight(node: LGraphNode) {
  node.size = [node.size[0], node.computeSize([...node.size])[1]]
  node.graph?.setDirtyCanvas(true, true)
}

function hasDynamicCombos(node: LGraphNode): node is DynamicComboNode {
  return !!node.comfyDynamic?.dynamicCombo
}

function withComfyDynamicCombo(
  node: LGraphNode
): asserts node is DynamicComboNode {
  if (hasDynamicCombos(node)) return
  node.comfyDynamic ??= {}
  const combos: DynamicComboNode['comfyDynamic']['dynamicCombo'] = {}
  node.comfyDynamic.dynamicCombo = combos

  const originalOnConnectInput = node.onConnectInput
  node.onConnectInput = function (slot: number, ...args) {
    const name = this.inputs.at(slot)?.widget?.name
    if (name && Object.hasOwn(combos, name) && !isSubgraphInput(args[1]))
      return false
    return originalOnConnectInput?.apply(this, [slot, ...args]) ?? true
  }

  node.onAfterGraphConfigured = useChainCallback(
    node.onAfterGraphConfigured,
    () => {
      for (const combo of Object.values(combos)) combo.sync()
    }
  )
  node.onConnectionsChange = useChainCallback(
    node.onConnectionsChange,
    function (this: LGraphNode, contype: ISlotType, slot: number) {
      const name = this.inputs.at(slot)?.widget?.name
      if (contype !== LiteGraph.INPUT || !name || useApp().configuringGraph)
        return
      if (Object.hasOwn(combos, name)) combos[name].sync()
    }
  )
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
  if (ordinal >= max || isAutogrowGroupConnected(node, groupName)) return

  const previous = captureInputLayout(node)
  const inputLinks = new Map(previous.links)
  const namedSpecs = inputSpecs.map((input) => ({
    ...input,
    isOptional: ordinal >= min || input.isOptional,
    ...autogrowOrdinalToName(ordinal, input.name, groupName, node)
  }))

  const newInputs = namedSpecs.map((namedSpec) => {
    addNodeInput(node, namedSpec)
    return node.inputs.splice(node.inputs.length - 1, 1)[0]
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
  const lastIndex = node.inputs.findLastIndex(
    (inp) => inp.name.startsWith(targetName) || inp.name === groupName
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

export function autogrowInputRole(
  node: LGraphNode,
  input: INodeInputSlot
): 'group' | 'child' | undefined {
  if (!hasAutogrowGroups(node) || input.widget) return undefined
  if (Object.hasOwn(node.comfyDynamic.autogrow, input.name)) return 'group'
  return liveAutogrowGroupOf(node, input.name) ? 'child' : undefined
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

function autogrowInputDisconnected(input: INodeInputSlot, node: AutogrowNode) {
  const index = node.inputs.indexOf(input)
  if (index === -1 || node.isInputConnected(index)) return
  const groupName = input.name.slice(0, input.name.lastIndexOf('.'))
  if (!Object.hasOwn(node.comfyDynamic.autogrow, groupName)) return

  const { min, inputSpecs } = node.comfyDynamic.autogrow[groupName]
  const ordinal = resolveAutogrowOrdinal(input.name, groupName, node)
  if (ordinal == undefined || ordinal + 1 < min) return

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
  const previous = captureInputLayout(node)
  const inputLinks = new Map(previous.links)
  const transplants: { input: INodeInputSlot; link: LLink }[] = []
  //Shift each later group's links down one group, over the emptied ordinal.
  for (let i = ordinal * stride; i + stride < groupInputs.length; i++) {
    const link = inputLinks.get(groupInputs[i + stride])
    inputLinks.delete(groupInputs[i + stride])
    inputLinks.delete(groupInputs[i])
    if (!link) continue
    inputLinks.set(groupInputs[i], link)
    transplants.push({ input: groupInputs[i], link })
  }

  //Keep groups up to the last linked one, plus one empty group to grow into.
  const removalChecks = groupInputs.slice(min * stride)
  const lastLinked = removalChecks.findLastIndex((inp) => inputLinks.has(inp))
  const toRemove = removalChecks.slice(
    (Math.floor(lastLinked / stride) + 2) * stride
  )
  const finalInputs = node.inputs.filter((inp) => !toRemove.includes(inp))
  const result = replaceNodeInputs(node, previous, finalInputs, inputLinks)
  if (!result.ok) return

  notifyRelinked(node, transplants)
  const removedNames = new Set(toRemove.map((inp) => inp.widget?.name))
  for (const widget of node.widgets.filter((w) => removedNames.has(w.name)))
    node.removeWidget(widget)
  syncNodeWidgetOrder(node)
  refitHeight(node)
}

function isAutogrowGroupConnected(node: LGraphNode, groupName: string) {
  const index = node.inputs.findIndex((input) => input.name === groupName)
  if (index === -1 || !node.graph) return false
  return inputLink(node.graph, node.id, index)?.type === node.inputs[index].type
}

function syncAutogrowGroup(node: AutogrowNode, groupName: string) {
  if (isAutogrowGroupConnected(node, groupName))
    removeGroupChildren(node, groupName)
  else if (!node.inputs.some((input) => input.name.startsWith(`${groupName}.`)))
    growAutogrowToMin(node, groupName)
}

function growAutogrowToMin(node: AutogrowNode, groupName: string) {
  const { min } = node.comfyDynamic.autogrow[groupName]
  for (let i = 0; i === 0 || i < min + 1; i++)
    addAutogrowGroup(i, groupName, node)
}

function removeGroupChildren(node: LGraphNode, groupName: string) {
  const prefix = `${groupName}.`
  for (let slot = node.inputs.length - 1; slot >= 0; slot--) {
    if (
      node.inputs[slot].name.startsWith(prefix) &&
      node.isInputConnected(slot)
    )
      node.disconnectInput(slot)
  }
  const previous = captureInputLayout(node)
  const finalInputs = previous.inputs.filter(
    (input) => !input.name.startsWith(prefix)
  )
  if (finalInputs.length === previous.inputs.length) return
  const result = replaceNodeInputs(node, previous, finalInputs)
  if (!result.ok) return
  for (const widget of node.widgets?.filter((w) => w.name.startsWith(prefix)) ??
    [])
    node.removeWidget(widget)
  forgetDynamicChildren(node, groupName)
  syncNodeWidgetOrder(node)
  refitHeight(node)
}

function dynamicRegistries(node: LGraphNode): Record<string, unknown>[] {
  return [
    hasAutogrowGroups(node) && node.comfyDynamic.autogrow,
    hasDynamicCombos(node) && node.comfyDynamic.dynamicCombo
  ].filter((registry) => registry !== false)
}

function forgetDynamicChildren(node: LGraphNode, groupName: string) {
  for (const registry of dynamicRegistries(node))
    for (const nested of Object.keys(registry))
      if (nested.startsWith(`${groupName}.`)) delete registry[nested]
}

function withComfyAutogrow(node: LGraphNode): asserts node is AutogrowNode {
  if (node.comfyDynamic?.autogrow) return
  node.comfyDynamic ??= {}
  const groups: AutogrowNode['comfyDynamic']['autogrow'] = {}
  node.comfyDynamic.autogrow = groups

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
    const groupInput = this.inputs.at(slot)
    if (
      groupInput &&
      Object.hasOwn(groups, groupInput.name) &&
      !isSubgraphInput(args[1])
    )
      return false
    pendingConnection = slot
    pendingConnectionSeen = false
    requestAnimationFrame(() => {
      pendingConnection = undefined
      pendingConnectionSeen = false
    })
    return originalOnConnectInput?.apply(this, [slot, ...args]) ?? true
  }

  node.onAfterGraphConfigured = useChainCallback(
    node.onAfterGraphConfigured,
    function (this: AutogrowNode) {
      for (const groupName of Object.keys(groups))
        syncAutogrowGroup(this, groupName)
    }
  )

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
      if (Object.hasOwn(this.comfyDynamic.autogrow, input.name)) {
        if (!useApp().configuringGraph) syncAutogrowGroup(this, input.name)
        return
      }
      //Return if input isn't known autogrow
      const key = input.name.slice(0, input.name.lastIndexOf('.'))
      const autogrowGroup = Object.hasOwn(this.comfyDynamic.autogrow, key)
        ? this.comfyDynamic.autogrow[key]
        : undefined
      if (!autogrowGroup) return
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
        requestAnimationFrame(() => autogrowInputDisconnected(input, this))
      }
    }
  )
}
function applyAutogrow(node: LGraphNode, inputSpecV2: InputSpecV2) {
  const groupName = inputSpecV2.name
  if (!node.inputs.some((input) => input.name === groupName))
    node.addInput(groupName, inputSpecV2.type, {
      localized_name: inputSpecV2.display_name
    })
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
  node.comfyDynamic.autogrow[groupName] = {
    names,
    min,
    max: names?.length ?? max,
    prefix,
    inputSpecs: inputsV2,
    inputSpec: inputSpecV2
  }
  growAutogrowToMin(node, groupName)
}

/**
 * Makes `node` own the dynamic children (autogrow group or dynamic combo
 * options) `interiorInput` defines, through `input`. False if it defines none.
 */
export function bindPromotedDynamicInput(
  node: LGraphNode,
  input: INodeInputSlot,
  interiorNode: LGraphNode,
  interiorInput: INodeInputSlot
): boolean {
  return (
    bindPromotedAutogrowGroup(node, input, interiorNode, interiorInput) ||
    bindPromotedDynamicCombo(node, input, interiorNode, interiorInput)
  )
}

/** Removes the dynamic children `node` owns through `input`; false if none. */
export function unbindPromotedDynamicInput(
  node: LGraphNode,
  input: INodeInputSlot
): boolean {
  const registry = dynamicRegistries(node).find((r) =>
    Object.hasOwn(r, input.name)
  )
  if (!registry) return false
  removeGroupChildren(node, input.name)
  delete registry[input.name]
  const groupWidget = node.widgets?.find((w) => w.name === input.name)
  if (groupWidget) node.removeWidget(groupWidget)
  input.widget = undefined
  syncNodeWidgetOrder(node)
  return true
}

function bindPromotedDynamicCombo(
  node: LGraphNode,
  input: INodeInputSlot,
  interiorNode: LGraphNode,
  interiorInput: INodeInputSlot
): boolean {
  const interiorName = interiorInput.widget?.name
  if (
    !interiorName ||
    !hasDynamicCombos(interiorNode) ||
    !Object.hasOwn(interiorNode.comfyDynamic.dynamicCombo, interiorName)
  )
    return false
  if (
    hasDynamicCombos(node) &&
    Object.hasOwn(node.comfyDynamic.dynamicCombo, input.name)
  )
    return true
  input.widget = { name: input.name }
  const { inputSpec } = interiorNode.comfyDynamic.dynamicCombo[interiorName]
  const { widget } = dynamicComboWidget(node, input.name, inputSpec, useApp())
  if (input.label) widget.label = input.label

  const interiorWidgets = new Map(
    interiorNode.widgets?.map((w) => [w.name, w.value])
  )
  if (interiorWidgets.has(interiorName))
    widget.value = interiorWidgets.get(interiorName)
  for (const child of node.widgets?.filter((w) =>
    w.name.startsWith(`${input.name}.`)
  ) ?? []) {
    const interiorChildName = interiorName + child.name.slice(input.name.length)
    if (interiorWidgets.has(interiorChildName))
      child.value = interiorWidgets.get(interiorChildName)
  }
  return true
}

function bindPromotedAutogrowGroup(
  node: LGraphNode,
  input: INodeInputSlot,
  interiorNode: LGraphNode,
  interiorInput: INodeInputSlot
): boolean {
  if (
    !hasAutogrowGroups(interiorNode) ||
    !Object.hasOwn(interiorNode.comfyDynamic.autogrow, interiorInput.name)
  )
    return false
  if (
    hasAutogrowGroups(node) &&
    Object.hasOwn(node.comfyDynamic.autogrow, input.name)
  )
    return true
  const { inputSpec } = interiorNode.comfyDynamic.autogrow[interiorInput.name]
  applyAutogrow(node, {
    ...inputSpec,
    name: input.name,
    display_name: input.label ?? inputSpec.display_name
  })
  return true
}
