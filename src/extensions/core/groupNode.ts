import { PREFIX, SEPARATOR } from '@/constants/groupNodeConstants'
import type { SerialisedLLinkArray } from '@/lib/litegraph/src/LLink'
import type { LGraphNodeConstructor } from '@/lib/litegraph/src/litegraph'
import { LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import { outputLinks } from '@/lib/litegraph/src/node/slotLinks'
import { parseNodeId } from '@/types/nodeId'
import type {
  ComfyNode,
  ComfyWorkflowJSON
} from '@/platform/workflow/validation/schemas/workflowSchema'
import type { ComfyNodeDef, InputSpec } from '@/schemas/nodeDefSchema'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import { useWidgetStore } from '@/stores/widgetStore'
import type { ComfyExtension } from '@/types/comfy'
import { deserialiseAndCreate } from '@/utils/vintageClipboard'

import { app } from '../../scripts/app'
import { mergeIfValid } from './widgetInputs'

/**
 * Marker symbol stamped on a synthesized group-node type's `nodeData` (via
 * {@link markGroupNodeType}) so loaded group-node instances can be detected and
 * migrated to subgraphs.
 */
const GROUP = Symbol()

/**
 * Stamp the group-node marker onto the registered node type so instances created
 * during load can be detected by {@link GroupNodeHandler.isGroupNode}. This is
 * stamped directly on the constructor rather than copied through
 * {@link ComfyNodeDefImpl} construction, keeping the migration self-contained.
 */
function markGroupNodeType(typeName: string, config: GroupNodeConfig): void {
  const ctor = LiteGraph.registered_node_types[typeName] as
    | LGraphNodeConstructor
    | undefined
  if (ctor?.nodeData) ctor.nodeData[GROUP] = config
}

type GroupNodeLink = SerialisedLLinkArray
type LinksFromMap = Record<number, Record<number, GroupNodeLink[]>>
type LinksToMap = Record<number, Record<number, GroupNodeLink>>
type ExternalFromMap = Record<number, Record<number, string | number>>

interface GroupNodeInput {
  name?: string
  type?: string
  label?: string
  widget?: { name: string }
}

interface GroupNodeOutput {
  name?: string
  type?: string
  label?: string
  widget?: { name: string }
  links?: number[]
}

interface GroupNodeConfigEntry {
  input?: Record<string, { name?: string; visible?: boolean }>
  output?: Record<number, { name?: string; visible?: boolean }>
}

export interface GroupNodeWorkflowData {
  external: (number | string)[][]
  links: SerialisedLLinkArray[]
  nodes: {
    index?: number
    type?: string
    title?: string
    inputs?: unknown[]
    outputs?: unknown[]
    widgets_values?: unknown[]
  }[]
  config?: Record<number, GroupNodeConfigEntry>
}

interface GroupNodeData extends Omit<
  GroupNodeWorkflowData['nodes'][number],
  'inputs' | 'outputs'
> {
  title?: string
  widgets_values?: unknown[]
  inputs?: GroupNodeInput[]
  outputs?: GroupNodeOutput[]
}

interface GroupNodeDef {
  input: {
    required: Record<string, unknown>
    optional?: Record<string, unknown>
  }
  output: unknown[]
  output_name: string[]
  output_is_list: boolean[]
}

interface NodeConfigEntry {
  input?: Record<string, { name?: string; visible?: boolean }>
  output?: Record<number, { name?: string; visible?: boolean }>
}

export class GroupNodeConfig {
  name: string
  nodeData: GroupNodeWorkflowData
  inputCount: number
  oldToNewOutputMap: Record<number, Record<number, number>>
  newToOldOutputMap: Record<number, { node: GroupNodeData; slot: number }>
  oldToNewInputMap: Record<number, Record<string, number>>
  oldToNewWidgetMap: Record<number, Record<string, string | null>>
  newToOldWidgetMap: Record<string, { node: GroupNodeData; inputName: string }>
  primitiveDefs: Record<number, GroupNodeDef>
  widgetToPrimitive: Record<number, Record<string, number | number[]>>
  primitiveToWidget: Record<
    number,
    { nodeId: number | string | null; inputName: string }[]
  >
  nodeInputs: Record<number, Record<string, string>>
  outputVisibility: boolean[]
  nodeDef: ComfyNodeDef | undefined
  inputs!: unknown[]
  linksFrom!: LinksFromMap
  linksTo!: LinksToMap
  externalFrom!: ExternalFromMap

  constructor(name: string, nodeData: GroupNodeWorkflowData) {
    this.name = name
    this.nodeData = nodeData
    this.getLinks()

    this.inputCount = 0
    this.oldToNewOutputMap = {}
    this.newToOldOutputMap = {}
    this.oldToNewInputMap = {}
    this.oldToNewWidgetMap = {}
    this.newToOldWidgetMap = {}
    this.primitiveDefs = {}
    this.widgetToPrimitive = {}
    this.primitiveToWidget = {}
    this.nodeInputs = {}
    this.outputVisibility = []
  }

  async registerType(source = PREFIX) {
    this.nodeDef = {
      output: [],
      output_name: [],
      output_is_list: [],
      output_node: false, // This is a lie (to satisfy the interface)
      name: source + SEPARATOR + this.name,
      display_name: this.name,
      category: 'group nodes' + (SEPARATOR + source),
      input: { required: {} },
      description: `Group node combining ${this.nodeData.nodes
        .map((n) => n.type)
        .join(', ')}`,
      python_module: 'custom_nodes.' + this.name
    }

    this.inputs = []
    const seenInputs = {}
    const seenOutputs = {}
    for (let i = 0; i < this.nodeData.nodes.length; i++) {
      const node = this.nodeData.nodes[i] as GroupNodeData
      node.index = i
      this.processNode(node, seenInputs, seenOutputs)
    }

    for (const p of this._convertedToProcess) {
      p()
    }
    this._convertedToProcess = []
    if (!this.nodeDef) return
    const typeName = `${PREFIX}${SEPARATOR}${this.name}`
    await app.registerNodeDef(typeName, this.nodeDef)
    markGroupNodeType(typeName, this)
    useNodeDefStore().addNodeDef(this.nodeDef)
  }

  getLinks() {
    this.linksFrom = {}
    this.linksTo = {}
    this.externalFrom = {}

    // Extract links for easy lookup
    for (const link of this.nodeData.links) {
      const [sourceNodeId, sourceNodeSlot, targetNodeId, targetNodeSlot] = link

      // Skip links outside the copy config
      if (
        sourceNodeId == null ||
        sourceNodeSlot == null ||
        targetNodeId == null ||
        targetNodeSlot == null
      )
        continue

      const srcId = Number(sourceNodeId)
      const srcSlot = Number(sourceNodeSlot)
      const tgtId = Number(targetNodeId)
      const tgtSlot = Number(targetNodeSlot)

      if (!this.linksFrom[srcId]) {
        this.linksFrom[srcId] = {}
      }
      if (!this.linksFrom[srcId][srcSlot]) {
        this.linksFrom[srcId][srcSlot] = []
      }
      this.linksFrom[srcId][srcSlot].push(link)

      if (!this.linksTo[tgtId]) {
        this.linksTo[tgtId] = {}
      }
      this.linksTo[tgtId][tgtSlot] = link
    }

    if (this.nodeData.external) {
      for (const ext of this.nodeData.external) {
        const nodeIdx = Number(ext[0])
        const slotIdx = Number(ext[1])
        const typeVal = ext[2]
        if (typeVal == null) continue
        if (!this.externalFrom[nodeIdx]) {
          this.externalFrom[nodeIdx] = { [slotIdx]: typeVal }
        } else {
          this.externalFrom[nodeIdx][slotIdx] = typeVal
        }
      }
    }
  }

  processNode(
    node: GroupNodeData,
    seenInputs: Record<string, number>,
    seenOutputs: Record<string, number>
  ) {
    const def = this.getNodeDef(node)
    if (!def) return

    const inputs = { ...def.input?.required, ...def.input?.optional }

    this.inputs.push(this.processNodeInputs(node, seenInputs, inputs))
    if (def.output?.length) this.processNodeOutputs(node, seenOutputs, def)
  }

  getNodeDef(
    node: GroupNodeData | GroupNodeWorkflowData['nodes'][number]
  ): GroupNodeDef | ComfyNodeDef | null | undefined {
    if (node.type) {
      const def = globalDefs[node.type]
      if (def) return def
    }

    const nodeIndex = node.index
    if (nodeIndex == null) return undefined

    const linksFrom = this.linksFrom[nodeIndex]
    if (node.type === 'PrimitiveNode') {
      // Skip as its not linked
      if (!linksFrom) return

      let type: string | number | null = linksFrom[0]?.[0]?.[5] ?? null
      if (type === 'COMBO') {
        // Use the array items
        const output = node.outputs?.[0] as GroupNodeOutput | undefined
        const source = output?.widget?.name
        const nodeIdx = linksFrom[0]?.[0]?.[2]
        if (source && nodeIdx != null) {
          const fromTypeName = this.nodeData.nodes[Number(nodeIdx)]?.type
          if (fromTypeName) {
            const fromType = globalDefs[fromTypeName]
            const input =
              fromType?.input?.required?.[source] ??
              fromType?.input?.optional?.[source]
            const inputType = input?.[0]
            type =
              typeof inputType === 'string' || typeof inputType === 'number'
                ? inputType
                : null
          }
        }
      }

      const def = (this.primitiveDefs[nodeIndex] = {
        input: {
          required: {
            value: [type, {}]
          }
        },
        output: [type],
        output_name: [],
        output_is_list: []
      })
      return def
    } else if (node.type === 'Reroute') {
      const linksTo = this.linksTo[nodeIndex]
      if (linksTo && linksFrom && !this.externalFrom[nodeIndex]?.[0]) {
        // Being used internally
        return null
      }

      let config: Record<string, unknown> = {}
      let rerouteType = '*'
      if (linksFrom) {
        const links = linksFrom[0] ?? []
        for (const link of links) {
          const id = link[2]
          const slot = link[3]
          if (id == null || slot == null) continue
          const targetNode = this.nodeData.nodes[Number(id)]
          const input = targetNode?.inputs?.[Number(slot)] as
            | GroupNodeInput
            | undefined
          if (input?.type && rerouteType === '*') {
            rerouteType = input.type
          }
          if (input?.widget && targetNode?.type) {
            const targetDef = globalDefs[targetNode.type]
            const targetWidget =
              targetDef?.input?.required?.[input.widget.name] ??
              targetDef?.input?.optional?.[input.widget.name]

            if (targetWidget) {
              const widgetSpec = [targetWidget[0], config] as Parameters<
                typeof mergeIfValid
              >[4]
              const res = mergeIfValid(
                { widget: widgetSpec } as unknown as Parameters<
                  typeof mergeIfValid
                >[0],
                targetWidget,
                false,
                undefined,
                widgetSpec
              )
              config = (res?.customConfig as Record<string, unknown>) ?? config
            }
          }
        }
      } else if (linksTo) {
        const link = linksTo[0]
        if (link) {
          const id = link[0]
          const slot = link[1]
          if (id != null && slot != null) {
            const outputType =
              this.nodeData.nodes[Number(id)]?.outputs?.[Number(slot)]
            if (
              outputType &&
              typeof outputType === 'object' &&
              'type' in outputType
            ) {
              rerouteType = String((outputType as GroupNodeOutput).type ?? '*')
            }
          }
        }
      } else {
        // Reroute used as a pipe
        for (const l of this.nodeData.links) {
          if (l[2] === node.index) {
            const linkType = l[5]
            if (linkType != null) rerouteType = String(linkType)
            break
          }
        }
        if (rerouteType === '*') {
          // Check for an external link
          const t = this.externalFrom[nodeIndex]?.[0]
          if (t) {
            rerouteType = String(t)
          }
        }
      }

      config.forceInput = true
      return {
        input: {
          required: {
            [rerouteType]: [rerouteType, config]
          }
        },
        output: [rerouteType],
        output_name: [],
        output_is_list: []
      }
    }

    console.warn(
      'Skipping virtual node ' +
        node.type +
        ' when building group node ' +
        this.name
    )
  }

  getInputConfig(
    node: GroupNodeData,
    inputName: string,
    seenInputs: Record<string, number>,
    config: unknown[],
    extra?: Record<string, unknown>
  ) {
    const nodeConfig = this.nodeData.config?.[node.index ?? -1] as
      | NodeConfigEntry
      | undefined
    const customConfig = nodeConfig?.input?.[inputName]
    let name =
      customConfig?.name ??
      node.inputs?.find((inp) => inp.name === inputName)?.label ??
      inputName
    let key = name
    let prefix = ''
    // Special handling for primitive to include the title if it is set rather than just "value"
    if ((node.type === 'PrimitiveNode' && node.title) || name in seenInputs) {
      prefix = `${node.title ?? node.type} `
      key = name = `${prefix}${inputName}`
      if (name in seenInputs) {
        name = `${prefix}${seenInputs[name]} ${inputName}`
      }
    }
    seenInputs[key] = (seenInputs[key] ?? 1) + 1

    if (inputName === 'seed' || inputName === 'noise_seed') {
      if (!extra) extra = {}
      extra.control_after_generate = `${prefix}control_after_generate`
    }
    if (config[0] === 'IMAGEUPLOAD') {
      if (!extra) extra = {}
      const nodeIndex = node.index ?? -1
      const configOptions =
        typeof config[1] === 'object' && config[1] !== null ? config[1] : {}
      const widgetKey =
        'widget' in configOptions && typeof configOptions.widget === 'string'
          ? configOptions.widget
          : 'image'
      extra.widget = this.oldToNewWidgetMap[nodeIndex]?.[widgetKey] ?? 'image'
    }

    if (extra) {
      const configObj =
        typeof config[1] === 'object' && config[1] ? config[1] : {}
      config = [config[0], { ...configObj, ...extra }]
    }

    return { name, config, customConfig }
  }

  processWidgetInputs(
    inputs: Record<string, unknown>,
    node: GroupNodeData,
    inputNames: string[],
    seenInputs: Record<string, number>
  ) {
    const slots: string[] = []
    const converted = new Map<number, string>()
    const nodeIndex = node.index ?? -1
    const widgetMap: Record<string, string | null> = (this.oldToNewWidgetMap[
      nodeIndex
    ] = {})
    for (const inputName of inputNames) {
      const inputSpec = inputs[inputName]
      const isValidSpec =
        Array.isArray(inputSpec) &&
        inputSpec.length >= 1 &&
        typeof inputSpec[0] === 'string'
      if (
        isValidSpec &&
        useWidgetStore().inputIsWidget(inputSpec as InputSpec)
      ) {
        const convertedIndex =
          node.inputs?.findIndex(
            (inp) => inp.name === inputName && inp.widget?.name === inputName
          ) ?? -1
        if (convertedIndex > -1) {
          // This widget has been converted to a widget
          // We need to store this in the correct position so link ids line up
          converted.set(convertedIndex, inputName)
          widgetMap[inputName] = null
        } else {
          // Normal widget
          const { name, config } = this.getInputConfig(
            node,
            inputName,
            seenInputs,
            inputs[inputName] as unknown[]
          )
          if (this.nodeDef?.input?.required) {
            // @ts-expect-error legacy dynamic input assignment
            this.nodeDef.input.required[name] = config
          }
          widgetMap[inputName] = name
          this.newToOldWidgetMap[name] = { node, inputName }
        }
      } else {
        // Normal input
        slots.push(inputName)
      }
    }
    return { converted, slots }
  }

  checkPrimitiveConnection(
    link: GroupNodeLink,
    inputName: string,
    inputs: Record<string, unknown[]>
  ) {
    const linkSourceIdx = link[0]
    if (linkSourceIdx == null) return
    const sourceNode = this.nodeData.nodes[Number(linkSourceIdx)]
    if (sourceNode?.type === 'PrimitiveNode') {
      // Merge link configurations
      const sourceNodeId = Number(link[0])
      const targetNodeId = Number(link[2])
      const primitiveDef = this.primitiveDefs[sourceNodeId]
      if (!primitiveDef) return
      const targetWidget = inputs[inputName]
      const primitiveConfig = primitiveDef.input.required.value as [
        unknown,
        Record<string, unknown>
      ]
      const output = { widget: primitiveConfig }
      const config = mergeIfValid(
        // @ts-expect-error slot type mismatch - legacy API
        output,
        targetWidget,
        false,
        undefined,
        primitiveConfig
      )
      const inputConfig = inputs[inputName]?.[1]
      primitiveConfig[1] =
        (config?.customConfig ?? inputConfig)
          ? { ...(typeof inputConfig === 'object' ? inputConfig : {}) }
          : {}

      const widgetName = this.oldToNewWidgetMap[sourceNodeId]?.['value']
      if (widgetName) {
        const name = widgetName.substring(0, widgetName.length - 6)
        primitiveConfig[1].control_after_generate = true
        primitiveConfig[1].control_prefix = name
      }

      let toPrimitive = this.widgetToPrimitive[targetNodeId]
      if (!toPrimitive) {
        toPrimitive = this.widgetToPrimitive[targetNodeId] = {}
      }
      const existing = toPrimitive[inputName]
      if (Array.isArray(existing)) {
        existing.push(sourceNodeId)
      } else if (typeof existing === 'number') {
        toPrimitive[inputName] = [existing, sourceNodeId]
      } else {
        toPrimitive[inputName] = sourceNodeId
      }

      let toWidget = this.primitiveToWidget[sourceNodeId]
      if (!toWidget) {
        toWidget = this.primitiveToWidget[sourceNodeId] = []
      }
      toWidget.push({ nodeId: targetNodeId, inputName })
    }
  }

  processInputSlots(
    inputs: Record<string, unknown[]>,
    node: GroupNodeData,
    slots: string[],
    linksTo: Record<number, GroupNodeLink>,
    inputMap: Record<number, number>,
    seenInputs: Record<string, number>
  ) {
    const nodeIdx = node.index ?? -1
    this.nodeInputs[nodeIdx] = {}
    for (let i = 0; i < slots.length; i++) {
      const inputName = slots[i]
      if (linksTo[i]) {
        this.checkPrimitiveConnection(linksTo[i], inputName, inputs)
        // This input is linked so we can skip it
        continue
      }

      const { name, config, customConfig } = this.getInputConfig(
        node,
        inputName,
        seenInputs,
        inputs[inputName]
      )

      this.nodeInputs[nodeIdx][inputName] = name
      if (customConfig?.visible === false) continue

      if (this.nodeDef?.input?.required) {
        // @ts-expect-error legacy dynamic input assignment
        this.nodeDef.input.required[name] = config
      }
      inputMap[i] = this.inputCount++
    }
  }

  processConvertedWidgets(
    inputs: Record<string, unknown>,
    node: GroupNodeData,
    slots: string[],
    converted: Map<number, string>,
    linksTo: Record<number, GroupNodeLink>,
    inputMap: Record<number, number>,
    seenInputs: Record<string, number>
  ) {
    // Add converted widgets sorted into their index order (ordered as they were converted) so link ids match up
    const convertedSlots = [...converted.keys()]
      .sort()
      .map((k) => converted.get(k))
    for (let i = 0; i < convertedSlots.length; i++) {
      const inputName = convertedSlots[i]
      if (!inputName) continue
      if (linksTo[slots.length + i]) {
        this.checkPrimitiveConnection(
          linksTo[slots.length + i],
          inputName,
          inputs as Record<string, unknown[]>
        )
        // This input is linked so we can skip it
        continue
      }

      const { name, config } = this.getInputConfig(
        node,
        inputName,
        seenInputs,
        inputs[inputName] as unknown[],
        {
          defaultInput: true
        }
      )

      if (this.nodeDef?.input?.required) {
        // @ts-expect-error legacy dynamic input assignment
        this.nodeDef.input.required[name] = config
      }
      this.newToOldWidgetMap[name] = { node, inputName }

      const nodeIndex = node.index ?? -1
      if (!this.oldToNewWidgetMap[nodeIndex]) {
        this.oldToNewWidgetMap[nodeIndex] = {}
      }
      this.oldToNewWidgetMap[nodeIndex][inputName] = name

      inputMap[slots.length + i] = this.inputCount++
    }
  }

  private _convertedToProcess: (() => void)[] = []
  processNodeInputs(
    node: GroupNodeData,
    seenInputs: Record<string, number>,
    inputs: Record<string, unknown>
  ) {
    const inputMapping: unknown[] = []

    const inputNames = Object.keys(inputs)
    if (!inputNames.length) return

    const { converted, slots } = this.processWidgetInputs(
      inputs,
      node,
      inputNames,
      seenInputs
    )
    const nodeIndex = node.index ?? -1
    const linksTo = this.linksTo[nodeIndex] ?? {}
    const inputMap: Record<number, number> = (this.oldToNewInputMap[nodeIndex] =
      {})
    this.processInputSlots(
      inputs as unknown as Record<string, unknown[]>,
      node,
      slots,
      linksTo,
      inputMap,
      seenInputs
    )

    // Converted inputs have to be processed after all other nodes as they'll be at the end of the list
    this._convertedToProcess.push(() =>
      this.processConvertedWidgets(
        inputs,
        node,
        slots,
        converted,
        linksTo,
        inputMap,
        seenInputs
      )
    )

    return inputMapping
  }

  processNodeOutputs(
    node: GroupNodeData,
    seenOutputs: Record<string, number>,
    def: GroupNodeDef | ComfyNodeDef
  ) {
    const nodeIndex = node.index ?? -1
    const oldToNew: Record<number, number> = (this.oldToNewOutputMap[
      nodeIndex
    ] = {})

    const defOutput = def.output ?? []
    // Add outputs
    for (let outputId = 0; outputId < defOutput.length; outputId++) {
      const linksFrom = this.linksFrom[nodeIndex]
      // If this output is linked internally we flag it to hide
      const hasLink =
        linksFrom?.[outputId] && !this.externalFrom[nodeIndex]?.[outputId]
      const outputConfig = this.nodeData.config?.[node.index ?? -1] as
        | NodeConfigEntry
        | undefined
      const customConfig = outputConfig?.output?.[outputId]
      const visible = customConfig?.visible ?? !hasLink
      this.outputVisibility.push(visible)
      if (!visible) {
        continue
      }

      if (this.nodeDef?.output) {
        oldToNew[outputId] = this.nodeDef.output.length
        this.newToOldOutputMap[this.nodeDef.output.length] = {
          node,
          slot: outputId
        }
        // @ts-expect-error legacy dynamic output type assignment
        this.nodeDef.output.push(defOutput[outputId])
        this.nodeDef.output_is_list?.push(
          def.output_is_list?.[outputId] ?? false
        )
      }

      let label: string | undefined = customConfig?.name
      if (!label) {
        const outputVal = defOutput[outputId]
        label =
          def.output_name?.[outputId] ??
          (typeof outputVal === 'string' ? outputVal : undefined)
        const output = node.outputs?.find((o) => o.name === label)
        if (output?.label) {
          label = output.label
        }
      }

      let name: string = String(label ?? `output_${outputId}`)
      if (name in seenOutputs) {
        const prefix = `${node.title ?? node.type} `
        name = `${prefix}${label ?? outputId}`
        if (name in seenOutputs) {
          name = `${prefix}${node.index} ${label ?? outputId}`
        }
      }
      seenOutputs[name] = 1

      this.nodeDef?.output_name?.push(name)
    }
  }

  static async registerFromWorkflow(
    groupNodes: Record<string, GroupNodeWorkflowData>,
    missingNodeTypes: (
      | string
      | { type: string; hint?: string; action?: unknown }
    )[]
  ) {
    for (const g in groupNodes) {
      const groupData = groupNodes[g]

      let hasMissing = false
      for (const n of groupData.nodes) {
        // Find missing node types
        if (!n.type || !(n.type in LiteGraph.registered_node_types)) {
          missingNodeTypes.push({
            type: n.type ?? 'unknown',
            hint: ` (In group node '${PREFIX}${SEPARATOR}${g}')`
          })

          missingNodeTypes.push({
            type: `${PREFIX}${SEPARATOR}` + g,
            action: {
              text: 'Remove from workflow',
              callback: (e: MouseEvent) => {
                delete groupNodes[g]
                const target = e.target as HTMLElement
                target.textContent = 'Removed'
                target.style.pointerEvents = 'none'
                target.style.opacity = '0.7'
              }
            }
          })

          hasMissing = true
        }
      }

      if (hasMissing) continue

      const config = new GroupNodeConfig(g, groupData)
      await config.registerType()
    }
  }
}

/**
 * Migration-only adapter for deprecated group nodes.
 *
 * Group nodes are no longer a supported feature. When a legacy workflow that
 * contains group nodes is loaded, {@link GroupNodeConfig.registerFromWorkflow}
 * synthesizes temporary node types so the instances can be created during
 * `configure`. The load-time migration unpacks each instance via
 * {@link convertToNodes} and {@link LGraph.convertToSubgraph} repackages the
 * result as a subgraph.
 *
 * @knipIgnoreUnusedButUsedByCustomNodes
 */
export class GroupNodeHandler {
  node: LGraphNode
  groupData: GroupNodeConfig

  constructor(node: LGraphNode) {
    this.node = node
    this.groupData = node.constructor?.nodeData?.[GROUP] as GroupNodeConfig
  }

  /**
   * Unpacks this group node into its constituent nodes within the root graph,
   * copying current widget values and reconnecting external links, then removes
   * the group node. Returns the newly created nodes.
   *
   * Lossiness is accepted: group nodes nested inside subgraphs are unpacked into
   * the root graph rather than their original container.
   */
  convertToNodes(): LGraphNode[] {
    const node = this.node
    const { nodeData, oldToNewWidgetMap, oldToNewInputMap, newToOldOutputMap } =
      this.groupData

    const addInnerNodes = () => {
      // Clone the node data so we don't mutate it for other instances
      const c = { ...nodeData }
      c.nodes = c.nodes.map((n) => ({ ...n, id: undefined }))
      deserialiseAndCreate(JSON.stringify(c), app.canvas)

      const [x, y] = node.pos
      let top: number | undefined
      let left: number | undefined
      // deserialiseAndCreate selects the created nodes in creation order, which
      // matches nodeData.nodes order.
      const selectedIds = Object.keys(app.canvas.selected_nodes)
      const newNodes: LGraphNode[] = []
      for (let i = 0; i < selectedIds.length; i++) {
        const selectedId = parseNodeId(selectedIds[i])
        const newNode = selectedId
          ? app.rootGraph.getNodeById(selectedId)
          : null
        const innerNodeData = nodeData.nodes[i]
        if (!newNode) continue
        newNodes.push(newNode)

        if (left == null || newNode.pos[0] < left) left = newNode.pos[0]
        if (top == null || newNode.pos[1] < top) top = newNode.pos[1]

        if (!newNode.widgets || !innerNodeData) continue

        const map = oldToNewWidgetMap[i]
        if (!map) continue
        for (const oldName of Object.keys(map)) {
          const newName = map[oldName]
          if (!newName) continue

          const widgetIndex =
            node.widgets?.findIndex((w) => w.name === newName) ?? -1
          if (widgetIndex === -1) continue

          // Populate the main and any linked widgets
          if (innerNodeData.type === 'PrimitiveNode') {
            for (let j = 0; j < newNode.widgets.length; j++) {
              const srcWidget = node.widgets?.[widgetIndex + j]
              if (srcWidget) newNode.widgets[j].value = srcWidget.value
            }
          } else {
            const outerWidget = node.widgets?.[widgetIndex]
            const newWidget = newNode.widgets.find((w) => w.name === oldName)
            if (!newWidget || !outerWidget) continue

            newWidget.value = outerWidget.value
            const linkedWidgets = outerWidget.linkedWidgets ?? []
            for (let w = 0; w < linkedWidgets.length; w++) {
              const newLinked = newWidget.linkedWidgets?.[w]
              if (newLinked && linkedWidgets[w]) {
                newLinked.value = linkedWidgets[w].value
              }
            }
          }
        }
      }

      // Shift each node so the unpacked group appears at the group node position
      for (const newNode of newNodes) {
        newNode.pos[0] -= (left ?? 0) - x
        newNode.pos[1] -= (top ?? 0) - y
      }

      return { newNodes, selectedIds }
    }

    const reconnectInputs = (selectedIds: (string | number)[]) => {
      for (const innerNodeIndex in oldToNewInputMap) {
        const selectedId = parseNodeId(selectedIds[Number(innerNodeIndex)])
        const newNode = selectedId
          ? app.rootGraph.getNodeById(selectedId)
          : null
        if (!newNode) continue
        const map = oldToNewInputMap[Number(innerNodeIndex)]
        for (const innerInputId in map) {
          const groupSlotId = map[Number(innerInputId)]
          if (groupSlotId == null) continue
          const link = node.getInputLink(groupSlotId)
          if (!link) continue
          const originNode = app.rootGraph.getNodeById(link.origin_id)
          originNode?.connect(link.origin_slot, newNode, +innerInputId)
        }
      }
    }

    const reconnectOutputs = (selectedIds: (string | number)[]) => {
      for (
        let groupOutputId = 0;
        groupOutputId < node.outputs?.length;
        groupOutputId++
      ) {
        const links = outputLinks(app.rootGraph, node.id, groupOutputId)
        for (const link of links) {
          const slot = newToOldOutputMap[groupOutputId]
          if (!slot) continue
          const targetNode = app.rootGraph.getNodeById(link.target_id)
          const selectedId = parseNodeId(selectedIds[slot.node.index ?? 0])
          const newNode = selectedId
            ? app.rootGraph.getNodeById(selectedId)
            : null
          if (targetNode) {
            newNode?.connect(slot.slot, targetNode, link.target_slot)
          }
        }
      }
    }

    app.canvas.emitBeforeChange()
    try {
      const { newNodes, selectedIds } = addInnerNodes()
      reconnectInputs(selectedIds)
      reconnectOutputs(selectedIds)
      app.rootGraph.remove(this.node)
      return newNodes
    } finally {
      app.canvas.emitAfterChange()
    }
  }

  static getHandler(node: LGraphNode): GroupNodeHandler | undefined {
    let handler = (node as LGraphNode & { [GROUP]?: GroupNodeHandler })[GROUP]
    if (!handler && GroupNodeHandler.isGroupNode(node)) {
      handler = new GroupNodeHandler(node)
      ;(node as LGraphNode & { [GROUP]: GroupNodeHandler })[GROUP] = handler
    }
    return handler
  }

  static isGroupNode(node: LGraphNode) {
    return !!node.constructor?.nodeData?.[GROUP]
  }
}

export const replaceLegacySeparators = (nodes: ComfyNode[]): void => {
  for (const node of nodes) {
    if (typeof node.type === 'string' && node.type.startsWith('workflow/')) {
      node.type = node.type.replace(/^workflow\//, `${PREFIX}${SEPARATOR}`)
    }
  }
}

/**
 * Converts every group node in the root graph to a subgraph. Re-scans until none
 * remain so group nodes revealed by a previous conversion are also migrated. A
 * failed conversion removes the offending node so loading can continue (accepted
 * lossiness) and the scan cannot loop forever.
 * @returns the number of group nodes converted
 */
function convertLoadedGroupNodes(): number {
  let converted = 0
  const failed = new Set<LGraphNode>()
  for (;;) {
    const node = app.rootGraph.nodes.find(
      (n) => GroupNodeHandler.isGroupNode(n) && !failed.has(n)
    )
    if (!node) return converted
    try {
      const handler = GroupNodeHandler.getHandler(node)
      if (!handler) throw new Error('Missing handler for group node')
      const innerNodes = handler.convertToNodes()
      for (const inner of innerNodes) inner.updateArea()
      app.rootGraph.convertToSubgraph(new Set(innerNodes))
      converted++
    } catch (error) {
      console.error('Failed to convert group node to subgraph', error)
      failed.add(node)
      try {
        app.rootGraph.remove(node)
      } catch (removeError) {
        console.error(
          'Failed to remove group node after conversion failure',
          removeError
        )
      }
    }
  }
}

/** True while a workflow load is in progress, to defer stray paste conversions. */
let isLoadingWorkflow = false

const id = 'Comfy.GroupNode'

/**
 * Global node definitions cache. Populated by `addCustomNodeDefs` during
 * extension initialization and read by {@link GroupNodeConfig.getNodeDef} when
 * synthesizing temporary group-node definitions during load.
 */
let globalDefs: Record<string, ComfyNodeDef>
const ext: ComfyExtension = {
  name: id,
  addCustomNodeDefs(defs: Record<string, ComfyNodeDef>) {
    globalDefs = defs
  },
  async beforeConfigureGraph(
    graphData: ComfyWorkflowJSON,
    missingNodeTypes: string[]
  ) {
    isLoadingWorkflow = true
    const nodes = graphData?.extra?.groupNodes as
      | Record<string, GroupNodeWorkflowData>
      | undefined
    if (nodes) {
      replaceLegacySeparators(graphData.nodes)
      await GroupNodeConfig.registerFromWorkflow(nodes, missingNodeTypes)
    }
  },
  afterConfigureGraph() {
    try {
      if (convertLoadedGroupNodes() > 0) {
        delete app.rootGraph.extra?.groupNodes
      }
    } finally {
      isLoadingWorkflow = false
    }
  },
  nodeCreated(node: LGraphNode) {
    if (!GroupNodeHandler.isGroupNode(node)) return
    const handler = GroupNodeHandler.getHandler(node)
    // A stray group node created after load (e.g. paste) has no migration pass;
    // convert it to a subgraph once it has joined a graph.
    if (!isLoadingWorkflow) {
      queueMicrotask(() => {
        const graph = node.graph
        if (graph && handler && GroupNodeHandler.isGroupNode(node)) {
          try {
            const innerNodes = handler.convertToNodes()
            for (const inner of innerNodes) inner.updateArea()
            graph.convertToSubgraph(new Set(innerNodes))
          } catch (error) {
            console.error(
              'Failed to convert stray group node to subgraph',
              error
            )
          }
        }
      })
    }
  }
}

app.registerExtension(ext)
