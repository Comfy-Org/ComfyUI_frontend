import { GraphMutationError } from '@/core/graph/operations/GraphMutationError'
import type { IGraphMutationService } from '@/core/graph/operations/IGraphMutationService'
import type {
  AddNodeInputParams,
  AddNodeOutputParams,
  AddNodesToGroupParams,
  AddRerouteParams,
  ChangeNodeModeParams,
  ConnectParams,
  CreateGroupParams,
  CreateNodeParams,
  CreateSubgraphParams,
  DisconnectParams,
  GraphMutationOperation,
  NodeInputSlotParams,
  Result,
  SubgraphIndexParams,
  SubgraphNameTypeParams,
  UpdateGroupTitleParams,
  UpdateNodePropertyParams,
  UpdateNodeTitleParams
} from '@/core/graph/operations/types'
import type { Subgraph } from '@/lib/litegraph/src/LGraph'
import type { GroupId } from '@/lib/litegraph/src/LGraphGroup'
import { LGraphGroup } from '@/lib/litegraph/src/LGraphGroup'
import type { LinkId } from '@/lib/litegraph/src/LLink'
import type { RerouteId } from '@/lib/litegraph/src/Reroute'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { LGraphEventMode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { SubgraphId } from '@/lib/litegraph/src/subgraph/SubgraphNode'
import { SubgraphNode } from '@/lib/litegraph/src/subgraph/SubgraphNode'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import type { NodeId } from '@/platform/workflow/validation/schemas/workflowSchema'
import { app } from '@/scripts/app'

export class GraphMutationService implements IGraphMutationService {
  private workflowStore = useWorkflowStore()

  private static readonly CLIPBOARD_KEY = 'litegrapheditor_clipboard'

  warnDirectAccess(context: string) {
    console.warn(
      `Direct LiteGraph access detected in ${context}. ` +
        `Consider using GraphMutationService for better compatibility. ` +
        `Direct access will be deprecated in a future version`
    )
  }

  private getGraph() {
    return app.graph
  }

  private getChangeTracker() {
    return this.workflowStore.activeWorkflow?.changeTracker
  }

  async applyOperation(
    operation: GraphMutationOperation
  ): Promise<Result<any, GraphMutationError>> {
    switch (operation.type) {
      case 'createNode':
        return await this.createNode(operation.params)
      case 'removeNode':
        return await this.removeNode(operation.params)
      case 'updateNodeProperty':
        return await this.updateNodeProperty(operation.params)
      case 'updateNodeTitle':
        return await this.updateNodeTitle(operation.params)
      case 'changeNodeMode':
        return await this.changeNodeMode(operation.params)
      case 'cloneNode':
        return await this.cloneNode(operation.params)
      case 'bypassNode':
        return await this.bypassNode(operation.params)
      case 'unbypassNode':
        return await this.unbypassNode(operation.params)
      case 'connect':
        return await this.connect(operation.params)
      case 'disconnect':
        return await this.disconnect(operation.params)
      case 'disconnectLink':
        return await this.disconnectLink(operation.params)
      case 'createGroup':
        return await this.createGroup(operation.params)
      case 'removeGroup':
        return await this.removeGroup(operation.params)
      case 'updateGroupTitle':
        return await this.updateGroupTitle(operation.params)
      case 'addNodesToGroup':
        return await this.addNodesToGroup(operation.params)
      case 'recomputeGroupNodes':
        return await this.recomputeGroupNodes(operation.params)
      case 'addReroute':
        return await this.addReroute(operation.params)
      case 'removeReroute':
        return await this.removeReroute(operation.params)
      case 'copyNodes':
        return await this.copyNodes(operation.nodeIds)
      case 'cutNodes':
        return await this.cutNodes(operation.params)
      case 'pasteNodes':
        return await this.pasteNodes()
      case 'createSubgraph':
        return await this.createSubgraph(operation.params)
      case 'unpackSubgraph':
        return await this.unpackSubgraph(operation.params)
      case 'addSubgraphNodeInput':
        return await this.addSubgraphNodeInput(operation.params)
      case 'addSubgraphNodeOutput':
        return await this.addSubgraphNodeOutput(operation.params)
      case 'removeSubgraphNodeInput':
        return await this.removeSubgraphNodeInput(operation.params)
      case 'removeSubgraphNodeOutput':
        return await this.removeSubgraphNodeOutput(operation.params)
      case 'addSubgraphInput':
        return await this.addSubgraphInput(operation.params)
      case 'addSubgraphOutput':
        return await this.addSubgraphOutput(operation.params)
      case 'removeSubgraphInput':
        return await this.removeSubgraphInput(operation.params)
      case 'removeSubgraphOutput':
        return await this.removeSubgraphOutput(operation.params)
      case 'clearGraph':
        return await this.clearGraph()
      case 'undo':
        return await this.undo()
      case 'redo':
        return await this.redo()
      default: {
        const unknownOp = operation as any
        console.warn('Unknown operation type:', unknownOp)
        return {
          success: false,
          error: new GraphMutationError('Unknown operation type', {
            operation: unknownOp.type,
            cause: new Error(
              `Operation type '${unknownOp.type}' is not implemented`
            )
          })
        }
      }
    }
  }

  async createNode(
    params: CreateNodeParams
  ): Promise<Result<NodeId, GraphMutationError>> {
    try {
      const { type, properties, title, id } = params
      const graph = this.getGraph()

      const node = LiteGraph.createNode(type)

      if (!node) {
        throw new Error(`Failed to create node of type: ${type}`)
      }

      // Set custom ID if provided (for loading workflows)
      if (id !== undefined) {
        node.id = id
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

      return { success: true, data: addedNode.id as NodeId }
    } catch (error) {
      return {
        success: false,
        error: new GraphMutationError('Failed to add node', {
          operation: 'addNode',
          params: params,
          cause: error
        })
      }
    }
  }

  getNodeById(nodeId: NodeId): LGraphNode {
    const graph = this.getGraph()
    const node = graph.getNodeById(nodeId)

    if (!node) {
      throw new Error(`Node with id ${nodeId} not found`)
    }

    return node
  }

  async removeNode(nodeId: NodeId): Promise<Result<void, GraphMutationError>> {
    try {
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

      return { success: true, data: undefined }
    } catch (error) {
      return {
        success: false,
        error: new GraphMutationError('Failed to remove node', {
          operation: 'removeNode',
          params: nodeId,
          cause: error
        })
      }
    }
  }

  async updateNodeProperty(
    params: UpdateNodePropertyParams
  ): Promise<Result<void, GraphMutationError>> {
    try {
      const graph = this.getGraph()
      const node = graph.getNodeById(params.nodeId)

      if (!node) {
        throw new Error(`Node with id ${params.nodeId} not found`)
      }

      graph.beforeChange()
      node.setProperty(params.property, params.value)
      graph.afterChange()

      return { success: true, data: undefined }
    } catch (error) {
      return {
        success: false,
        error: new GraphMutationError('Failed to update node property', {
          operation: 'updateNodeProperty',
          params: params,
          cause: error
        })
      }
    }
  }

  async updateNodeTitle(
    params: UpdateNodeTitleParams
  ): Promise<Result<void, GraphMutationError>> {
    try {
      const graph = this.getGraph()
      const node = graph.getNodeById(params.nodeId)

      if (!node) {
        throw new Error(`Node with id ${params.nodeId} not found`)
      }

      graph.beforeChange()
      node.title = params.title
      graph.afterChange()

      return { success: true, data: undefined }
    } catch (error) {
      return {
        success: false,
        error: new GraphMutationError('Failed to update node property', {
          operation: 'updateNodeTitle',
          params: params,
          cause: error
        })
      }
    }
  }

  async changeNodeMode(
    params: ChangeNodeModeParams
  ): Promise<Result<void, GraphMutationError>> {
    try {
      const graph = this.getGraph()
      const node = graph.getNodeById(params.nodeId)

      if (!node) {
        throw new Error(`Node with id ${params.nodeId} not found`)
      }

      graph.beforeChange()
      const success = node.changeMode(params.mode)
      if (!success) {
        throw new Error(`Failed to change node mode to ${params.mode}`)
      }
      graph.afterChange()
      return { success: true, data: undefined }
    } catch (error) {
      return {
        success: false,
        error: new GraphMutationError('Failed to update node property', {
          operation: 'changeNodeMode',
          params: params,
          cause: error
        })
      }
    }
  }

  async cloneNode(nodeId: NodeId): Promise<Result<NodeId, GraphMutationError>> {
    try {
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

      const addedNode = graph.add(clonedNode)
      if (!addedNode) {
        throw new Error('Failed to add cloned node to graph')
      }

      graph.afterChange()

      return { success: true, data: addedNode.id as NodeId }
    } catch (error) {
      return {
        success: false,
        error: new GraphMutationError('Failed to clone node', {
          operation: 'cloneNode',
          params: nodeId,
          cause: error
        })
      }
    }
  }

  async connect(
    params: ConnectParams
  ): Promise<Result<LinkId, GraphMutationError>> {
    try {
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

      return { success: true, data: link.id as LinkId }
    } catch (error) {
      return {
        success: false,
        error: new GraphMutationError('Failed to clone node', {
          operation: 'connect',
          params: params,
          cause: error
        })
      }
    }
  }

  async disconnect(
    params: DisconnectParams
  ): Promise<Result<boolean, GraphMutationError>> {
    try {
      const graph = this.getGraph()
      const node = graph.getNodeById(params.nodeId)

      if (!node) {
        throw new Error(`Node with id ${params.nodeId} not found`)
      }

      graph.beforeChange()

      let result: boolean
      if (params.slotType === 'input') {
        result = node.disconnectInput(params.slot)
      } else {
        if (params.targetNodeId) {
          const targetNode = graph.getNodeById(params.targetNodeId)
          if (!targetNode) {
            throw new Error(
              `Target node with id ${params.targetNodeId} not found`
            )
          }
          result = node.disconnectOutput(params.slot, targetNode as LGraphNode)
        } else {
          result = node.disconnectOutput(params.slot)
        }
      }

      graph.afterChange()

      return { success: true, data: result }
    } catch (error) {
      return {
        success: false,
        error: new GraphMutationError('Failed to clone node', {
          operation: 'disconnect',
          params: params,
          cause: error
        })
      }
    }
  }

  async disconnectLink(
    linkId: LinkId
  ): Promise<Result<void, GraphMutationError>> {
    try {
      const graph = this.getGraph()

      graph.beforeChange()
      graph.removeLink(linkId)
      graph.afterChange()
      return { success: true, data: undefined }
    } catch (error) {
      return {
        success: false,
        error: new GraphMutationError('Failed to disconnect link', {
          operation: 'disconnectLink',
          params: linkId,
          cause: error
        })
      }
    }
  }

  async createGroup(
    params: CreateGroupParams
  ): Promise<Result<GroupId, GraphMutationError>> {
    try {
      const graph = this.getGraph()

      const group = new LGraphGroup(params.title || 'Group')

      if (params.size) {
        group.size[0] = params.size[0]
        group.size[1] = params.size[1]
      }

      if (params.color) {
        group.color = params.color
      }

      if (params.fontSize) {
        group.font_size = params.fontSize
      }

      graph.beforeChange()
      graph.add(group)
      graph.afterChange()

      return { success: true, data: group.id as GroupId }
    } catch (error) {
      return {
        success: false,
        error: new GraphMutationError('Failed to create group', {
          operation: 'createGroup',
          params: params,
          cause: error
        })
      }
    }
  }

  async removeGroup(
    groupId: GroupId
  ): Promise<Result<void, GraphMutationError>> {
    try {
      const graph = this.getGraph()
      const group = graph._groups.find((g) => g.id === groupId)

      if (!group) {
        throw new Error(`Group with id ${groupId} not found`)
      }

      graph.beforeChange()
      graph.remove(group)
      graph.afterChange()
      return { success: true, data: undefined }
    } catch (error) {
      return {
        success: false,
        error: new GraphMutationError('Failed to remove group', {
          operation: 'removeGroup',
          params: groupId,
          cause: error
        })
      }
    }
  }

  async updateGroupTitle(
    params: UpdateGroupTitleParams
  ): Promise<Result<void, GraphMutationError>> {
    try {
      const graph = this.getGraph()
      const group = graph._groups.find((g) => g.id === params.groupId)

      if (!group) {
        throw new Error(`Group with id ${params.groupId} not found`)
      }

      graph.beforeChange()
      group.title = params.title
      graph.afterChange()
      graph.setDirtyCanvas(true, false)
      return { success: true, data: undefined }
    } catch (error) {
      return {
        success: false,
        error: new GraphMutationError('Failed to update group title', {
          operation: 'updateGroupTitle',
          params: params,
          cause: error
        })
      }
    }
  }

  async addNodesToGroup(
    params: AddNodesToGroupParams
  ): Promise<Result<void, GraphMutationError>> {
    try {
      const graph = this.getGraph()
      const group = graph._groups.find((g) => g.id === params.groupId)

      if (!group) {
        throw new Error(`Group with id ${params.groupId} not found`)
      }

      const nodes: LGraphNode[] = []
      for (const nodeId of params.nodeIds) {
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
      graph.setDirtyCanvas(true, false)

      return { success: true, data: undefined }
    } catch (error) {
      return {
        success: false,
        error: new GraphMutationError('Failed to add nodes to group', {
          operation: 'addNodesToGroup',
          params: params,
          cause: error
        })
      }
    }
  }

  async recomputeGroupNodes(
    groupId: GroupId
  ): Promise<Result<void, GraphMutationError>> {
    try {
      const graph = this.getGraph()
      const group = graph._groups.find((g) => g.id === groupId)

      if (!group) {
        throw new Error(`Group with id ${groupId} not found`)
      }

      graph.beforeChange()
      group.recomputeInsideNodes()
      graph.afterChange()

      return { success: true, data: undefined }
    } catch (error) {
      return {
        success: false,
        error: new GraphMutationError('Failed to recompute group nodes', {
          operation: 'recomputeGroupNodes',
          params: groupId,
          cause: error
        })
      }
    }
  }

  async addReroute(
    params: AddRerouteParams
  ): Promise<Result<RerouteId, GraphMutationError>> {
    try {
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
      graph.setDirtyCanvas(true, false)

      return { success: true, data: reroute.id as RerouteId }
    } catch (error) {
      return {
        success: false,
        error: new GraphMutationError('Failed to add reroute', {
          operation: 'addReroute',
          params: params,
          cause: error
        })
      }
    }
  }

  async removeReroute(
    rerouteId: RerouteId
  ): Promise<Result<void, GraphMutationError>> {
    try {
      const graph = this.getGraph()

      if (!graph.reroutes.has(rerouteId)) {
        throw new Error(`Reroute with id ${rerouteId} not found`)
      }

      graph.beforeChange()
      graph.removeReroute(rerouteId)
      graph.afterChange()
      graph.setDirtyCanvas(true, false)

      return { success: true, data: undefined }
    } catch (error) {
      return {
        success: false,
        error: new GraphMutationError('Failed to remove reroute', {
          operation: 'removeReroute',
          params: rerouteId,
          cause: error
        })
      }
    }
  }

  async copyNodes(
    nodeIds: NodeId[]
  ): Promise<Result<void, GraphMutationError>> {
    try {
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
      return { success: true, data: undefined }
    } catch (error) {
      return {
        success: false,
        error: new GraphMutationError('Failed to copy nodes', {
          operation: 'copyNodes',
          params: nodeIds,
          cause: error
        })
      }
    }
  }

  async cutNodes(nodeIds: NodeId[]): Promise<Result<void, GraphMutationError>> {
    try {
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
      return { success: true, data: undefined }
    } catch (error) {
      return {
        success: false,
        error: new GraphMutationError('Failed to cut nodes', {
          operation: 'cutNodes',
          params: nodeIds,
          cause: error
        })
      }
    }
  }

  async pasteNodes(): Promise<Result<NodeId[], GraphMutationError>> {
    try {
      // No params to validate for paste operation
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

      for (const nodeData of clipboardData.nodes) {
        const node = LiteGraph.createNode(nodeData.type)
        if (!node) {
          console.warn(`Failed to create node of type: ${nodeData.type}`)
          continue
        }

        const oldId = nodeData.id
        node.configure(nodeData)

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

      return { success: true, data: newNodeIds }
    } catch (error) {
      return {
        success: false,
        error: new GraphMutationError('Failed to paste nodes', {
          operation: 'pasteNodes',
          cause: error
        })
      }
    }
  }

  async addSubgraphNodeInput(
    params: AddNodeInputParams
  ): Promise<Result<number, GraphMutationError>> {
    try {
      const graph = this.getGraph()
      const node = graph.getNodeById(params.nodeId)

      if (!node) {
        throw new Error(`Node with id ${params.nodeId} not found`)
      }

      graph.beforeChange()
      node.addInput(params.name, params.type, params.extra_info)
      const slotIndex = node.inputs ? node.inputs.length - 1 : 0
      graph.afterChange()

      return { success: true, data: slotIndex }
    } catch (error) {
      return {
        success: false,
        error: new GraphMutationError('Failed to add subgraph node input', {
          operation: 'addSubgraphNodeInput',
          params: params,
          cause: error
        })
      }
    }
  }

  async addSubgraphNodeOutput(
    params: AddNodeOutputParams
  ): Promise<Result<number, GraphMutationError>> {
    try {
      const graph = this.getGraph()
      const node = graph.getNodeById(params.nodeId)

      if (!node) {
        throw new Error(`Node with id ${params.nodeId} not found`)
      }

      graph.beforeChange()
      node.addOutput(params.name, params.type, params.extra_info)
      const slotIndex = node.outputs ? node.outputs.length - 1 : 0
      graph.afterChange()

      return { success: true, data: slotIndex }
    } catch (error) {
      return {
        success: false,
        error: new GraphMutationError('Failed to add subgraph node output', {
          operation: 'addSubgraphNodeOutput',
          params: params,
          cause: error
        })
      }
    }
  }

  async removeSubgraphNodeInput(
    params: NodeInputSlotParams
  ): Promise<Result<void, GraphMutationError>> {
    try {
      const graph = this.getGraph()
      const node = graph.getNodeById(params.nodeId)

      if (!node) {
        throw new Error(`Node with id ${params.nodeId} not found`)
      }

      if (!node.inputs || params.slot >= node.inputs.length) {
        throw new Error(`Input slot ${params.slot} not found on node`)
      }

      graph.beforeChange()
      node.removeInput(params.slot)
      graph.afterChange()
      return { success: true, data: undefined }
    } catch (error) {
      return {
        success: false,
        error: new GraphMutationError('Failed to remove subgraph node input', {
          operation: 'removeSubgraphNodeInput',
          params: params,
          cause: error
        })
      }
    }
  }

  async removeSubgraphNodeOutput(
    params: NodeInputSlotParams
  ): Promise<Result<void, GraphMutationError>> {
    try {
      const graph = this.getGraph()
      const node = graph.getNodeById(params.nodeId)

      if (!node) {
        throw new Error(`Node with id ${params.nodeId} not found`)
      }

      if (!node.outputs || params.slot >= node.outputs.length) {
        throw new Error(`Output slot ${params.slot} not found on node`)
      }

      graph.beforeChange()
      node.removeOutput(params.slot)
      graph.afterChange()
      return { success: true, data: undefined }
    } catch (error) {
      return {
        success: false,
        error: new GraphMutationError('Failed to remove subgraph node output', {
          operation: 'removeSubgraphNodeOutput',
          params: params,
          cause: error
        })
      }
    }
  }

  async createSubgraph(params: CreateSubgraphParams): Promise<
    Result<
      {
        subgraph: any
        node: any
      },
      GraphMutationError
    >
  > {
    try {
      const graph = this.getGraph()

      if (!params.selectedItems || params.selectedItems.size === 0) {
        throw new Error('Cannot create subgraph: no items selected')
      }

      graph.beforeChange()
      const result = graph.convertToSubgraph(params.selectedItems)
      if (!result) {
        throw new Error('Failed to create subgraph')
      }
      graph.afterChange()
      return { success: true, data: result }
    } catch (error) {
      return {
        success: false,
        error: new GraphMutationError('Failed to create subgraph', {
          operation: 'createSubgraph',
          params: params,
          cause: error
        })
      }
    }
  }

  async unpackSubgraph(
    subgraphNodeId: NodeId
  ): Promise<Result<void, GraphMutationError>> {
    try {
      const graph = this.getGraph()
      const node = graph.getNodeById(subgraphNodeId)

      if (!node) {
        throw new Error(`Node with id ${subgraphNodeId} not found`)
      }

      if (!node.isSubgraphNode?.() && !(node as any).subgraph) {
        throw new Error('Node is not a subgraph node')
      }

      graph.beforeChange()
      graph.unpackSubgraph(node as any)
      graph.afterChange()
      return { success: true, data: undefined }
    } catch (error) {
      return {
        success: false,
        error: new GraphMutationError('Failed to unpack subgraph', {
          operation: 'unpackSubgraph',
          params: subgraphNodeId,
          cause: error
        })
      }
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
    params: SubgraphNameTypeParams
  ): Promise<Result<void, GraphMutationError>> {
    try {
      const subgraph = this.getSubgraph(params.subgraphId)
      if (!subgraph) {
        throw new Error(`Subgraph with id ${params.subgraphId} not found`)
      }

      const graph = this.getGraph()
      graph.beforeChange()
      subgraph.addInput(params.name, params.type)
      graph.afterChange()
      return { success: true, data: undefined }
    } catch (error) {
      return {
        success: false,
        error: new GraphMutationError('Failed to add subgraph input', {
          operation: 'addSubgraphInput',
          params: params,
          cause: error
        })
      }
    }
  }

  async addSubgraphOutput(
    params: SubgraphNameTypeParams
  ): Promise<Result<void, GraphMutationError>> {
    try {
      const subgraph = this.getSubgraph(params.subgraphId)
      if (!subgraph) {
        throw new Error(`Subgraph with id ${params.subgraphId} not found`)
      }

      const graph = this.getGraph()
      graph.beforeChange()
      subgraph.addOutput(params.name, params.type)
      graph.afterChange()
      return { success: true, data: undefined }
    } catch (error) {
      return {
        success: false,
        error: new GraphMutationError('Failed to add subgraph output', {
          operation: 'addSubgraphOutput',
          params: params,
          cause: error
        })
      }
    }
  }

  async removeSubgraphInput(
    params: SubgraphIndexParams
  ): Promise<Result<void, GraphMutationError>> {
    try {
      const subgraph = this.getSubgraph(params.subgraphId)
      if (!subgraph) {
        throw new Error(`Subgraph with id ${params.subgraphId} not found`)
      }

      if (!subgraph.inputs[params.index]) {
        throw new Error(`Input at index ${params.index} not found in subgraph`)
      }

      const graph = this.getGraph()
      graph.beforeChange()
      subgraph.removeInput(subgraph.inputs[params.index])
      graph.afterChange()
      return { success: true, data: undefined }
    } catch (error) {
      return {
        success: false,
        error: new GraphMutationError('Failed to remove subgraph input', {
          operation: 'removeSubgraphInput',
          params: params,
          cause: error
        })
      }
    }
  }

  async removeSubgraphOutput(
    params: SubgraphIndexParams
  ): Promise<Result<void, GraphMutationError>> {
    try {
      const subgraph = this.getSubgraph(params.subgraphId)
      if (!subgraph) {
        throw new Error(`Subgraph with id ${params.subgraphId} not found`)
      }

      if (!subgraph.outputs[params.index]) {
        throw new Error(`Output at index ${params.index} not found in subgraph`)
      }

      const graph = this.getGraph()
      graph.beforeChange()
      subgraph.removeOutput(subgraph.outputs[params.index])
      graph.afterChange()

      return { success: true, data: undefined }
    } catch (error) {
      return {
        success: false,
        error: new GraphMutationError('Failed to remove subgraph output', {
          operation: 'removeSubgraphOutput',
          params: params,
          cause: error
        })
      }
    }
  }

  async clearGraph(): Promise<Result<void, GraphMutationError>> {
    try {
      // No params to validate for clear operation
      const graph = this.getGraph()

      graph.beforeChange()
      graph.clear()
      graph.afterChange()
      return { success: true, data: undefined }
    } catch (error) {
      return {
        success: false,
        error: new GraphMutationError('Failed to clear graph', {
          operation: 'clearGraph',
          cause: error
        })
      }
    }
  }

  async bypassNode(nodeId: NodeId): Promise<Result<void, GraphMutationError>> {
    try {
      const graph = this.getGraph()
      const node = graph.getNodeById(nodeId)

      if (!node) {
        throw new Error(`Node with id ${nodeId} not found`)
      }

      graph.beforeChange()
      node.mode = LGraphEventMode.BYPASS
      graph.afterChange()
      graph.setDirtyCanvas(true, false)
      return { success: true, data: undefined }
    } catch (error) {
      return {
        success: false,
        error: new GraphMutationError('Failed to bypass node', {
          operation: 'bypassNode',
          params: nodeId,
          cause: error
        })
      }
    }
  }

  async unbypassNode(
    nodeId: NodeId
  ): Promise<Result<void, GraphMutationError>> {
    try {
      const graph = this.getGraph()
      const node = graph.getNodeById(nodeId)

      if (!node) {
        throw new Error(`Node with id ${nodeId} not found`)
      }

      graph.beforeChange()
      node.mode = LGraphEventMode.ALWAYS
      graph.afterChange()
      graph.setDirtyCanvas(true, false)
      return { success: true, data: undefined }
    } catch (error) {
      return {
        success: false,
        error: new GraphMutationError('Failed to unbypass node', {
          operation: 'unbypassNode',
          params: nodeId,
          cause: error
        })
      }
    }
  }

  async undo(): Promise<Result<void, GraphMutationError>> {
    try {
      // No params to validate for undo operation
      const tracker = this.getChangeTracker()
      if (!tracker) {
        throw new Error('No active workflow or change tracker')
      }

      await tracker.undo()
      return { success: true, data: undefined }
    } catch (error) {
      return {
        success: false,
        error: new GraphMutationError('Failed to undo', {
          operation: 'undo',
          cause: error
        })
      }
    }
  }

  async redo(): Promise<Result<void, GraphMutationError>> {
    try {
      // No params to validate for redo operation
      const tracker = this.getChangeTracker()
      if (!tracker) {
        throw new Error('No active workflow or change tracker')
      }

      await tracker.redo()
      return { success: true, data: undefined }
    } catch (error) {
      return {
        success: false,
        error: new GraphMutationError('Failed to redo', {
          operation: 'redo',
          cause: error
        })
      }
    }
  }
}

let graphMutationServiceInstance: GraphMutationService | null = null

export const useGraphMutationService = (): IGraphMutationService => {
  if (!graphMutationServiceInstance) {
    graphMutationServiceInstance = new GraphMutationService()
  }

  return graphMutationServiceInstance
}
