import { app } from '../../scripts/app'
import { api } from '../../scripts/api'
import {
  LiteGraph,
  LGraphNode,
  LLink,
  INodeOutputSlot,
  INodeInputSlot
} from '@comfyorg/litegraph'
import { ComfyNodeDef } from '@/types/apiTypes'

let lastRequest: number = 0
let requestIdGen: number = 0
async function updateDynamicTypes(object_info) {
  for (const [nodeId, nodeData] of Object.entries(object_info)) {
    // Convert the key to a number
    const node = app.graph.getNodeById(parseInt(nodeId))
    if (!node) {
      console.error('Node not found:', nodeId)
      continue
    }
    // @ts-expect-error
    node.UpdateDynamicNodeTypes(nodeData)
  }
}

function debounce(
  func: Function,
  nonDebounced: Function,
  prefixMs: number,
  postfixMs: number
) {
  let timeout: NodeJS.Timeout | null = null
  let queued: Boolean = false
  let lastArgs: any[] = []
  let handle = () => {
    if (queued) {
      func(...lastArgs)
      queued = false
    }
  }
  return (...args: any[]) => {
    if (nonDebounced) {
      nonDebounced(...args)
    }
    if (timeout) {
      lastArgs = args
      queued = true
    } else {
      lastArgs = args
      queued = true
      timeout = setTimeout(() => {
        handle()
        timeout = setTimeout(() => {
          handle()
          timeout = null
        }, postfixMs)
      }, prefixMs)
    }
  }
}

const resolveDynamicTypes = debounce(
  async () => {
    let currentRequest = requestIdGen
    lastRequest = currentRequest
    const p = await app.graphToPrompt()
    if (!('output' in p)) {
      console.log('Skipping dynamic type resolution -- no prompt found', p)
      return
    }
    const request = {
      client_id: api.clientId,
      prompt: p.output
    }
    const response = await api.fetchApi('/resolve_dynamic_types', {
      method: 'POST',
      body: JSON.stringify(request)
    })
    if (!response.ok) {
      console.error('Error:', response)
      return
    }
    const data = await response.json()
    if (lastRequest !== currentRequest) {
      console.log(
        'Skipping dynamic type resolution -- newer request in progress'
      )
      return
    }
    await updateDynamicTypes(data)
  },
  () => ++requestIdGen,
  5,
  500
)

const oldIsValidConnection = LiteGraph.isValidConnection.bind(LiteGraph)
// @ts-expect-error
LiteGraph.isValidConnection = function (type1: str, type2: str) {
  if (oldIsValidConnection(type1, type2)) {
    return true
  }
  // If the character '*' is in either type, use a regex to check against the other type
  if (type1.includes('*')) {
    const re = new RegExp('^' + type1.replace(/\*/g, '.*') + '$')
    if (re.test(type2)) {
      return true
    }
  }
  if (type2.includes('*')) {
    const re = new RegExp('^' + type2.replace(/\*/g, '.*') + '$')
    if (re.test(type1)) {
      return true
    }
  }
  return false
}

function updateNodeInput(
  node: LGraphNode,
  name: string,
  inputInfo: any | null
) {
  // TODO - Update to support non-forceInput inputs (i.e. things with widgets)
  const slot = node.findInputSlot(name)
  if (slot === -1 && inputInfo) {
    // Add a new input
    if (inputInfo[1]?.forceInput) {
      node.addInput(name, inputInfo[0])
    }
  } else if (slot !== -1 && !inputInfo) {
    // Remove an old input
    node.removeInput(slot)
  } else {
    // Update an existing input
    if (node.inputs[slot].type !== inputInfo[0]) {
      if (!inputInfo[1]?.forceInput) {
        throw new Error('Dynamic inputs must have forceInput set')
      }
      node.inputs[slot].type = inputInfo[0]
      // Update any links with the type
      if (node.inputs[slot].link) {
        let link = node.graph.links[node.inputs[slot].link]
        link.type = inputInfo[0]
      }
    }
  }
}

function updateNodeOutput(
  node: LGraphNode,
  index: number,
  type: string | null,
  name: string | null
) {
  if (index < node.outputs.length && type === null && name === null) {
    // Remove an old output
    node.removeOutput(index)
  } else if (index >= node.outputs.length) {
    // Add a new output
    node.addOutput(name, type)
  } else {
    // Update an existing output
    if (node.outputs[index].name !== name) {
      node.outputs[index].name = name
    }
    if (node.outputs[index].type !== type) {
      node.outputs[index].type = type
      if (node.outputs[index].links) {
        for (const linkId of node.outputs[index].links) {
          let link = node.graph.links[linkId]
          link.type = type
        }
      }
    }
  }
}

app.registerExtension({
  name: 'Comfy.DynamicTyping',
  async beforeRegisterNodeDef(nodeType, nodeData, _) {
    const oldOnConnectInput = nodeType?.prototype?.onConnectInput
    nodeType.prototype.onConnectInput = function (
      slotIndex: number,
      type: string,
      link: LLink
    ) {
      if (oldOnConnectInput) {
        if (!oldOnConnectInput.call(this, slotIndex, type, link)) {
          return false
        }
      }
      return true
    }
    const oldOnConnectionsChange = nodeType?.prototype?.onConnectionsChange
    nodeType.prototype.onConnectionsChange = function (
      type: number,
      slotIndex: number,
      isConnected: boolean,
      link: LLink,
      ioSlot: INodeOutputSlot | INodeInputSlot
    ) {
      if (oldOnConnectionsChange) {
        oldOnConnectionsChange.call(
          this,
          type,
          slotIndex,
          isConnected,
          link,
          ioSlot
        )
      }
      resolveDynamicTypes()
    }
    nodeType.prototype.UpdateDynamicNodeTypes = function (
      this: LGraphNode,
      dynamicNodeData: ComfyNodeDef
    ) {
      // @ts-expect-error
      if (!this.nodeData) {
        // @ts-expect-error
        this.nodeData = nodeData
      }
      const inputs = Object.assign(
        {},
        dynamicNodeData['input']['required'],
        dynamicNodeData['input']['optional'] ?? {}
      )
      const inputs_to_remove = []
      for (const { name } of this.inputs) {
        // Handle removed inputs
        if (!(name in inputs)) {
          // Avoid removing while iterating. (Does JavasScript handle that in a smart way?)
          inputs_to_remove.push(name)
          continue
        }
      }
      for (const name of inputs_to_remove) {
        updateNodeInput(this, name, null)
      }
      let inputOrder = {}
      for (const [inputName, inputInfo] of Object.entries(inputs)) {
        // Handle new inputs
        updateNodeInput(this, inputName, inputInfo)
        // Store off explicit sort order
        if (inputInfo[1]?.displayOrder) {
          inputOrder[inputName] = inputInfo[1].displayOrder
        }
      }
      this.inputs.sort((a, b) => {
        const aOrder = inputOrder[a.name] ?? 0
        const bOrder = inputOrder[b.name] ?? 0
        return aOrder - bOrder
      })

      // Delete any removed outputs
      for (
        let i = this.outputs.length - 1;
        i >= dynamicNodeData['output_name'].length;
        i--
      ) {
        updateNodeOutput(this, i, null, null)
      }
      // Handle any added or updated outputs
      for (let i = 0; i < dynamicNodeData['output'].length; i++) {
        const outputName = dynamicNodeData['output_name'][i]
        const rawType = dynamicNodeData['output'][i]
        const outputType = typeof rawType === 'string' ? rawType : 'COMBO'
        updateNodeOutput(this, i, outputType, outputName)
      }

      // @ts-expect-error
      this.nodeData = Object.assign({}, this.nodeData, dynamicNodeData)
      this.setDirtyCanvas(true, true)
    }
  }
})
