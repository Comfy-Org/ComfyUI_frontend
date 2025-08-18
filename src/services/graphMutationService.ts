import { Subgraph } from '@/lib/litegraph/src/LGraph'
import { GroupId, LGraphGroup } from '@/lib/litegraph/src/LGraphGroup'
import { LinkId } from '@/lib/litegraph/src/LLink'
import type { RerouteId } from '@/lib/litegraph/src/Reroute'
import {
  LGraphEventMode,
  LGraphNode,
  LiteGraph
} from '@/lib/litegraph/src/litegraph'
import {
  SubgraphId,
  SubgraphNode
} from '@/lib/litegraph/src/subgraph/SubgraphNode'
import { NodeId } from '@/schemas/comfyWorkflowSchema'
import { app } from '@/scripts/app'
import { useWorkflowStore } from '@/stores/workflowStore'

import {
  AddNodeInputParams,
  AddNodeOutputParams,
  AddNodeParams,
  AddRerouteParams,
  ClipboardData,
  ConnectParams,
  CreateGroupParams,
  CreateSubgraphParams,
  IGraphMutationService,
  ValidationError,
  ValidationResult
} from './IGraphMutationService'

export class ValidationException extends Error {
  constructor(public errors: ValidationError[]) {
    super(errors.map((e) => e.message).join(', '))
    this.name = 'ValidationException'
  }
}

export class GraphMutationService implements IGraphMutationService {
  private workflowStore = useWorkflowStore()

  private transactionDepth = 0

  private static readonly CLIPBOARD_KEY = 'litegrapheditor_clipboard'

  private getGraph() {
    return app.graph
  }

  private getChangeTracker() {
    return this.workflowStore.activeWorkflow?.changeTracker
  }

  private validateAddNode(params: AddNodeParams): ValidationResult {
    // TODO: Implement actual validation logic
    console.log(params)
    return { valid: true }
  }

  private validateRemoveNode(nodeId: NodeId): ValidationResult {
    // TODO: Implement actual validation logic
    console.log(nodeId)
    return { valid: true }
  }

  private validateConnect(params: ConnectParams): ValidationResult {
    // TODO: Implement actual validation logic
    console.log(params)
    return { valid: true }
  }

  private processValidation(validation: ValidationResult): void {
    if (!validation.valid && validation.errors) {
      throw new ValidationException(validation.errors)
    }

    if (validation.warnings?.length) {
      // TODO: Implement warning handling
      console.warn('Validation warnings:', validation.warnings)
    }
  }

  async addNode(params: AddNodeParams): Promise<NodeId> {
    const validation = this.validateAddNode(params)
    this.processValidation(validation)

    const { type, pos, properties, title } = params
    const graph = this.getGraph()

    const node = LiteGraph.createNode(type)

    if (!node) {
      throw new Error(`Failed to create node of type: ${type}`)
    }

    if (pos) {
      node.pos = pos
    }

    if (title) {
      node.title = title
    }

    if (properties) {
      Object.assign(node.properties || {}, properties)
    }

    graph.beforeChange()

    const addedNode = graph.add(node)
    if (!addedNode) {
      throw new Error('Failed to add node to graph')
    }

    graph.afterChange()
    this.getChangeTracker()?.checkState()

    return addedNode.id as NodeId
  }

  async removeNode(nodeId: NodeId): Promise<void> {
    const validation = this.validateRemoveNode(nodeId)
    this.processValidation(validation)

    const graph = this.getGraph()
    const node = graph.getNodeById(nodeId)

    if (!node) {
      throw new Error(`Node with id ${nodeId} not found`)
    }

    // Note: We don't need to call beforeChange/afterChange here because
    // graph.remove() already handles these internally (see LGraph.ts:927 and :982).
    // The remove method includes proper transaction boundaries and calls
    // beforeChange at the start and afterChange at the end of the operation.
    graph.remove(node)
    this.getChangeTracker()?.checkState()
  }

  async updateNodeProperty(
    nodeId: NodeId,
    property: string,
    value: any
  ): Promise<void> {
    const graph = this.getGraph()
    const node = graph.getNodeById(nodeId)

    if (!node) {
      throw new Error(`Node with id ${nodeId} not found`)
    }

    graph.beforeChange()
    node.setProperty(property, value)
    graph.afterChange()
    this.getChangeTracker()?.checkState()
  }

  async updateNodeTitle(nodeId: NodeId, title: string): Promise<void> {
    const graph = this.getGraph()
    const node = graph.getNodeById(nodeId)

    if (!node) {
      throw new Error(`Node with id ${nodeId} not found`)
    }

    graph.beforeChange()
    node.title = title
    graph.afterChange()
    this.getChangeTracker()?.checkState()
  }

  async changeNodeMode(nodeId: NodeId, mode: number): Promise<void> {
    const graph = this.getGraph()
    const node = graph.getNodeById(nodeId)

    if (!node) {
      throw new Error(`Node with id ${nodeId} not found`)
    }

    graph.beforeChange()
    const success = node.changeMode(mode)
    if (!success) {
      throw new Error(`Failed to change node mode to ${mode}`)
    }
    graph.afterChange()
    this.getChangeTracker()?.checkState()
  }

  async cloneNode(nodeId: NodeId, pos?: [number, number]): Promise<NodeId> {
    const graph = this.getGraph()
    const node = graph.getNodeById(nodeId)

    if (!node) {
      throw new Error(`Node with id ${nodeId} not found`)
    }

    graph.beforeChange()

    const clonedNode = node.clone()
    if (!clonedNode) {
      throw new Error('Failed to clone node')
    }

    if (pos) {
      clonedNode.pos = pos
    } else {
      clonedNode.pos = [node.pos[0] + 50, node.pos[1] + 50]
    }

    const addedNode = graph.add(clonedNode)
    if (!addedNode) {
      throw new Error('Failed to add cloned node to graph')
    }

    graph.afterChange()
    this.getChangeTracker()?.checkState()

    return addedNode.id as NodeId
  }

  async connect(params: ConnectParams): Promise<LinkId> {
    const validation = this.validateConnect(params)
    this.processValidation(validation)

    const { sourceNodeId, sourceSlot, targetNodeId, targetSlot } = params
    const graph = this.getGraph()

    const sourceNode = graph.getNodeById(sourceNodeId)
    const targetNode = graph.getNodeById(targetNodeId)

    if (!sourceNode) {
      throw new Error(`Source node with id ${sourceNodeId} not found`)
    }
    if (!targetNode) {
      throw new Error(`Target node with id ${targetNodeId} not found`)
    }

    // Note: We wrap the connect call with beforeChange/afterChange even though
    // node.connect() may call beforeChange internally in some cases (e.g., when
    // disconnecting EVENT type outputs). This ensures consistent transaction
    // boundaries for all connection operations. The nested beforeChange calls
    // are handled properly by the graph's transaction system.
    graph.beforeChange()

    const link = sourceNode.connect(
      sourceSlot,
      targetNode as LGraphNode,
      targetSlot
    )

    if (!link) {
      throw new Error('Failed to create connection')
    }

    graph.afterChange()
    this.getChangeTracker()?.checkState()

    return link.id as LinkId
  }

  async disconnect(
    nodeId: NodeId,
    slot: number | string,
    slotType: 'input' | 'output',
    targetNodeId?: NodeId
  ): Promise<boolean> {
    const graph = this.getGraph()
    const node = graph.getNodeById(nodeId)

    if (!node) {
      throw new Error(`Node with id ${nodeId} not found`)
    }

    graph.beforeChange()

    let result: boolean
    if (slotType === 'input') {
      result = node.disconnectInput(slot)
    } else {
      if (targetNodeId) {
        const targetNode = graph.getNodeById(targetNodeId)
        if (!targetNode) {
          throw new Error(`Target node with id ${targetNodeId} not found`)
        }
        result = node.disconnectOutput(slot, targetNode as LGraphNode)
      } else {
        result = node.disconnectOutput(slot)
      }
    }

    graph.afterChange()
    this.getChangeTracker()?.checkState()

    return result
  }

  async disconnectInput(
    nodeId: NodeId,
    slot: number | string
  ): Promise<boolean> {
    return this.disconnect(nodeId, slot, 'input')
  }

  async disconnectOutput(
    nodeId: NodeId,
    slot: number | string
  ): Promise<boolean> {
    return this.disconnect(nodeId, slot, 'output')
  }

  async disconnectOutputTo(
    nodeId: NodeId,
    slot: number | string,
    targetNodeId: NodeId
  ): Promise<boolean> {
    return this.disconnect(nodeId, slot, 'output', targetNodeId)
  }

  async disconnectLink(linkId: LinkId): Promise<void> {
    const graph = this.getGraph()

    graph.beforeChange()
    graph.removeLink(linkId)
    graph.afterChange()
    this.getChangeTracker()?.checkState()
  }

  async createGroup(params: CreateGroupParams): Promise<GroupId> {
    const { title, pos, size, color, fontSize } = params
    const graph = this.getGraph()

    const group = new LGraphGroup(title || 'Group')

    if (pos) {
      group.pos[0] = pos[0]
      group.pos[1] = pos[1]
    }

    if (size) {
      group.size[0] = size[0]
      group.size[1] = size[1]
    }

    if (color) {
      group.color = color
    }

    if (fontSize) {
      group.font_size = fontSize
    }

    graph.beforeChange()
    graph.add(group)
    graph.afterChange()
    this.getChangeTracker()?.checkState()

    return group.id as GroupId
  }

  async removeGroup(groupId: GroupId): Promise<void> {
    const graph = this.getGraph()
    const group = graph._groups.find((g) => g.id === groupId)

    if (!group) {
      throw new Error(`Group with id ${groupId} not found`)
    }

    graph.beforeChange()
    graph.remove(group)
    graph.afterChange()
    this.getChangeTracker()?.checkState()
  }

  async updateGroupTitle(groupId: GroupId, title: string): Promise<void> {
    const graph = this.getGraph()
    const group = graph._groups.find((g) => g.id === groupId)

    if (!group) {
      throw new Error(`Group with id ${groupId} not found`)
    }

    graph.beforeChange()
    group.title = title
    graph.afterChange()
    this.getChangeTracker()?.checkState()
    graph.setDirtyCanvas(true, false)
  }

  async moveGroup(
    groupId: GroupId,
    deltaX: number,
    deltaY: number
  ): Promise<void> {
    const graph = this.getGraph()
    const group = graph._groups.find((g) => g.id === groupId)

    if (!group) {
      throw new Error(`Group with id ${groupId} not found`)
    }

    graph.beforeChange()
    group.move(deltaX, deltaY, false)
    graph.afterChange()
    this.getChangeTracker()?.checkState()
    graph.setDirtyCanvas(true, false)
  }

  async addNodesToGroup(groupId: GroupId, nodeIds: NodeId[]): Promise<void> {
    const graph = this.getGraph()
    const group = graph._groups.find((g) => g.id === groupId)

    if (!group) {
      throw new Error(`Group with id ${groupId} not found`)
    }

    const nodes: LGraphNode[] = []
    for (const nodeId of nodeIds) {
      const node = graph.getNodeById(nodeId)
      if (!node) {
        throw new Error(`Node with id ${nodeId} not found`)
      }
      nodes.push(node)
    }

    graph.beforeChange()
    group.addNodes(nodes)
    group.recomputeInsideNodes()
    graph.afterChange()
    this.getChangeTracker()?.checkState()
    graph.setDirtyCanvas(true, false)
  }

  async recomputeGroupNodes(groupId: GroupId): Promise<void> {
    const graph = this.getGraph()
    const group = graph._groups.find((g) => g.id === groupId)

    if (!group) {
      throw new Error(`Group with id ${groupId} not found`)
    }

    graph.beforeChange()
    group.recomputeInsideNodes()
    graph.afterChange()
    this.getChangeTracker()?.checkState()
  }

  async addReroute(params: AddRerouteParams): Promise<RerouteId> {
    const { pos, linkId, parentRerouteId } = params
    const graph = this.getGraph()

    let beforeSegment: any = null

    if (linkId) {
      beforeSegment = graph._links.get(linkId)
      if (!beforeSegment) {
        throw new Error(`Link with id ${linkId} not found`)
      }
    } else if (parentRerouteId) {
      beforeSegment = graph.reroutes.get(parentRerouteId)
      if (!beforeSegment) {
        throw new Error(`Reroute with id ${parentRerouteId} not found`)
      }
    } else {
      throw new Error('Either linkId or parentRerouteId must be provided')
    }

    graph.beforeChange()
    const reroute = graph.createReroute(pos, beforeSegment)
    graph.afterChange()
    this.getChangeTracker()?.checkState()
    graph.setDirtyCanvas(true, false)

    return reroute.id as RerouteId
  }

  async removeReroute(rerouteId: RerouteId): Promise<void> {
    const graph = this.getGraph()

    if (!graph.reroutes.has(rerouteId)) {
      throw new Error(`Reroute with id ${rerouteId} not found`)
    }

    graph.beforeChange()
    graph.removeReroute(rerouteId)
    graph.afterChange()
    this.getChangeTracker()?.checkState()
    graph.setDirtyCanvas(true, false)
  }

  async addNodes(nodes: AddNodeParams[]): Promise<NodeId[]> {
    const graph = this.getGraph()
    const nodeIds: NodeId[] = []

    graph.beforeChange()

    try {
      for (const nodeParams of nodes) {
        const { type, pos, properties, title } = nodeParams

        const node = LiteGraph.createNode(type)
        if (!node) {
          throw new Error(`Failed to create node of type: ${type}`)
        }

        if (pos) node.pos = pos
        if (title) node.title = title
        if (properties) {
          Object.assign(node.properties || {}, properties)
        }

        const addedNode = graph.add(node)
        if (!addedNode) {
          throw new Error('Failed to add node to graph')
        }

        nodeIds.push(addedNode.id as NodeId)
      }

      graph.afterChange()
      this.getChangeTracker()?.checkState()

      return nodeIds
    } catch (error) {
      graph.afterChange()
      throw error
    }
  }

  async removeNodes(nodeIds: NodeId[]): Promise<void> {
    const graph = this.getGraph()

    const nodes = nodeIds.map((id) => {
      const node = graph.getNodeById(id)
      if (!node) {
        throw new Error(`Node with id ${id} not found`)
      }
      return node
    })

    // Note: We wrap all remove operations in a single beforeChange/afterChange
    // even though graph.remove() for nodes calls these internally. This ensures
    // the entire batch operation is treated as a single transaction for undo/redo.
    // The nested beforeChange/afterChange calls are handled properly by the graph.
    graph.beforeChange()

    for (const node of nodes) {
      graph.remove(node)
    }

    graph.afterChange()
    this.getChangeTracker()?.checkState()
  }

  async duplicateNodes(
    nodeIds: NodeId[],
    offset: [number, number] = [50, 50]
  ): Promise<NodeId[]> {
    const graph = this.getGraph()
    const newNodeIds: NodeId[] = []
    const nodeMap = new Map<NodeId, NodeId>() // Map old IDs to new IDs

    // Validate all nodes exist
    const nodes = nodeIds.map((id) => {
      const node = graph.getNodeById(id)
      if (!node) {
        throw new Error(`Node with id ${id} not found`)
      }
      return node
    })

    graph.beforeChange()

    try {
      for (const node of nodes) {
        const clonedNode = node.clone()
        if (!clonedNode) {
          throw new Error(`Failed to clone node ${node.id}`)
        }

        clonedNode.pos = [node.pos[0] + offset[0], node.pos[1] + offset[1]]

        const addedNode = graph.add(clonedNode)
        if (!addedNode) {
          throw new Error('Failed to add cloned node to graph')
        }

        const newNodeId = addedNode.id as NodeId
        newNodeIds.push(newNodeId)
        nodeMap.set(node.id as NodeId, newNodeId)
      }

      for (const node of nodes) {
        const sourceNewId = nodeMap.get(node.id as NodeId)
        if (!sourceNewId) continue

        const newSourceNode = graph.getNodeById(sourceNewId)
        if (!newSourceNode) continue

        if (node.outputs) {
          for (
            let outputIndex = 0;
            outputIndex < node.outputs.length;
            outputIndex++
          ) {
            const output = node.outputs[outputIndex]
            if (!output.links || output.links.length === 0) continue

            for (const linkId of output.links) {
              const link = graph._links.get(linkId)
              if (!link) continue

              const targetOldId = link.target_id as NodeId
              const targetNewId = nodeMap.get(targetOldId)

              if (targetNewId && nodeIds.includes(targetOldId)) {
                const newTargetNode = graph.getNodeById(targetNewId)
                if (newTargetNode) {
                  newSourceNode.connect(
                    outputIndex,
                    newTargetNode as LGraphNode,
                    link.target_slot
                  )
                }
              }
            }
          }
        }
      }

      graph.afterChange()
      this.getChangeTracker()?.checkState()

      return newNodeIds
    } catch (error) {
      graph.afterChange()
      throw error
    }
  }

  async copyNodes(nodeIds: NodeId[]): Promise<void> {
    if (!nodeIds.length) {
      throw new Error('No nodes to copy')
    }

    const graph = this.getGraph()
    const clipboardData: any = {
      nodes: [],
      links: []
    }

    for (const nodeId of nodeIds) {
      const node = graph.getNodeById(nodeId)
      if (!node) {
        throw new Error(`Node with id ${nodeId} not found`)
      }

      if (node.clonable === false) continue

      const cloned = node.clone()
      if (!cloned) {
        console.warn('Failed to clone node:', node.type)
        continue
      }

      const serialized = cloned.serialize()
      serialized.id = node.id
      clipboardData.nodes.push(serialized)
    }

    for (const nodeId of nodeIds) {
      const node = graph.getNodeById(nodeId)
      if (!node || !node.inputs) continue

      for (const input of node.inputs) {
        if (input.link == null) continue

        const link = graph._links.get(input.link)
        if (!link) continue

        if (nodeIds.includes(link.origin_id as NodeId)) {
          clipboardData.links.push({
            id: link.id,
            origin_id: link.origin_id,
            origin_slot: link.origin_slot,
            target_id: link.target_id,
            target_slot: link.target_slot,
            type: link.type
          })
        }
      }
    }

    localStorage.setItem(
      GraphMutationService.CLIPBOARD_KEY,
      JSON.stringify(clipboardData)
    )
  }

  async cutNodes(nodeIds: NodeId[]): Promise<void> {
    if (!nodeIds.length) {
      throw new Error('No nodes to cut')
    }

    await this.copyNodes(nodeIds)

    const data = localStorage.getItem(GraphMutationService.CLIPBOARD_KEY)
    if (data) {
      const clipboardData = JSON.parse(data)
      clipboardData.isCut = true
      clipboardData.originalIds = nodeIds
      localStorage.setItem(
        GraphMutationService.CLIPBOARD_KEY,
        JSON.stringify(clipboardData)
      )
    }
  }

  async pasteNodes(position?: [number, number]): Promise<NodeId[]> {
    const data = localStorage.getItem(GraphMutationService.CLIPBOARD_KEY)
    if (!data) {
      throw new Error('Clipboard is empty')
    }

    const clipboardData = JSON.parse(data)
    if (!clipboardData.nodes || clipboardData.nodes.length === 0) {
      throw new Error('Clipboard is empty')
    }

    const graph = this.getGraph()
    const newNodeIds: NodeId[] = []
    const nodeIdMap = new Map<NodeId, NodeId>()

    graph.beforeChange()

    try {
      let minX = Infinity
      let minY = Infinity
      for (const nodeData of clipboardData.nodes) {
        if (nodeData.pos) {
          minX = Math.min(minX, nodeData.pos[0])
          minY = Math.min(minY, nodeData.pos[1])
        }
      }

      if (!Number.isFinite(minX) || !Number.isFinite(minY)) {
        minX = 0
        minY = 0
      }

      const offsetX = position ? position[0] - minX : 50
      const offsetY = position ? position[1] - minY : 50

      for (const nodeData of clipboardData.nodes) {
        const node = LiteGraph.createNode(nodeData.type)
        if (!node) {
          console.warn(`Failed to create node of type: ${nodeData.type}`)
          continue
        }

        const oldId = nodeData.id
        node.configure(nodeData)

        if (nodeData.pos) {
          node.pos = [nodeData.pos[0] + offsetX, nodeData.pos[1] + offsetY]
        }

        const addedNode = graph.add(node)
        if (!addedNode) {
          console.warn('Failed to add node to graph')
          continue
        }

        const newNodeId = addedNode.id as NodeId
        newNodeIds.push(newNodeId)
        nodeIdMap.set(oldId, newNodeId)
      }

      if (clipboardData.links) {
        for (const linkData of clipboardData.links) {
          const sourceNewId = nodeIdMap.get(linkData.origin_id)
          const targetNewId = nodeIdMap.get(linkData.target_id)

          if (sourceNewId && targetNewId) {
            const sourceNode = graph.getNodeById(sourceNewId)
            const targetNode = graph.getNodeById(targetNewId)

            if (sourceNode && targetNode) {
              sourceNode.connect(
                linkData.origin_slot,
                targetNode as LGraphNode,
                linkData.target_slot
              )
            }
          }
        }
      }

      if (clipboardData.isCut && clipboardData.originalIds) {
        for (const nodeId of clipboardData.originalIds) {
          const node = graph.getNodeById(nodeId)
          if (node) {
            graph.remove(node)
          }
        }
        localStorage.removeItem(GraphMutationService.CLIPBOARD_KEY)
      }

      graph.afterChange()
      this.getChangeTracker()?.checkState()

      return newNodeIds
    } catch (error) {
      graph.afterChange()
      throw error
    }
  }

  getClipboard(): ClipboardData | null {
    const data = localStorage.getItem(GraphMutationService.CLIPBOARD_KEY)
    if (!data) return null

    try {
      const clipboardData = JSON.parse(data)
      return {
        nodes: clipboardData.nodes || [],
        connections: clipboardData.links || [],
        isCut: clipboardData.isCut || false
      }
    } catch {
      return null
    }
  }

  clearClipboard(): void {
    localStorage.removeItem(GraphMutationService.CLIPBOARD_KEY)
  }

  hasClipboardContent(): boolean {
    const data = localStorage.getItem(GraphMutationService.CLIPBOARD_KEY)
    if (!data) return false

    try {
      const clipboardData = JSON.parse(data)
      return clipboardData.nodes && clipboardData.nodes.length > 0
    } catch {
      return false
    }
  }

  async addSubgraphNodeInput(params: AddNodeInputParams): Promise<number> {
    const { nodeId, name, type, extra_info } = params
    const graph = this.getGraph()
    const node = graph.getNodeById(nodeId)

    if (!node) {
      throw new Error(`Node with id ${nodeId} not found`)
    }

    graph.beforeChange()
    node.addInput(name, type, extra_info)
    const slotIndex = node.inputs ? node.inputs.length - 1 : 0
    graph.afterChange()
    this.getChangeTracker()?.checkState()

    return slotIndex
  }

  async addSubgraphNodeOutput(params: AddNodeOutputParams): Promise<number> {
    const { nodeId, name, type, extra_info } = params
    const graph = this.getGraph()
    const node = graph.getNodeById(nodeId)

    if (!node) {
      throw new Error(`Node with id ${nodeId} not found`)
    }

    graph.beforeChange()
    node.addOutput(name, type, extra_info)
    const slotIndex = node.outputs ? node.outputs.length - 1 : 0
    graph.afterChange()
    this.getChangeTracker()?.checkState()

    return slotIndex
  }

  async removeSubgraphNodeInput(nodeId: NodeId, slot: number): Promise<void> {
    const graph = this.getGraph()
    const node = graph.getNodeById(nodeId)

    if (!node) {
      throw new Error(`Node with id ${nodeId} not found`)
    }

    if (!node.inputs || slot >= node.inputs.length) {
      throw new Error(`Input slot ${slot} not found on node`)
    }

    graph.beforeChange()
    node.removeInput(slot)
    graph.afterChange()
    this.getChangeTracker()?.checkState()
  }

  async removeSubgraphNodeOutput(nodeId: NodeId, slot: number): Promise<void> {
    const graph = this.getGraph()
    const node = graph.getNodeById(nodeId)

    if (!node) {
      throw new Error(`Node with id ${nodeId} not found`)
    }

    if (!node.outputs || slot >= node.outputs.length) {
      throw new Error(`Output slot ${slot} not found on node`)
    }

    graph.beforeChange()
    node.removeOutput(slot)
    graph.afterChange()
    this.getChangeTracker()?.checkState()
  }

  async createSubgraph(params: CreateSubgraphParams): Promise<{
    subgraph: any
    node: any
  }> {
    const { selectedItems } = params
    const graph = this.getGraph()

    if (!selectedItems || selectedItems.size === 0) {
      throw new Error('Cannot create subgraph: no items selected')
    }

    graph.beforeChange()
    try {
      const result = graph.convertToSubgraph(selectedItems)
      if (!result) {
        throw new Error('Failed to create subgraph')
      }
      graph.afterChange()
      this.getChangeTracker()?.checkState()
      return result
    } catch (error) {
      graph.afterChange()
      throw error
    }
  }

  async unpackSubgraph(subgraphNodeId: NodeId): Promise<void> {
    const graph = this.getGraph()
    const node = graph.getNodeById(subgraphNodeId)

    if (!node) {
      throw new Error(`Node with id ${subgraphNodeId} not found`)
    }

    if (!node.isSubgraphNode?.() && !(node as any).subgraph) {
      throw new Error('Node is not a subgraph node')
    }

    graph.beforeChange()
    try {
      graph.unpackSubgraph(node as any)
      graph.afterChange()
      this.getChangeTracker()?.checkState()
    } catch (error) {
      graph.afterChange()
      throw error
    }
  }

  private getSubgraph(subgraphId: SubgraphId): Subgraph | undefined {
    const graph = this.getGraph()

    for (const node of graph._nodes) {
      if (node instanceof SubgraphNode && node.subgraph.id === subgraphId) {
        return node.subgraph
      }
    }

    return undefined
  }

  async addSubgraphInput(
    subgraphId: SubgraphId,
    name: string,
    type: string
  ): Promise<void> {
    const subgraph = this.getSubgraph(subgraphId)
    if (!subgraph) {
      throw new Error(`Subgraph with id ${subgraphId} not found`)
    }

    const graph = this.getGraph()
    graph.beforeChange()
    subgraph.addInput(name, type)
    graph.afterChange()
    this.getChangeTracker()?.checkState()
  }

  async addSubgraphOutput(
    subgraphId: SubgraphId,
    name: string,
    type: string
  ): Promise<void> {
    const subgraph = this.getSubgraph(subgraphId)
    if (!subgraph) {
      throw new Error(`Subgraph with id ${subgraphId} not found`)
    }

    const graph = this.getGraph()
    graph.beforeChange()
    subgraph.addOutput(name, type)
    graph.afterChange()
    this.getChangeTracker()?.checkState()
  }

  async removeSubgraphInput(
    subgraphId: SubgraphId,
    index: number
  ): Promise<void> {
    const subgraph = this.getSubgraph(subgraphId)
    if (!subgraph) {
      throw new Error(`Subgraph with id ${subgraphId} not found`)
    }

    if (!subgraph.inputs[index]) {
      throw new Error(`Input at index ${index} not found in subgraph`)
    }

    const graph = this.getGraph()
    graph.beforeChange()
    subgraph.removeInput(subgraph.inputs[index])
    graph.afterChange()
    this.getChangeTracker()?.checkState()
  }

  async removeSubgraphOutput(
    subgraphId: SubgraphId,
    index: number
  ): Promise<void> {
    const subgraph = this.getSubgraph(subgraphId)
    if (!subgraph) {
      throw new Error(`Subgraph with id ${subgraphId} not found`)
    }

    if (!subgraph.outputs[index]) {
      throw new Error(`Output at index ${index} not found in subgraph`)
    }

    const graph = this.getGraph()
    graph.beforeChange()
    subgraph.removeOutput(subgraph.outputs[index])
    graph.afterChange()
    this.getChangeTracker()?.checkState()
  }

  async clearGraph(): Promise<void> {
    const graph = this.getGraph()

    graph.beforeChange()
    graph.clear()
    graph.afterChange()
    this.getChangeTracker()?.checkState()
  }

  async bypassNode(nodeId: NodeId): Promise<void> {
    const graph = this.getGraph()
    const node = graph.getNodeById(nodeId)

    if (!node) {
      throw new Error(`Node with id ${nodeId} not found`)
    }

    graph.beforeChange()
    node.mode = LGraphEventMode.BYPASS
    graph.afterChange()
    this.getChangeTracker()?.checkState()
    graph.setDirtyCanvas(true, false)
  }

  async unbypassNode(nodeId: NodeId): Promise<void> {
    const graph = this.getGraph()
    const node = graph.getNodeById(nodeId)

    if (!node) {
      throw new Error(`Node with id ${nodeId} not found`)
    }

    graph.beforeChange()
    node.mode = LGraphEventMode.ALWAYS
    graph.afterChange()
    this.getChangeTracker()?.checkState()
    graph.setDirtyCanvas(true, false)
  }

  async transaction<T>(fn: () => Promise<T>): Promise<T> {
    const graph = this.getGraph()

    this.transactionDepth++
    const isRootTransaction = this.transactionDepth === 1

    if (isRootTransaction) {
      graph.beforeChange()
    }

    try {
      const result = await fn()

      if (isRootTransaction) {
        graph.afterChange()
        this.getChangeTracker()?.checkState()
      }

      return result
    } catch (error) {
      if (isRootTransaction) {
        graph.afterChange()
      }
      throw error
    } finally {
      this.transactionDepth--
    }
  }

  async undo(): Promise<void> {
    const tracker = this.getChangeTracker()
    if (!tracker) {
      throw new Error('No active workflow or change tracker')
    }

    await tracker.undo()
  }

  async redo(): Promise<void> {
    const tracker = this.getChangeTracker()
    if (!tracker) {
      throw new Error('No active workflow or change tracker')
    }

    await tracker.redo()
  }
}

let graphMutationServiceInstance: GraphMutationService | null = null

export const useGraphMutationService = (): IGraphMutationService => {
  if (!graphMutationServiceInstance) {
    graphMutationServiceInstance = new GraphMutationService()
  }

  return graphMutationServiceInstance
}
