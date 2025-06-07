import { LiteGraph } from '@comfyorg/litegraph'
import { LGraphNode, type NodeId } from '@comfyorg/litegraph/dist/LGraphNode'

import { t } from '@/i18n'
import {
  ComfyLink,
  ComfyNode,
  ComfyWorkflowJSON
} from '@/schemas/comfyWorkflowSchema'
import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'
import { useDialogService } from '@/services/dialogService'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import { useToastStore } from '@/stores/toastStore'
import { useWidgetStore } from '@/stores/widgetStore'
import { ComfyExtension } from '@/types/comfy'
import { deserialiseAndCreate, serialise } from '@/utils/vintageClipboard'

import { api } from '../../scripts/api'
import { app } from '../../scripts/app'
import { ManageGroupDialog } from './groupNodeManage'
import { mergeIfValid } from './widgetInputs'

type GroupNodeWorkflowData = {
  external: ComfyLink[]
  links: ComfyLink[]
  nodes: ComfyNode[]
}

const GROUP = Symbol()

// v1 Prefix + Separator: workflow/
// v2 Prefix + Separator: workflow> (ComfyUI_frontend v1.2.63)
const PREFIX = 'workflow'
const SEPARATOR = '>'

const Workflow = {
  InUse: {
    Free: 0,
    Registered: 1,
    InWorkflow: 2
  },
  // @ts-expect-error fixme ts strict error
  isInUseGroupNode(name) {
    const id = `${PREFIX}${SEPARATOR}${name}`
    // Check if lready registered/in use in this workflow
    // @ts-expect-error fixme ts strict error
    if (app.graph.extra?.groupNodes?.[name]) {
      if (app.graph.nodes.find((n) => n.type === id)) {
        return Workflow.InUse.InWorkflow
      } else {
        return Workflow.InUse.Registered
      }
    }
    return Workflow.InUse.Free
  },
  storeGroupNode(name: string, data: GroupNodeWorkflowData) {
    let extra = app.graph.extra
    if (!extra) app.graph.extra = extra = {}
    let groupNodes = extra.groupNodes
    if (!groupNodes) extra.groupNodes = groupNodes = {}
    // @ts-expect-error fixme ts strict error
    groupNodes[name] = data
  }
}

class GroupNodeBuilder {
  nodes: LGraphNode[]
  // @ts-expect-error fixme ts strict error
  nodeData: GroupNodeWorkflowData

  constructor(nodes: LGraphNode[]) {
    this.nodes = nodes
  }

  async build() {
    const name = await this.getName()
    if (!name) return

    // Sort the nodes so they are in execution order
    // this allows for widgets to be in the correct order when reconstructing
    this.sortNodes()

    this.nodeData = this.getNodeData()
    Workflow.storeGroupNode(name, this.nodeData)

    return { name, nodeData: this.nodeData }
  }

  async getName() {
    const name = await useDialogService().prompt({
      title: t('groupNode.create'),
      message: t('groupNode.enterName'),
      defaultValue: ''
    })
    if (!name) return
    const used = Workflow.isInUseGroupNode(name)
    switch (used) {
      case Workflow.InUse.InWorkflow:
        useToastStore().addAlert(
          'An in use group node with this name already exists embedded in this workflow, please remove any instances or use a new name.'
        )
        return
      case Workflow.InUse.Registered:
        if (
          !confirm(
            'A group node with this name already exists embedded in this workflow, are you sure you want to overwrite it?'
          )
        ) {
          return
        }
        break
    }
    return name
  }

  sortNodes() {
    // Gets the builders nodes in graph execution order
    const nodesInOrder = app.graph.computeExecutionOrder(false)
    this.nodes = this.nodes
      .map((node) => ({ index: nodesInOrder.indexOf(node), node }))
      // @ts-expect-error id might be string
      .sort((a, b) => a.index - b.index || a.node.id - b.node.id)
      .map(({ node }) => node)
  }

  getNodeData() {
    // @ts-expect-error fixme ts strict error
    const storeLinkTypes = (config) => {
      // Store link types for dynamically typed nodes e.g. reroutes
      for (const link of config.links) {
        const origin = app.graph.getNodeById(link[4])
        // @ts-expect-error fixme ts strict error
        const type = origin.outputs[link[1]].type
        link.push(type)
      }
    }

    // @ts-expect-error fixme ts strict error
    const storeExternalLinks = (config) => {
      // Store any external links to the group in the config so when rebuilding we add extra slots
      config.external = []
      for (let i = 0; i < this.nodes.length; i++) {
        const node = this.nodes[i]
        if (!node.outputs?.length) continue
        for (let slot = 0; slot < node.outputs.length; slot++) {
          let hasExternal = false
          const output = node.outputs[slot]
          let type = output.type
          if (!output.links?.length) continue
          for (const l of output.links) {
            const link = app.graph.links[l]
            if (!link) continue
            if (type === '*') type = link.type

            if (!app.canvas.selected_nodes[link.target_id]) {
              hasExternal = true
              break
            }
          }
          if (hasExternal) {
            config.external.push([i, slot, type])
          }
        }
      }
    }

    // Use the built in copyToClipboard function to generate the node data we need
    try {
      // @ts-expect-error fixme ts strict error
      const serialised = serialise(this.nodes, app.canvas.graph)
      const config = JSON.parse(serialised)

      storeLinkTypes(config)
      storeExternalLinks(config)

      return config
    } finally {
    }
  }
}

export class GroupNodeConfig {
  name: string
  nodeData: any
  inputCount: number
  oldToNewOutputMap: {}
  newToOldOutputMap: {}
  oldToNewInputMap: {}
  oldToNewWidgetMap: {}
  newToOldWidgetMap: {}
  primitiveDefs: {}
  widgetToPrimitive: {}
  primitiveToWidget: {}
  nodeInputs: {}
  outputVisibility: any[]
  // @ts-expect-error fixme ts strict error
  nodeDef: ComfyNodeDef
  // @ts-expect-error fixme ts strict error
  inputs: any[]
  // @ts-expect-error fixme ts strict error
  linksFrom: {}
  // @ts-expect-error fixme ts strict error
  linksTo: {}
  // @ts-expect-error fixme ts strict error
  externalFrom: {}

  // @ts-expect-error fixme ts strict error
  constructor(name, nodeData) {
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
      // @ts-expect-error Unused, doesn't exist
      output_is_hidden: [],
      name: source + SEPARATOR + this.name,
      display_name: this.name,
      category: 'group nodes' + (SEPARATOR + source),
      input: { required: {} },
      description: `Group node combining ${this.nodeData.nodes
        // @ts-expect-error fixme ts strict error
        .map((n) => n.type)
        .join(', ')}`,
      python_module: 'custom_nodes.' + this.name,

      [GROUP]: this
    }

    this.inputs = []
    const seenInputs = {}
    const seenOutputs = {}
    for (let i = 0; i < this.nodeData.nodes.length; i++) {
      const node = this.nodeData.nodes[i]
      node.index = i
      this.processNode(node, seenInputs, seenOutputs)
    }

    for (const p of this.#convertedToProcess) {
      // @ts-expect-error fixme ts strict error
      p()
    }
    // @ts-expect-error fixme ts strict error
    this.#convertedToProcess = null
    await app.registerNodeDef(`${PREFIX}${SEPARATOR}` + this.name, this.nodeDef)
    useNodeDefStore().addNodeDef(this.nodeDef)
  }

  getLinks() {
    this.linksFrom = {}
    this.linksTo = {}
    this.externalFrom = {}

    // Extract links for easy lookup
    for (const l of this.nodeData.links) {
      const [sourceNodeId, sourceNodeSlot, targetNodeId, targetNodeSlot] = l

      // Skip links outside the copy config
      if (sourceNodeId == null) continue

      // @ts-expect-error fixme ts strict error
      if (!this.linksFrom[sourceNodeId]) {
        // @ts-expect-error fixme ts strict error
        this.linksFrom[sourceNodeId] = {}
      }
      // @ts-expect-error fixme ts strict error
      if (!this.linksFrom[sourceNodeId][sourceNodeSlot]) {
        // @ts-expect-error fixme ts strict error
        this.linksFrom[sourceNodeId][sourceNodeSlot] = []
      }
      // @ts-expect-error fixme ts strict error
      this.linksFrom[sourceNodeId][sourceNodeSlot].push(l)

      // @ts-expect-error fixme ts strict error
      if (!this.linksTo[targetNodeId]) {
        // @ts-expect-error fixme ts strict error
        this.linksTo[targetNodeId] = {}
      }
      // @ts-expect-error fixme ts strict error
      this.linksTo[targetNodeId][targetNodeSlot] = l
    }

    if (this.nodeData.external) {
      for (const ext of this.nodeData.external) {
        // @ts-expect-error fixme ts strict error
        if (!this.externalFrom[ext[0]]) {
          // @ts-expect-error fixme ts strict error
          this.externalFrom[ext[0]] = { [ext[1]]: ext[2] }
        } else {
          // @ts-expect-error fixme ts strict error
          this.externalFrom[ext[0]][ext[1]] = ext[2]
        }
      }
    }
  }

  // @ts-expect-error fixme ts strict error
  processNode(node, seenInputs, seenOutputs) {
    const def = this.getNodeDef(node)
    if (!def) return

    const inputs = { ...def.input?.required, ...def.input?.optional }

    this.inputs.push(this.processNodeInputs(node, seenInputs, inputs))
    if (def.output?.length) this.processNodeOutputs(node, seenOutputs, def)
  }

  // @ts-expect-error fixme ts strict error
  getNodeDef(node) {
    // @ts-expect-error fixme ts strict error
    const def = globalDefs[node.type]
    if (def) return def

    // @ts-expect-error fixme ts strict error
    const linksFrom = this.linksFrom[node.index]
    if (node.type === 'PrimitiveNode') {
      // Skip as its not linked
      if (!linksFrom) return

      let type = linksFrom['0'][0][5]
      if (type === 'COMBO') {
        // Use the array items
        const source = node.outputs[0].widget.name
        const fromTypeName = this.nodeData.nodes[linksFrom['0'][0][2]].type
        // @ts-expect-error fixme ts strict error
        const fromType = globalDefs[fromTypeName]
        const input =
          fromType.input.required[source] ?? fromType.input.optional[source]
        type = input[0]
      }

      // @ts-expect-error fixme ts strict error
      const def = (this.primitiveDefs[node.index] = {
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
      // @ts-expect-error fixme ts strict error
      const linksTo = this.linksTo[node.index]
      // @ts-expect-error fixme ts strict error
      if (linksTo && linksFrom && !this.externalFrom[node.index]?.[0]) {
        // Being used internally
        return null
      }

      let config = {}
      let rerouteType = '*'
      if (linksFrom) {
        for (const [, , id, slot] of linksFrom['0']) {
          const node = this.nodeData.nodes[id]
          const input = node.inputs[slot]
          if (rerouteType === '*') {
            rerouteType = input.type
          }
          if (input.widget) {
            // @ts-expect-error fixme ts strict error
            const targetDef = globalDefs[node.type]
            const targetWidget =
              targetDef.input.required[input.widget.name] ??
              targetDef.input.optional[input.widget.name]

            const widget = [targetWidget[0], config]
            const res = mergeIfValid(
              {
                // @ts-expect-error fixme ts strict error
                widget
              },
              targetWidget,
              false,
              null,
              widget
            )
            config = res?.customConfig ?? config
          }
        }
      } else if (linksTo) {
        const [id, slot] = linksTo['0']
        rerouteType = this.nodeData.nodes[id].outputs[slot].type
      } else {
        // Reroute used as a pipe
        for (const l of this.nodeData.links) {
          if (l[2] === node.index) {
            rerouteType = l[5]
            break
          }
        }
        if (rerouteType === '*') {
          // Check for an external link
          // @ts-expect-error fixme ts strict error
          const t = this.externalFrom[node.index]?.[0]
          if (t) {
            rerouteType = t
          }
        }
      }

      // @ts-expect-error
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

  // @ts-expect-error fixme ts strict error
  getInputConfig(node, inputName, seenInputs, config, extra?) {
    const customConfig = this.nodeData.config?.[node.index]?.input?.[inputName]
    let name =
      customConfig?.name ??
      // @ts-expect-error fixme ts strict error
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
      extra.widget =
        // @ts-expect-error fixme ts strict error
        this.oldToNewWidgetMap[node.index]?.[config[1]?.widget ?? 'image'] ??
        'image'
    }

    if (extra) {
      config = [config[0], { ...config[1], ...extra }]
    }

    return { name, config, customConfig }
  }

  // @ts-expect-error fixme ts strict error
  processWidgetInputs(inputs, node, inputNames, seenInputs) {
    const slots = []
    const converted = new Map()
    // @ts-expect-error fixme ts strict error
    const widgetMap = (this.oldToNewWidgetMap[node.index] = {})
    for (const inputName of inputNames) {
      if (useWidgetStore().inputIsWidget(inputs[inputName])) {
        const convertedIndex = node.inputs?.findIndex(
          // @ts-expect-error fixme ts strict error
          (inp) => inp.name === inputName && inp.widget?.name === inputName
        )
        if (convertedIndex > -1) {
          // This widget has been converted to a widget
          // We need to store this in the correct position so link ids line up
          converted.set(convertedIndex, inputName)
          // @ts-expect-error fixme ts strict error
          widgetMap[inputName] = null
        } else {
          // Normal widget
          const { name, config } = this.getInputConfig(
            node,
            inputName,
            seenInputs,
            inputs[inputName]
          )
          // @ts-expect-error fixme ts strict error
          this.nodeDef.input.required[name] = config
          // @ts-expect-error fixme ts strict error
          widgetMap[inputName] = name
          // @ts-expect-error fixme ts strict error
          this.newToOldWidgetMap[name] = { node, inputName }
        }
      } else {
        // Normal input
        slots.push(inputName)
      }
    }
    return { converted, slots }
  }

  // @ts-expect-error fixme ts strict error
  checkPrimitiveConnection(link, inputName, inputs) {
    const sourceNode = this.nodeData.nodes[link[0]]
    if (sourceNode.type === 'PrimitiveNode') {
      // Merge link configurations
      const [sourceNodeId, _, targetNodeId, __] = link
      // @ts-expect-error fixme ts strict error
      const primitiveDef = this.primitiveDefs[sourceNodeId]
      const targetWidget = inputs[inputName]
      const primitiveConfig = primitiveDef.input.required.value
      const output = { widget: primitiveConfig }
      const config = mergeIfValid(
        // @ts-expect-error invalid slot type
        output,
        targetWidget,
        false,
        null,
        primitiveConfig
      )
      primitiveConfig[1] =
        config?.customConfig ?? inputs[inputName][1]
          ? { ...inputs[inputName][1] }
          : {}

      // @ts-expect-error fixme ts strict error
      let name = this.oldToNewWidgetMap[sourceNodeId]['value']
      name = name.substr(0, name.length - 6)
      primitiveConfig[1].control_after_generate = true
      primitiveConfig[1].control_prefix = name

      // @ts-expect-error fixme ts strict error
      let toPrimitive = this.widgetToPrimitive[targetNodeId]
      if (!toPrimitive) {
        // @ts-expect-error fixme ts strict error
        toPrimitive = this.widgetToPrimitive[targetNodeId] = {}
      }
      if (toPrimitive[inputName]) {
        toPrimitive[inputName].push(sourceNodeId)
      }
      toPrimitive[inputName] = sourceNodeId

      // @ts-expect-error fixme ts strict error
      let toWidget = this.primitiveToWidget[sourceNodeId]
      if (!toWidget) {
        // @ts-expect-error fixme ts strict error
        toWidget = this.primitiveToWidget[sourceNodeId] = []
      }
      toWidget.push({ nodeId: targetNodeId, inputName })
    }
  }

  // @ts-expect-error fixme ts strict error
  processInputSlots(inputs, node, slots, linksTo, inputMap, seenInputs) {
    // @ts-expect-error fixme ts strict error
    this.nodeInputs[node.index] = {}
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

      // @ts-expect-error fixme ts strict error
      this.nodeInputs[node.index][inputName] = name
      if (customConfig?.visible === false) continue

      // @ts-expect-error fixme ts strict error
      this.nodeDef.input.required[name] = config
      inputMap[i] = this.inputCount++
    }
  }

  processConvertedWidgets(
    // @ts-expect-error fixme ts strict error
    inputs,
    // @ts-expect-error fixme ts strict error
    node,
    // @ts-expect-error fixme ts strict error
    slots,
    // @ts-expect-error fixme ts strict error
    converted,
    // @ts-expect-error fixme ts strict error
    linksTo,
    // @ts-expect-error fixme ts strict error
    inputMap,
    // @ts-expect-error fixme ts strict error
    seenInputs
  ) {
    // Add converted widgets sorted into their index order (ordered as they were converted) so link ids match up
    const convertedSlots = [...converted.keys()]
      .sort()
      .map((k) => converted.get(k))
    for (let i = 0; i < convertedSlots.length; i++) {
      const inputName = convertedSlots[i]
      if (linksTo[slots.length + i]) {
        this.checkPrimitiveConnection(
          linksTo[slots.length + i],
          inputName,
          inputs
        )
        // This input is linked so we can skip it
        continue
      }

      const { name, config } = this.getInputConfig(
        node,
        inputName,
        seenInputs,
        inputs[inputName],
        {
          defaultInput: true
        }
      )

      // @ts-expect-error fixme ts strict error
      this.nodeDef.input.required[name] = config
      // @ts-expect-error fixme ts strict error
      this.newToOldWidgetMap[name] = { node, inputName }

      // @ts-expect-error fixme ts strict error
      if (!this.oldToNewWidgetMap[node.index]) {
        // @ts-expect-error fixme ts strict error
        this.oldToNewWidgetMap[node.index] = {}
      }
      // @ts-expect-error fixme ts strict error
      this.oldToNewWidgetMap[node.index][inputName] = name

      inputMap[slots.length + i] = this.inputCount++
    }
  }

  #convertedToProcess = []
  // @ts-expect-error fixme ts strict error
  processNodeInputs(node, seenInputs, inputs) {
    // @ts-expect-error fixme ts strict error
    const inputMapping = []

    const inputNames = Object.keys(inputs)
    if (!inputNames.length) return

    const { converted, slots } = this.processWidgetInputs(
      inputs,
      node,
      inputNames,
      seenInputs
    )
    // @ts-expect-error fixme ts strict error
    const linksTo = this.linksTo[node.index] ?? {}
    // @ts-expect-error fixme ts strict error
    const inputMap = (this.oldToNewInputMap[node.index] = {})
    this.processInputSlots(inputs, node, slots, linksTo, inputMap, seenInputs)

    // Converted inputs have to be processed after all other nodes as they'll be at the end of the list
    // @ts-expect-error fixme ts strict error
    this.#convertedToProcess.push(() =>
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

    // @ts-expect-error fixme ts strict error
    return inputMapping
  }

  // @ts-expect-error fixme ts strict error
  processNodeOutputs(node, seenOutputs, def) {
    // @ts-expect-error fixme ts strict error
    const oldToNew = (this.oldToNewOutputMap[node.index] = {})

    // Add outputs
    for (let outputId = 0; outputId < def.output.length; outputId++) {
      // @ts-expect-error fixme ts strict error
      const linksFrom = this.linksFrom[node.index]
      // If this output is linked internally we flag it to hide
      const hasLink =
        // @ts-expect-error fixme ts strict error
        linksFrom?.[outputId] && !this.externalFrom[node.index]?.[outputId]
      const customConfig =
        this.nodeData.config?.[node.index]?.output?.[outputId]
      const visible = customConfig?.visible ?? !hasLink
      this.outputVisibility.push(visible)
      if (!visible) {
        continue
      }

      // @ts-expect-error fixme ts strict error
      oldToNew[outputId] = this.nodeDef.output.length
      // @ts-expect-error fixme ts strict error
      this.newToOldOutputMap[this.nodeDef.output.length] = {
        node,
        slot: outputId
      }
      // @ts-expect-error fixme ts strict error
      this.nodeDef.output.push(def.output[outputId])
      // @ts-expect-error fixme ts strict error
      this.nodeDef.output_is_list.push(def.output_is_list[outputId])

      let label = customConfig?.name
      if (!label) {
        label = def.output_name?.[outputId] ?? def.output[outputId]
        // @ts-expect-error fixme ts strict error
        const output = node.outputs.find((o) => o.name === label)
        if (output?.label) {
          label = output.label
        }
      }

      let name = label
      if (name in seenOutputs) {
        const prefix = `${node.title ?? node.type} `
        name = `${prefix}${label}`
        if (name in seenOutputs) {
          name = `${prefix}${node.index} ${label}`
        }
      }
      seenOutputs[name] = 1

      // @ts-expect-error fixme ts strict error
      this.nodeDef.output_name.push(name)
    }
  }

  // @ts-expect-error fixme ts strict error
  static async registerFromWorkflow(groupNodes, missingNodeTypes) {
    for (const g in groupNodes) {
      const groupData = groupNodes[g]

      let hasMissing = false
      for (const n of groupData.nodes) {
        // Find missing node types
        if (!(n.type in LiteGraph.registered_node_types)) {
          missingNodeTypes.push({
            type: n.type,
            hint: ` (In group node '${PREFIX}${SEPARATOR}${g}')`
          })

          missingNodeTypes.push({
            type: `${PREFIX}${SEPARATOR}` + g,
            action: {
              text: 'Remove from workflow',
              // @ts-expect-error fixme ts strict error
              callback: (e) => {
                delete groupNodes[g]
                e.target.textContent = 'Removed'
                e.target.style.pointerEvents = 'none'
                e.target.style.opacity = 0.7
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

export class GroupNodeHandler {
  node: LGraphNode
  groupData: any
  innerNodes: any

  constructor(node: LGraphNode) {
    this.node = node
    this.groupData = node.constructor?.nodeData?.[GROUP]

    this.node.setInnerNodes = (innerNodes) => {
      this.innerNodes = innerNodes

      for (
        let innerNodeIndex = 0;
        innerNodeIndex < this.innerNodes.length;
        innerNodeIndex++
      ) {
        const innerNode = this.innerNodes[innerNodeIndex]

        for (const w of innerNode.widgets ?? []) {
          if (w.type === 'converted-widget') {
            w.serializeValue = w.origSerializeValue
          }
        }

        innerNode.index = innerNodeIndex
        // @ts-expect-error fixme ts strict error
        innerNode.getInputNode = (slot) => {
          // Check if this input is internal or external
          const externalSlot =
            this.groupData.oldToNewInputMap[innerNode.index]?.[slot]
          if (externalSlot != null) {
            return this.node.getInputNode(externalSlot)
          }

          // Internal link
          const innerLink = this.groupData.linksTo[innerNode.index]?.[slot]
          if (!innerLink) return null

          const inputNode = innerNodes[innerLink[0]]
          // Primitives will already apply their values
          if (inputNode.type === 'PrimitiveNode') return null

          return inputNode
        }

        // @ts-expect-error fixme ts strict error
        innerNode.getInputLink = (slot) => {
          const externalSlot =
            this.groupData.oldToNewInputMap[innerNode.index]?.[slot]
          if (externalSlot != null) {
            // The inner node is connected via the group node inputs
            const linkId = this.node.inputs[externalSlot].link
            // @ts-expect-error fixme ts strict error
            let link = app.graph.links[linkId]

            // Use the outer link, but update the target to the inner node
            link = {
              ...link,
              target_id: innerNode.id,
              target_slot: +slot
            }
            return link
          }

          let link = this.groupData.linksTo[innerNode.index]?.[slot]
          if (!link) return null
          // Use the inner link, but update the origin node to be inner node id
          link = {
            origin_id: innerNodes[link[0]].id,
            origin_slot: link[1],
            target_id: innerNode.id,
            target_slot: +slot
          }
          return link
        }
      }
    }

    this.node.updateLink = (link) => {
      // Replace the group node reference with the internal node
      // @ts-expect-error Can this be removed?  Or replaced with: LLink.create(link.asSerialisable())
      link = { ...link }
      const output = this.groupData.newToOldOutputMap[link.origin_slot]
      let innerNode = this.innerNodes[output.node.index]
      let l
      while (innerNode?.type === 'Reroute') {
        l = innerNode.getInputLink(0)
        innerNode = innerNode.getInputNode(0)
      }

      if (!innerNode) {
        return null
      }

      if (l && GroupNodeHandler.isGroupNode(innerNode)) {
        return innerNode.updateLink(l)
      }

      link.origin_id = innerNode.id
      link.origin_slot = l?.origin_slot ?? output.slot
      return link
    }

    this.node.getInnerNodes = () => {
      if (!this.innerNodes) {
        // @ts-expect-error fixme ts strict error
        this.node.setInnerNodes(
          // @ts-expect-error fixme ts strict error
          this.groupData.nodeData.nodes.map((n, i) => {
            const innerNode = LiteGraph.createNode(n.type)
            // @ts-expect-error fixme ts strict error
            innerNode.configure(n)
            // @ts-expect-error fixme ts strict error
            innerNode.id = `${this.node.id}:${i}`
            return innerNode
          })
        )
      }

      this.updateInnerWidgets()

      return this.innerNodes
    }

    // @ts-expect-error fixme ts strict error
    this.node.recreate = async () => {
      const id = this.node.id
      const sz = this.node.size
      // @ts-expect-error fixme ts strict error
      const nodes = this.node.convertToNodes()

      const groupNode = LiteGraph.createNode(this.node.type)
      // @ts-expect-error fixme ts strict error
      groupNode.id = id

      // Reuse the existing nodes for this instance
      // @ts-expect-error fixme ts strict error
      groupNode.setInnerNodes(nodes)
      // @ts-expect-error fixme ts strict error
      groupNode[GROUP].populateWidgets()
      // @ts-expect-error fixme ts strict error
      app.graph.add(groupNode)
      // @ts-expect-error fixme ts strict error
      groupNode.setSize([
        // @ts-expect-error fixme ts strict error
        Math.max(groupNode.size[0], sz[0]),
        // @ts-expect-error fixme ts strict error
        Math.max(groupNode.size[1], sz[1])
      ])

      // Remove all converted nodes and relink them
      const builder = new GroupNodeBuilder(nodes)
      const nodeData = builder.getNodeData()
      // @ts-expect-error fixme ts strict error
      groupNode[GROUP].groupData.nodeData.links = nodeData.links
      // @ts-expect-error fixme ts strict error
      groupNode[GROUP].replaceNodes(nodes)
      return groupNode
    }

    // @ts-expect-error fixme ts strict error
    this.node.convertToNodes = () => {
      const addInnerNodes = () => {
        // Clone the node data so we dont mutate it for other nodes
        const c = { ...this.groupData.nodeData }
        c.nodes = [...c.nodes]
        // @ts-expect-error fixme ts strict error
        const innerNodes = this.node.getInnerNodes()
        let ids = []
        for (let i = 0; i < c.nodes.length; i++) {
          let id = innerNodes?.[i]?.id
          // Use existing IDs if they are set on the inner nodes
          // @ts-expect-error id can be string or number
          if (id == null || isNaN(id)) {
            // @ts-expect-error fixme ts strict error
            id = undefined
          } else {
            ids.push(id)
          }
          c.nodes[i] = { ...c.nodes[i], id }
        }
        deserialiseAndCreate(JSON.stringify(c), app.canvas)

        const [x, y] = this.node.pos
        let top
        let left
        // Configure nodes with current widget data
        const selectedIds = ids.length
          ? ids
          : Object.keys(app.canvas.selected_nodes)
        const newNodes = []
        for (let i = 0; i < selectedIds.length; i++) {
          const id = selectedIds[i]
          const newNode = app.graph.getNodeById(id)
          const innerNode = innerNodes[i]
          newNodes.push(newNode)

          // @ts-expect-error fixme ts strict error
          if (left == null || newNode.pos[0] < left) {
            // @ts-expect-error fixme ts strict error
            left = newNode.pos[0]
          }
          // @ts-expect-error fixme ts strict error
          if (top == null || newNode.pos[1] < top) {
            // @ts-expect-error fixme ts strict error
            top = newNode.pos[1]
          }

          // @ts-expect-error fixme ts strict error
          if (!newNode.widgets) continue

          // @ts-expect-error fixme ts strict error
          const map = this.groupData.oldToNewWidgetMap[innerNode.index]
          if (map) {
            const widgets = Object.keys(map)

            for (const oldName of widgets) {
              const newName = map[oldName]
              if (!newName) continue

              // @ts-expect-error fixme ts strict error
              const widgetIndex = this.node.widgets.findIndex(
                (w) => w.name === newName
              )
              if (widgetIndex === -1) continue

              // Populate the main and any linked widgets
              if (innerNode.type === 'PrimitiveNode') {
                // @ts-expect-error fixme ts strict error
                for (let i = 0; i < newNode.widgets.length; i++) {
                  // @ts-expect-error fixme ts strict error
                  newNode.widgets[i].value =
                    // @ts-expect-error fixme ts strict error
                    this.node.widgets[widgetIndex + i].value
                }
              } else {
                // @ts-expect-error fixme ts strict error
                const outerWidget = this.node.widgets[widgetIndex]
                // @ts-expect-error fixme ts strict error
                const newWidget = newNode.widgets.find(
                  (w) => w.name === oldName
                )
                if (!newWidget) continue

                newWidget.value = outerWidget.value
                // @ts-expect-error fixme ts strict error
                for (let w = 0; w < outerWidget.linkedWidgets?.length; w++) {
                  // @ts-expect-error fixme ts strict error
                  newWidget.linkedWidgets[w].value =
                    // @ts-expect-error fixme ts strict error
                    outerWidget.linkedWidgets[w].value
                }
              }
            }
          }
        }

        // Shift each node
        for (const newNode of newNodes) {
          // @ts-expect-error fixme ts strict error
          newNode.pos[0] -= left - x
          // @ts-expect-error fixme ts strict error
          newNode.pos[1] -= top - y
        }

        return { newNodes, selectedIds }
      }

      // @ts-expect-error fixme ts strict error
      const reconnectInputs = (selectedIds) => {
        for (const innerNodeIndex in this.groupData.oldToNewInputMap) {
          const id = selectedIds[innerNodeIndex]
          const newNode = app.graph.getNodeById(id)
          const map = this.groupData.oldToNewInputMap[innerNodeIndex]
          for (const innerInputId in map) {
            const groupSlotId = map[innerInputId]
            if (groupSlotId == null) continue
            const slot = node.inputs[groupSlotId]
            if (slot.link == null) continue
            const link = app.graph.links[slot.link]
            if (!link) continue
            //  connect this node output to the input of another node
            const originNode = app.graph.getNodeById(link.origin_id)
            // @ts-expect-error fixme ts strict error
            originNode.connect(link.origin_slot, newNode, +innerInputId)
          }
        }
      }

      // @ts-expect-error fixme ts strict error
      const reconnectOutputs = (selectedIds) => {
        for (
          let groupOutputId = 0;
          groupOutputId < node.outputs?.length;
          groupOutputId++
        ) {
          const output = node.outputs[groupOutputId]
          if (!output.links) continue
          const links = [...output.links]
          for (const l of links) {
            const slot = this.groupData.newToOldOutputMap[groupOutputId]
            const link = app.graph.links[l]
            const targetNode = app.graph.getNodeById(link.target_id)
            const newNode = app.graph.getNodeById(selectedIds[slot.node.index])
            // @ts-expect-error fixme ts strict error
            newNode.connect(slot.slot, targetNode, link.target_slot)
          }
        }
      }

      app.canvas.emitBeforeChange()

      try {
        const { newNodes, selectedIds } = addInnerNodes()
        reconnectInputs(selectedIds)
        reconnectOutputs(selectedIds)
        app.graph.remove(this.node)

        return newNodes
      } finally {
        app.canvas.emitAfterChange()
      }
    }

    const getExtraMenuOptions = this.node.getExtraMenuOptions
    // @ts-expect-error Should pass patched return value getExtraMenuOptions
    this.node.getExtraMenuOptions = function (_, options) {
      // @ts-expect-error fixme ts strict error
      getExtraMenuOptions?.apply(this, arguments)

      // @ts-expect-error fixme ts strict error
      let optionIndex = options.findIndex((o) => o.content === 'Outputs')
      if (optionIndex === -1) optionIndex = options.length
      else optionIndex++
      options.splice(
        optionIndex,
        0,
        null,
        {
          content: 'Convert to nodes',
          // @ts-expect-error
          callback: () => {
            // @ts-expect-error fixme ts strict error
            return this.convertToNodes()
          }
        },
        {
          content: 'Manage Group Node',
          callback: () => manageGroupNodes(this.type)
        }
      )
    }

    // Draw custom collapse icon to identity this as a group
    const onDrawTitleBox = this.node.onDrawTitleBox
    this.node.onDrawTitleBox = function (ctx, height) {
      // @ts-expect-error fixme ts strict error
      onDrawTitleBox?.apply(this, arguments)

      const fill = ctx.fillStyle
      ctx.beginPath()
      ctx.rect(11, -height + 11, 2, 2)
      ctx.rect(14, -height + 11, 2, 2)
      ctx.rect(17, -height + 11, 2, 2)
      ctx.rect(11, -height + 14, 2, 2)
      ctx.rect(14, -height + 14, 2, 2)
      ctx.rect(17, -height + 14, 2, 2)
      ctx.rect(11, -height + 17, 2, 2)
      ctx.rect(14, -height + 17, 2, 2)
      ctx.rect(17, -height + 17, 2, 2)

      ctx.fillStyle = this.boxcolor || LiteGraph.NODE_DEFAULT_BOXCOLOR
      ctx.fill()
      ctx.fillStyle = fill
    }

    // Draw progress label
    const onDrawForeground = node.onDrawForeground
    const groupData = this.groupData.nodeData
    node.onDrawForeground = function (ctx) {
      // @ts-expect-error fixme ts strict error
      onDrawForeground?.apply?.(this, arguments)
      if (
        // @ts-expect-error fixme ts strict error
        +app.runningNodeId === this.id &&
        this.runningInternalNodeId !== null
      ) {
        // @ts-expect-error fixme ts strict error
        const n = groupData.nodes[this.runningInternalNodeId]
        if (!n) return
        const message = `Running ${n.title || n.type} (${this.runningInternalNodeId}/${groupData.nodes.length})`
        ctx.save()
        ctx.font = '12px sans-serif'
        const sz = ctx.measureText(message)
        ctx.fillStyle = node.boxcolor || LiteGraph.NODE_DEFAULT_BOXCOLOR
        ctx.beginPath()
        ctx.roundRect(
          0,
          -LiteGraph.NODE_TITLE_HEIGHT - 20,
          sz.width + 12,
          20,
          5
        )
        ctx.fill()

        ctx.fillStyle = '#fff'
        ctx.fillText(message, 6, -LiteGraph.NODE_TITLE_HEIGHT - 6)
        ctx.restore()
      }
    }

    // Flag this node as needing to be reset
    const onExecutionStart = this.node.onExecutionStart
    this.node.onExecutionStart = function () {
      // @ts-expect-error fixme ts strict error
      this.resetExecution = true
      // @ts-expect-error fixme ts strict error
      return onExecutionStart?.apply(this, arguments)
    }

    const self = this
    const onNodeCreated = this.node.onNodeCreated
    this.node.onNodeCreated = function () {
      if (!this.widgets) {
        return
      }
      const config = self.groupData.nodeData.config
      if (config) {
        for (const n in config) {
          const inputs = config[n]?.input
          for (const w in inputs) {
            if (inputs[w].visible !== false) continue
            const widgetName = self.groupData.oldToNewWidgetMap[n][w]
            const widget = this.widgets.find((w) => w.name === widgetName)
            if (widget) {
              widget.type = 'hidden'
              widget.computeSize = () => [0, -4]
            }
          }
        }
      }

      // @ts-expect-error fixme ts strict error
      return onNodeCreated?.apply(this, arguments)
    }

    // @ts-expect-error fixme ts strict error
    function handleEvent(type, getId, getEvent) {
      // @ts-expect-error fixme ts strict error
      const handler = ({ detail }) => {
        const id = getId(detail)
        if (!id) return
        const node = app.graph.getNodeById(id)
        if (node) return

        // @ts-expect-error fixme ts strict error
        const innerNodeIndex = this.innerNodes?.findIndex((n) => n.id == id)
        if (innerNodeIndex > -1) {
          // @ts-expect-error fixme ts strict error
          this.node.runningInternalNodeId = innerNodeIndex
          api.dispatchCustomEvent(
            type,
            // @ts-expect-error fixme ts strict error
            getEvent(detail, `${this.node.id}`, this.node)
          )
        }
      }
      api.addEventListener(type, handler)
      return handler
    }

    const executing = handleEvent.call(
      this,
      'executing',
      // @ts-expect-error fixme ts strict error
      (d) => d,
      // @ts-expect-error fixme ts strict error
      (_, id) => id
    )

    const executed = handleEvent.call(
      this,
      'executed',
      // @ts-expect-error fixme ts strict error
      (d) => d?.display_node || d?.node,
      // @ts-expect-error fixme ts strict error
      (d, id, node) => ({
        ...d,
        node: id,
        display_node: id,
        merge: !node.resetExecution
      })
    )

    const onRemoved = node.onRemoved
    this.node.onRemoved = function () {
      // @ts-expect-error fixme ts strict error
      onRemoved?.apply(this, arguments)
      api.removeEventListener('executing', executing)
      api.removeEventListener('executed', executed)
    }

    this.node.refreshComboInNode = (defs) => {
      // Update combo widget options
      for (const widgetName in this.groupData.newToOldWidgetMap) {
        // @ts-expect-error fixme ts strict error
        const widget = this.node.widgets.find((w) => w.name === widgetName)
        if (widget?.type === 'combo') {
          const old = this.groupData.newToOldWidgetMap[widgetName]
          const def = defs[old.node.type]
          const input =
            def?.input?.required?.[old.inputName] ??
            def?.input?.optional?.[old.inputName]
          if (!input) continue

          widget.options.values = input[0]

          if (
            old.inputName !== 'image' &&
            // @ts-expect-error Widget values
            !widget.options.values.includes(widget.value)
          ) {
            // @ts-expect-error fixme ts strict error
            widget.value = widget.options.values[0]
            // @ts-expect-error fixme ts strict error
            widget.callback(widget.value)
          }
        }
      }
    }
  }

  updateInnerWidgets() {
    for (const newWidgetName in this.groupData.newToOldWidgetMap) {
      // @ts-expect-error fixme ts strict error
      const newWidget = this.node.widgets.find((w) => w.name === newWidgetName)
      if (!newWidget) continue

      const newValue = newWidget.value
      const old = this.groupData.newToOldWidgetMap[newWidgetName]
      let innerNode = this.innerNodes[old.node.index]

      if (innerNode.type === 'PrimitiveNode') {
        innerNode.primitiveValue = newValue
        const primitiveLinked = this.groupData.primitiveToWidget[old.node.index]
        for (const linked of primitiveLinked ?? []) {
          const node = this.innerNodes[linked.nodeId]
          // @ts-expect-error fixme ts strict error
          const widget = node.widgets.find((w) => w.name === linked.inputName)

          if (widget) {
            widget.value = newValue
          }
        }
        continue
      } else if (innerNode.type === 'Reroute') {
        const rerouteLinks = this.groupData.linksFrom[old.node.index]
        if (rerouteLinks) {
          for (const [_, , targetNodeId, targetSlot] of rerouteLinks['0']) {
            const node = this.innerNodes[targetNodeId]
            const input = node.inputs[targetSlot]
            if (input.widget) {
              const widget = node.widgets?.find(
                // @ts-expect-error fixme ts strict error
                (w) => w.name === input.widget.name
              )
              if (widget) {
                widget.value = newValue
              }
            }
          }
        }
      }

      // @ts-expect-error fixme ts strict error
      const widget = innerNode.widgets?.find((w) => w.name === old.inputName)
      if (widget) {
        widget.value = newValue
      }
    }
  }

  // @ts-expect-error fixme ts strict error
  populatePrimitive(_node, nodeId, oldName) {
    // Converted widget, populate primitive if linked
    const primitiveId = this.groupData.widgetToPrimitive[nodeId]?.[oldName]
    if (primitiveId == null) return
    const targetWidgetName =
      this.groupData.oldToNewWidgetMap[primitiveId]['value']
    // @ts-expect-error fixme ts strict error
    const targetWidgetIndex = this.node.widgets.findIndex(
      (w) => w.name === targetWidgetName
    )
    if (targetWidgetIndex > -1) {
      const primitiveNode = this.innerNodes[primitiveId]
      let len = primitiveNode.widgets.length
      if (
        len - 1 !==
        // @ts-expect-error fixme ts strict error
        this.node.widgets[targetWidgetIndex].linkedWidgets?.length
      ) {
        // Fallback handling for if some reason the primitive has a different number of widgets
        // we dont want to overwrite random widgets, better to leave blank
        len = 1
      }
      for (let i = 0; i < len; i++) {
        // @ts-expect-error fixme ts strict error
        this.node.widgets[targetWidgetIndex + i].value =
          primitiveNode.widgets[i].value
      }
    }
    return true
  }

  // @ts-expect-error fixme ts strict error
  populateReroute(node, nodeId, map) {
    if (node.type !== 'Reroute') return

    const link = this.groupData.linksFrom[nodeId]?.[0]?.[0]
    if (!link) return
    const [, , targetNodeId, targetNodeSlot] = link
    const targetNode = this.groupData.nodeData.nodes[targetNodeId]
    const inputs = targetNode.inputs
    const targetWidget = inputs?.[targetNodeSlot]?.widget
    if (!targetWidget) return

    const offset = inputs.length - (targetNode.widgets_values?.length ?? 0)
    const v = targetNode.widgets_values?.[targetNodeSlot - offset]
    if (v == null) return

    const widgetName = Object.values(map)[0]
    // @ts-expect-error fixme ts strict error
    const widget = this.node.widgets.find((w) => w.name === widgetName)
    if (widget) {
      widget.value = v
    }
  }

  populateWidgets() {
    if (!this.node.widgets) return

    for (
      let nodeId = 0;
      nodeId < this.groupData.nodeData.nodes.length;
      nodeId++
    ) {
      const node = this.groupData.nodeData.nodes[nodeId]
      const map = this.groupData.oldToNewWidgetMap[nodeId] ?? {}
      const widgets = Object.keys(map)

      if (!node.widgets_values?.length) {
        // special handling for populating values into reroutes
        // this allows primitives connect to them to pick up the correct value
        this.populateReroute(node, nodeId, map)
        continue
      }

      let linkedShift = 0
      for (let i = 0; i < widgets.length; i++) {
        const oldName = widgets[i]
        const newName = map[oldName]
        const widgetIndex = this.node.widgets.findIndex(
          (w) => w.name === newName
        )
        const mainWidget = this.node.widgets[widgetIndex]
        if (
          this.populatePrimitive(node, nodeId, oldName) ||
          widgetIndex === -1
        ) {
          // Find the inner widget and shift by the number of linked widgets as they will have been removed too
          const innerWidget = this.innerNodes[nodeId].widgets?.find(
            // @ts-expect-error fixme ts strict error
            (w) => w.name === oldName
          )
          linkedShift += innerWidget?.linkedWidgets?.length ?? 0
        }
        if (widgetIndex === -1) {
          continue
        }

        // Populate the main and any linked widget
        mainWidget.value = node.widgets_values[i + linkedShift]
        // @ts-expect-error fixme ts strict error
        for (let w = 0; w < mainWidget.linkedWidgets?.length; w++) {
          this.node.widgets[widgetIndex + w + 1].value =
            node.widgets_values[i + ++linkedShift]
        }
      }
    }
  }

  // @ts-expect-error fixme ts strict error
  replaceNodes(nodes) {
    let top
    let left

    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i]
      if (left == null || node.pos[0] < left) {
        left = node.pos[0]
      }
      if (top == null || node.pos[1] < top) {
        top = node.pos[1]
      }

      this.linkOutputs(node, i)
      app.graph.remove(node)
    }

    this.linkInputs()
    this.node.pos = [left, top]
  }

  // @ts-expect-error fixme ts strict error
  linkOutputs(originalNode, nodeId) {
    if (!originalNode.outputs) return

    for (const output of originalNode.outputs) {
      if (!output.links) continue
      // Clone the links as they'll be changed if we reconnect
      const links = [...output.links]
      for (const l of links) {
        const link = app.graph.links[l]
        if (!link) continue

        const targetNode = app.graph.getNodeById(link.target_id)
        const newSlot =
          this.groupData.oldToNewOutputMap[nodeId]?.[link.origin_slot]
        if (newSlot != null) {
          // @ts-expect-error fixme ts strict error
          this.node.connect(newSlot, targetNode, link.target_slot)
        }
      }
    }
  }

  linkInputs() {
    for (const link of this.groupData.nodeData.links ?? []) {
      const [, originSlot, targetId, targetSlot, actualOriginId] = link
      const originNode = app.graph.getNodeById(actualOriginId)
      if (!originNode) continue // this node is in the group
      originNode.connect(
        originSlot,
        // @ts-expect-error Valid - uses deprecated interface.  Required check: if (graph.getNodeById(this.node.id) !== this.node) report()
        this.node.id,
        this.groupData.oldToNewInputMap[targetId][targetSlot]
      )
    }
  }

  // @ts-expect-error fixme ts strict error
  static getGroupData(node) {
    return (node.nodeData ?? node.constructor?.nodeData)?.[GROUP]
  }

  static isGroupNode(node: LGraphNode) {
    return !!node.constructor?.nodeData?.[GROUP]
  }

  static async fromNodes(nodes: LGraphNode[]) {
    // Process the nodes into the stored workflow group node data
    const builder = new GroupNodeBuilder(nodes)
    const res = await builder.build()
    if (!res) return

    const { name, nodeData } = res

    // Convert this data into a LG node definition and register it
    const config = new GroupNodeConfig(name, nodeData)
    await config.registerType()

    const groupNode = LiteGraph.createNode(`${PREFIX}${SEPARATOR}${name}`)
    // Reuse the existing nodes for this instance
    // @ts-expect-error fixme ts strict error
    groupNode.setInnerNodes(builder.nodes)
    // @ts-expect-error fixme ts strict error
    groupNode[GROUP].populateWidgets()
    // @ts-expect-error fixme ts strict error
    app.graph.add(groupNode)

    // Remove all converted nodes and relink them
    // @ts-expect-error fixme ts strict error
    groupNode[GROUP].replaceNodes(builder.nodes)
    return groupNode
  }
}

const replaceLegacySeparators = (nodes: ComfyNode[]): void => {
  for (const node of nodes) {
    if (typeof node.type === 'string' && node.type.startsWith('workflow/')) {
      node.type = node.type.replace(/^workflow\//, `${PREFIX}${SEPARATOR}`)
    }
  }
}

/**
 * Convert selected nodes to a group node
 * @throws {Error} if no nodes are selected
 * @throws {Error} if a group node is already selected
 * @throws {Error} if a group node is selected
 *
 * The context menu item should not be available if any of the above conditions are met.
 * The error is automatically handled by the commandStore when the command is executed.
 */
async function convertSelectedNodesToGroupNode() {
  const nodes = Object.values(app.canvas.selected_nodes ?? {})
  if (nodes.length === 0) {
    throw new Error('No nodes selected')
  }
  if (nodes.length === 1) {
    throw new Error('Please select multiple nodes to convert to group node')
  }
  if (nodes.some((n) => GroupNodeHandler.isGroupNode(n))) {
    throw new Error('Selected nodes contain a group node')
  }
  return await GroupNodeHandler.fromNodes(nodes)
}

function ungroupSelectedGroupNodes() {
  const nodes = Object.values(app.canvas.selected_nodes ?? {})
  for (const node of nodes) {
    if (GroupNodeHandler.isGroupNode(node)) {
      node.convertToNodes?.()
    }
  }
}

function manageGroupNodes(type?: string) {
  new ManageGroupDialog(app).show(type)
}

const id = 'Comfy.GroupNode'
// @ts-expect-error fixme ts strict error
let globalDefs
const ext: ComfyExtension = {
  name: id,
  commands: [
    {
      id: 'Comfy.GroupNode.ConvertSelectedNodesToGroupNode',
      label: 'Convert selected nodes to group node',
      icon: 'pi pi-sitemap',
      versionAdded: '1.3.17',
      function: convertSelectedNodesToGroupNode
    },
    {
      id: 'Comfy.GroupNode.UngroupSelectedGroupNodes',
      label: 'Ungroup selected group nodes',
      icon: 'pi pi-sitemap',
      versionAdded: '1.3.17',
      function: ungroupSelectedGroupNodes
    },
    {
      id: 'Comfy.GroupNode.ManageGroupNodes',
      label: 'Manage group nodes',
      icon: 'pi pi-cog',
      versionAdded: '1.3.17',
      function: manageGroupNodes
    }
  ],
  keybindings: [
    {
      commandId: 'Comfy.GroupNode.ConvertSelectedNodesToGroupNode',
      combo: {
        alt: true,
        key: 'g'
      }
    },
    {
      commandId: 'Comfy.GroupNode.UngroupSelectedGroupNodes',
      combo: {
        alt: true,
        shift: true,
        key: 'G'
      }
    }
  ],
  async beforeConfigureGraph(
    graphData: ComfyWorkflowJSON,
    missingNodeTypes: string[]
  ) {
    const nodes = graphData?.extra?.groupNodes
    if (nodes) {
      replaceLegacySeparators(graphData.nodes)
      await GroupNodeConfig.registerFromWorkflow(nodes, missingNodeTypes)
    }
  },
  addCustomNodeDefs(defs) {
    // Store this so we can mutate it later with group nodes
    globalDefs = defs
  },
  nodeCreated(node) {
    if (GroupNodeHandler.isGroupNode(node)) {
      // @ts-expect-error fixme ts strict error
      node[GROUP] = new GroupNodeHandler(node)

      // Ensure group nodes pasted from other workflows are stored
      // @ts-expect-error fixme ts strict error
      if (node.title && node[GROUP]?.groupData?.nodeData) {
        // @ts-expect-error fixme ts strict error
        Workflow.storeGroupNode(node.title, node[GROUP].groupData.nodeData)
      }
    }
  },
  // @ts-expect-error fixme ts strict error
  async refreshComboInNodes(defs) {
    // Re-register group nodes so new ones are created with the correct options
    // @ts-expect-error fixme ts strict error
    Object.assign(globalDefs, defs)
    const nodes = app.graph.extra?.groupNodes
    if (nodes) {
      await GroupNodeConfig.registerFromWorkflow(nodes, {})
    }
  }
}

app.registerExtension(ext)
