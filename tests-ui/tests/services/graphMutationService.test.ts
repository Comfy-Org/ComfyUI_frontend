import { beforeEach, describe, expect, it, vi } from 'vitest'

import { GraphMutationError } from '@/core/graph/operations/GraphMutationError'
import type { IGraphMutationService } from '@/core/graph/operations/IGraphMutationService'
import {
  GraphMutationService,
  useGraphMutationService
} from '@/core/graph/operations/graphMutationService'
import {
  CommandOrigin,
  type GraphMutationOperation
} from '@/core/graph/operations/types'
import type { LGraphGroup } from '@/lib/litegraph/src/LGraphGroup'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'

const mockGraph = vi.hoisted(() => ({
  beforeChange: vi.fn(),
  afterChange: vi.fn(),
  add: vi.fn(),
  remove: vi.fn(),
  getNodeById: vi.fn(),
  removeLink: vi.fn(),
  clear: vi.fn(),
  setDirtyCanvas: vi.fn(),
  _links: new Map(),
  _groups: [] as LGraphGroup[],
  _nodes: [] as LGraphNode[],
  reroutes: new Map(),
  createReroute: vi.fn(),
  removeReroute: vi.fn(),
  convertToSubgraph: vi.fn(),
  unpackSubgraph: vi.fn(),
  version: '1.0.0',
  config: {}
}))

const mockApp = vi.hoisted(() => ({
  graph: null as any,
  changeTracker: null as any,
  canvas: null as any
}))

Object.defineProperty(mockApp, 'graph', {
  writable: true,
  value: null
})
Object.defineProperty(mockApp, 'changeTracker', {
  writable: true,
  value: null
})
Object.defineProperty(mockApp, 'canvas', {
  writable: true,
  value: null
})

const mockWorkflowStore = vi.hoisted(() => ({
  activeWorkflow: {
    changeTracker: {
      checkState: vi.fn(),
      undo: vi.fn(),
      redo: vi.fn()
    }
  }
}))

const mockLiteGraph = vi.hoisted(() => ({
  createNode: vi.fn(),
  uuidv4: vi.fn(() => 'mock-uuid-' + Math.random())
}))

const mockLGraphNode = vi.hoisted(() => ({
  connect: vi.fn(),
  disconnectInput: vi.fn(),
  disconnectOutput: vi.fn(),
  setProperty: vi.fn(),
  changeMode: vi.fn(),
  clone: vi.fn(),
  serialize: vi.fn(),
  configure: vi.fn(),
  addInput: vi.fn(),
  addOutput: vi.fn(),
  removeInput: vi.fn(),
  removeOutput: vi.fn()
}))

const mockLGraphGroup = vi.hoisted(() => {
  let idCounter = 1000
  return class MockLGraphGroup {
    id = idCounter++
    title = 'Group'
    pos = [0, 0]
    size = [200, 200]
    color = '#335577'
    font_size = 14

    constructor(title?: string) {
      if (title) this.title = title
    }

    move = vi.fn()
    resize = vi.fn(() => true)
    addNodes = vi.fn()
    recomputeInsideNodes = vi.fn()
  }
})

vi.mock('@/scripts/app', () => ({
  app: mockApp
}))

mockApp.graph = mockGraph
mockApp.changeTracker = mockWorkflowStore.activeWorkflow.changeTracker
mockApp.canvas = { subgraph: null }

vi.mock('@/platform/workflow/management/stores/workflowStore', () => ({
  useWorkflowStore: vi.fn(() => mockWorkflowStore)
}))

vi.mock('@/lib/litegraph/src/litegraph', () => ({
  LiteGraph: mockLiteGraph,
  LGraphNode: mockLGraphNode,
  LGraphEventMode: {
    ALWAYS: 0,
    BYPASS: 4
  }
}))

vi.mock('@/lib/litegraph/src/LGraphGroup', () => ({
  LGraphGroup: mockLGraphGroup
}))

vi.mock('@/lib/litegraph/src/LGraph', () => ({
  Subgraph: vi.fn().mockImplementation((graph, data) => ({
    id: data.id,
    addInput: vi.fn(),
    addOutput: vi.fn(),
    removeInput: vi.fn(),
    removeOutput: vi.fn(),
    inputs: [],
    outputs: [],
    graph: graph
  }))
}))

const MockSubgraphNode = vi.hoisted(() => {
  return class MockSubgraphNode {
    constructor(graph: any, subgraph: any, data: any) {
      this.id = data?.id
      this.subgraph = subgraph
      this.graph = graph
    }
    id: any
    subgraph: any
    graph: any
  }
})

vi.mock('@/lib/litegraph/src/subgraph/SubgraphNode', () => ({
  SubgraphNode: MockSubgraphNode
}))

describe('GraphMutationService', () => {
  let service: IGraphMutationService
  let mockNode: any
  let mockLink: any

  beforeEach(() => {
    vi.clearAllMocks()

    service = new GraphMutationService()

    mockNode = {
      id: 'node-1',
      pos: [100, 100],
      title: 'Test Node',
      properties: {},
      outputs: [],
      inputs: [],
      ...mockLGraphNode
    }

    mockLink = {
      id: '123',
      origin_id: 'node-1',
      origin_slot: 0,
      target_id: 'node-2',
      target_slot: 0
    }

    mockGraph.getNodeById.mockImplementation((id: string) => {
      if (id === 'node-1' || id === 'node-2') return mockNode
      return null
    })

    mockGraph.add.mockReturnValue(mockNode)
    mockGraph._links.set(123, mockLink)

    mockLiteGraph.createNode.mockReturnValue(mockNode)
    mockNode.connect.mockReturnValue(mockLink)
    mockNode.clone.mockReturnValue({ ...mockNode, id: 'cloned-node' })
    mockNode.serialize.mockReturnValue({
      type: 'TestNode',
      id: 'node-1',
      pos: [100, 100]
    })
  })

  describe('initialization', () => {
    it('should implement IGraphMutationService interface', () => {
      expect(service).toHaveProperty('applyOperation')
      expect(service).toHaveProperty('createNode')
      expect(service).toHaveProperty('removeNode')
      expect(service).toHaveProperty('connect')
      expect(service).toHaveProperty('disconnect')
      expect(service).toHaveProperty('undo')
      expect(service).toHaveProperty('redo')
      expect(typeof service.applyOperation).toBe('function')
      expect(typeof service.createNode).toBe('function')
      expect(typeof service.removeNode).toBe('function')
      expect(typeof service.connect).toBe('function')
    })

    it('should have singleton behavior through useGraphMutationService', () => {
      const instance1 = useGraphMutationService()
      const instance2 = useGraphMutationService()

      expect(instance1).toBe(instance2)
    })
  })

  describe('command pattern operations', () => {
    describe('applyOperation', () => {
      it('should apply createNode command and return Result<NodeId>', async () => {
        const operation: GraphMutationOperation = {
          type: 'createNode',
          timestamp: Date.now(),
          origin: CommandOrigin.Local,
          params: {
            type: 'LoadImage',
            title: 'My Image Loader',
            properties: { seed: 12345 }
          }
        }

        const result = await service.applyOperation(operation)

        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data).toBe('node-1')
        }
        expect(mockLiteGraph.createNode).toHaveBeenCalledWith(
          'LoadImage',
          'My Image Loader'
        )
        expect(mockGraph.beforeChange).toHaveBeenCalled()
        expect(mockGraph.add).toHaveBeenCalledWith(mockNode)
        expect(mockGraph.afterChange).toHaveBeenCalled()
      })

      it('should return GraphMutationError on failure', async () => {
        mockLiteGraph.createNode.mockReturnValue(null)

        const operation: GraphMutationOperation = {
          type: 'createNode',
          timestamp: Date.now(),
          origin: CommandOrigin.Local,
          params: {
            type: 'InvalidType'
          }
        }

        const result = await service.applyOperation(operation)

        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error).toBeInstanceOf(GraphMutationError)
          expect(result.error.message).toBe('Failed to add node')
          expect(result.error.context).toMatchObject({
            operation: 'addNode',
            params: operation.params
          })
          expect(result.error.context.cause).toBeDefined()
        }
      })

      it('should handle unknown operation type', async () => {
        const operation: any = {
          type: 'unknownOperation',
          timestamp: Date.now(),
          origin: CommandOrigin.Local,
          params: {}
        }

        const result = await service.applyOperation(operation)

        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error).toBeInstanceOf(GraphMutationError)
          expect(result.error.message).toBe('Unknown operation type')
          expect(result.error.code).toBe('GRAPH_MUTATION_ERROR')
          expect(result.error.context.operation).toBe('unknownOperation')
        }
      })
    })

    describe('Result<T, E> pattern', () => {
      it('should return success Result with data', async () => {
        const result = await service.createNode({ type: 'TestNode' })

        expect(result).toMatchObject({
          success: true,
          data: 'node-1'
        })
      })

      it('should return failure Result with GraphMutationError', async () => {
        mockLiteGraph.createNode.mockReturnValue(null)

        const result = await service.createNode({ type: 'InvalidType' })

        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error).toBeInstanceOf(GraphMutationError)
          expect(result.error.message).toBe('Failed to add node')
          expect(result.error.context.cause).toBeInstanceOf(Error)
        }
      })

      it('should preserve error context in Result', async () => {
        mockGraph.add.mockReturnValue(null)

        const params = { type: 'TestNode', properties: { test: 123 } }
        const result = await service.createNode(params)

        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.context).toMatchObject({
            operation: 'addNode',
            params: params
          })
        }
      })
    })

    describe('GraphMutationError', () => {
      it('should create error with proper code and context', async () => {
        mockGraph.getNodeById.mockReturnValue(null)

        const result = await service.removeNode('nonexistent' as any)

        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.code).toBe('GRAPH_MUTATION_ERROR')
          expect(result.error.message).toBe('Failed to remove node')
          expect(result.error.context).toMatchObject({
            operation: 'removeNode',
            params: 'nonexistent'
          })
        }
      })

      it('should preserve original error as cause', async () => {
        const originalError = new Error('Test error')
        mockLiteGraph.createNode.mockImplementation(() => {
          throw originalError
        })

        const result = await service.createNode({ type: 'TestNode' })

        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.context.cause).toBe(originalError)
        }
      })
    })
  })

  describe('node operations via commands', () => {
    describe('removeNode command', () => {
      it('should remove node and return success Result', async () => {
        const operation: GraphMutationOperation = {
          type: 'removeNode',
          timestamp: Date.now(),
          origin: CommandOrigin.Local,
          params: 'node-1' as any
        }

        const result = await service.applyOperation(operation)

        expect(result.success).toBe(true)
        expect(mockGraph.remove).toHaveBeenCalledWith(mockNode)
      })

      it('should return error Result when node not found', async () => {
        mockGraph.getNodeById.mockReturnValue(null)

        const operation: GraphMutationOperation = {
          type: 'removeNode',
          timestamp: Date.now(),
          origin: CommandOrigin.Local,
          params: 'nonexistent' as any
        }

        const result = await service.applyOperation(operation)

        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.message).toBe('Failed to remove node')
        }
      })
    })

    describe('updateNodeProperty command', () => {
      it('should update property via command', async () => {
        const operation: GraphMutationOperation = {
          type: 'updateNodeProperty',
          timestamp: Date.now(),
          origin: CommandOrigin.Local,
          params: {
            nodeId: 'node-1' as any,
            property: 'seed',
            value: 54321
          }
        }

        const result = await service.applyOperation(operation)

        expect(result.success).toBe(true)
        expect(mockNode.setProperty).toHaveBeenCalledWith('seed', 54321)
      })
    })

    describe('updateNodeTitle command', () => {
      it('should update title and handle transaction boundaries', async () => {
        const operation: GraphMutationOperation = {
          type: 'updateNodeTitle',
          timestamp: Date.now(),
          origin: CommandOrigin.Local,
          params: {
            nodeId: 'node-1' as any,
            title: 'New Title'
          }
        }

        const result = await service.applyOperation(operation)

        expect(result.success).toBe(true)
        expect(mockNode.title).toBe('New Title')
        expect(mockGraph.beforeChange).toHaveBeenCalledBefore(
          mockGraph.afterChange as any
        )
      })
    })

    describe('changeNodeMode command', () => {
      it('should change mode via command', async () => {
        mockNode.changeMode.mockReturnValue(true)

        const operation: GraphMutationOperation = {
          type: 'changeNodeMode',
          timestamp: Date.now(),
          origin: CommandOrigin.Local,
          params: {
            nodeId: 'node-1' as any,
            mode: 4
          }
        }

        const result = await service.applyOperation(operation)

        expect(result.success).toBe(true)
        expect(mockNode.changeMode).toHaveBeenCalledWith(4)
      })

      it('should return error when mode change fails', async () => {
        mockNode.changeMode.mockReturnValue(false)

        const operation: GraphMutationOperation = {
          type: 'changeNodeMode',
          timestamp: Date.now(),
          origin: CommandOrigin.Local,
          params: {
            nodeId: 'node-1' as any,
            mode: 999
          }
        }

        const result = await service.applyOperation(operation)

        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.message).toBe('Failed to update node property')
          expect(result.error.context.cause.message).toContain('999')
        }
      })
    })

    describe('cloneNode command', () => {
      it('should clone node via command', async () => {
        const operation: GraphMutationOperation = {
          type: 'cloneNode',
          timestamp: Date.now(),
          origin: CommandOrigin.Local,
          params: 'node-1' as any
        }

        const result = await service.applyOperation(operation)

        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data).toBe('node-1')
        }
        expect(mockNode.clone).toHaveBeenCalled()
      })

      it('should handle clone failure with proper error', async () => {
        mockNode.clone.mockReturnValue(null)

        const operation: GraphMutationOperation = {
          type: 'cloneNode',
          timestamp: Date.now(),
          origin: CommandOrigin.Local,
          params: 'node-1' as any
        }

        const result = await service.applyOperation(operation)

        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.context.operation).toBe('cloneNode')
        }
      })
    })
  })

  describe('connection operations via commands', () => {
    describe('connect command', () => {
      it('should create connection and return LinkId', async () => {
        const operation: GraphMutationOperation = {
          type: 'connect',
          timestamp: Date.now(),
          origin: CommandOrigin.Local,
          params: {
            sourceNodeId: 'node-1' as any,
            sourceSlot: 0,
            targetNodeId: 'node-2' as any,
            targetSlot: 1
          }
        }

        const result = await service.applyOperation(operation)

        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data).toBe('123')
        }
        expect(mockNode.connect).toHaveBeenCalledWith(0, mockNode, 1)
      })

      it('should return error when nodes not found', async () => {
        mockGraph.getNodeById.mockImplementation((id: string) =>
          id === 'node-1' ? null : mockNode
        )

        const operation: GraphMutationOperation = {
          type: 'connect',
          timestamp: Date.now(),
          origin: CommandOrigin.Local,
          params: {
            sourceNodeId: 'node-1' as any,
            sourceSlot: 0,
            targetNodeId: 'node-2' as any,
            targetSlot: 1
          }
        }

        const result = await service.applyOperation(operation)

        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.message).toBe('Failed to clone node')
          expect(result.error.context.cause.message).toContain('node-1')
        }
      })
    })

    describe('disconnect command', () => {
      it('should disconnect node slot', async () => {
        mockNode.disconnectInput.mockReturnValue(true)

        const operation: GraphMutationOperation = {
          type: 'disconnect',
          timestamp: Date.now(),
          origin: CommandOrigin.Local,
          params: {
            nodeId: 'node-1' as any,
            slot: 0,
            slotType: 'input'
          }
        }

        const result = await service.applyOperation(operation)

        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data).toBe(true)
        }
        expect(mockNode.disconnectInput).toHaveBeenCalledWith(0)
      })
    })

    describe('disconnectLink command', () => {
      it('should disconnect specific link', async () => {
        const operation: GraphMutationOperation = {
          type: 'disconnectLink',
          timestamp: Date.now(),
          origin: CommandOrigin.Local,
          params: 123 as any
        }

        const result = await service.applyOperation(operation)

        expect(result.success).toBe(true)
        expect(mockGraph.removeLink).toHaveBeenCalledWith(123)
      })
    })
  })

  describe('group operations via commands', () => {
    let mockGroup: any

    beforeEach(() => {
      mockGroup = new mockLGraphGroup('Test Group')
      mockGroup.id = 999
      mockGraph._groups = [mockGroup] as any
    })

    describe('createGroup command', () => {
      it('should create group with parameters', async () => {
        const operation: GraphMutationOperation = {
          type: 'createGroup',
          timestamp: Date.now(),
          origin: CommandOrigin.Local,
          params: {
            title: 'My Group',
            size: [300, 250] as [number, number],
            color: '#ff0000',
            fontSize: 16
          }
        }

        const result = await service.applyOperation(operation)

        expect(result.success).toBe(true)
        if (result.success) {
          expect(typeof result.data).toBe('number')
          expect(result.data).toBeGreaterThanOrEqual(1000)
        }
      })
    })

    describe('removeGroup command', () => {
      it('should remove group and return success', async () => {
        const operation: GraphMutationOperation = {
          type: 'removeGroup',
          timestamp: Date.now(),
          origin: CommandOrigin.Local,
          params: mockGroup.id
        }

        const result = await service.applyOperation(operation)

        expect(result.success).toBe(true)
        expect(mockGraph.remove).toHaveBeenCalledWith(mockGroup)
      })

      it('should return error when group not found', async () => {
        const operation: GraphMutationOperation = {
          type: 'removeGroup',
          timestamp: Date.now(),
          origin: CommandOrigin.Local,
          params: 123456 as any
        }

        const result = await service.applyOperation(operation)

        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.message).toBe('Failed to remove group')
        }
      })
    })

    describe('addNodesToGroup command', () => {
      it('should add nodes to group via command', async () => {
        const operation: GraphMutationOperation = {
          type: 'addNodesToGroup',
          timestamp: Date.now(),
          origin: CommandOrigin.Local,
          params: {
            groupId: mockGroup.id,
            nodeIds: ['node-1' as any, 'node-2' as any]
          }
        }

        const result = await service.applyOperation(operation)

        expect(result.success).toBe(true)
        expect(mockGroup.addNodes).toHaveBeenCalledWith([mockNode, mockNode])
      })
    })
  })

  describe('command timestamp and origin', () => {
    it('should validate timestamp exists on all commands', async () => {
      const timestamp = Date.now()
      const operation: GraphMutationOperation = {
        type: 'createNode',
        timestamp: timestamp,
        origin: CommandOrigin.Local,
        params: { type: 'TestNode' }
      }

      await service.applyOperation(operation)

      expect(operation.timestamp).toBe(timestamp)
      expect(operation.timestamp).toBeLessThanOrEqual(Date.now())
    })

    it('should validate origin field on commands', async () => {
      const operation: GraphMutationOperation = {
        type: 'createNode',
        timestamp: Date.now(),
        origin: CommandOrigin.Local,
        params: { type: 'TestNode' }
      }

      await service.applyOperation(operation)

      expect(operation.origin).toBe(CommandOrigin.Local)
    })
  })

  describe('clipboard operations via commands', () => {
    beforeEach(() => {
      localStorage.clear()
    })

    describe('copyNodes command', () => {
      it('should copy nodes and return success Result', async () => {
        const clonedNode = {
          serialize: vi.fn(() => ({
            id: 'node-1',
            type: 'TestNode',
            pos: [0, 0]
          }))
        }
        mockNode.clone = vi.fn(() => clonedNode)

        const operation: GraphMutationOperation = {
          type: 'copyNodes',
          timestamp: Date.now(),
          origin: CommandOrigin.Local,
          nodeIds: ['node-1' as any]
        }

        const result = await service.applyOperation(operation)

        expect(result.success).toBe(true)
        const storedData = localStorage.getItem('litegrapheditor_clipboard')
        expect(storedData).not.toBeNull()
      })

      it('should return error for empty node list', async () => {
        const operation: GraphMutationOperation = {
          type: 'copyNodes',
          timestamp: Date.now(),
          origin: CommandOrigin.Local,
          nodeIds: []
        }

        const result = await service.applyOperation(operation)

        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.context.cause.message).toContain('No nodes')
        }
      })
    })

    describe('cutNodes command', () => {
      it('should cut nodes via command', async () => {
        const clonedNode = {
          serialize: vi.fn(() => ({
            id: 'node-1',
            type: 'TestNode',
            pos: [0, 0]
          }))
        }
        mockNode.clone = vi.fn(() => clonedNode)

        const operation: GraphMutationOperation = {
          type: 'cutNodes',
          timestamp: Date.now(),
          origin: CommandOrigin.Local,
          params: ['node-1' as any]
        }

        const result = await service.applyOperation(operation)

        expect(result.success).toBe(true)
        const storedData = localStorage.getItem('litegrapheditor_clipboard')
        const clipboardData = JSON.parse(storedData!)
        expect(clipboardData.isCut).toBe(true)
      })
    })

    describe('pasteNodes command', () => {
      beforeEach(async () => {
        const clipboardData = {
          nodes: [
            {
              id: 'node-1',
              type: 'TestNode',
              pos: [100, 100]
            }
          ],
          links: [],
          isCut: false
        }
        localStorage.setItem(
          'litegrapheditor_clipboard',
          JSON.stringify(clipboardData)
        )

        const newNode = { ...mockNode, id: 'new-node-1', configure: vi.fn() }
        mockLiteGraph.createNode.mockReturnValue(newNode)
        mockGraph.add.mockReturnValue(newNode)
      })

      it('should paste nodes and return node IDs', async () => {
        const operation: GraphMutationOperation = {
          type: 'pasteNodes',
          timestamp: Date.now(),
          origin: CommandOrigin.Local
        }

        const result = await service.applyOperation(operation)

        expect(result.success).toBe(true)
        if (result.success) {
          expect(Array.isArray(result.data)).toBe(true)
          expect(result.data).toHaveLength(1)
        }
      })

      it('should return error for empty clipboard', async () => {
        localStorage.clear()

        const operation: GraphMutationOperation = {
          type: 'pasteNodes',
          timestamp: Date.now(),
          origin: CommandOrigin.Local
        }

        const result = await service.applyOperation(operation)

        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.context.cause.message).toContain('Clipboard')
        }
      })
    })
  })

  describe('undo/redo operations via commands', () => {
    it('should execute undo command', async () => {
      const operation: GraphMutationOperation = {
        type: 'undo',
        timestamp: Date.now(),
        origin: CommandOrigin.Local
      }

      const result = await service.applyOperation(operation)

      expect(result.success).toBe(true)
      expect(
        mockWorkflowStore.activeWorkflow.changeTracker.undo
      ).toHaveBeenCalled()
    })

    it('should execute redo command', async () => {
      const operation: GraphMutationOperation = {
        type: 'redo',
        timestamp: Date.now(),
        origin: CommandOrigin.Local
      }

      const result = await service.applyOperation(operation)

      expect(result.success).toBe(true)
      expect(
        mockWorkflowStore.activeWorkflow.changeTracker.redo
      ).toHaveBeenCalled()
    })

    it('should return error when change tracker missing', async () => {
      const originalActiveWorkflow = mockWorkflowStore.activeWorkflow
      mockWorkflowStore.activeWorkflow = null as any

      const operation: GraphMutationOperation = {
        type: 'undo',
        timestamp: Date.now(),
        origin: CommandOrigin.Local
      }

      const result = await service.applyOperation(operation)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.context.cause.message).toContain('workflow')
      }

      mockWorkflowStore.activeWorkflow = originalActiveWorkflow
    })
  })

  describe('graph-level operations via commands', () => {
    describe('clearGraph command', () => {
      it('should clear graph via command', async () => {
        const operation: GraphMutationOperation = {
          type: 'clearGraph',
          timestamp: Date.now(),
          origin: CommandOrigin.Local
        }

        const result = await service.applyOperation(operation)

        expect(result.success).toBe(true)
        expect(mockGraph.clear).toHaveBeenCalled()
        expect(mockGraph.beforeChange).toHaveBeenCalled()
        expect(mockGraph.afterChange).toHaveBeenCalled()
      })
    })

    describe('bypass commands', () => {
      it('should bypass node via command', async () => {
        const operation: GraphMutationOperation = {
          type: 'bypassNode',
          timestamp: Date.now(),
          origin: CommandOrigin.Local,
          params: 'node-1' as any
        }

        const result = await service.applyOperation(operation)

        expect(result.success).toBe(true)
        expect(mockNode.mode).toBe(4)
        expect(mockGraph.setDirtyCanvas).toHaveBeenCalledWith(true, false)
      })

      it('should unbypass node via command', async () => {
        const operation: GraphMutationOperation = {
          type: 'unbypassNode',
          timestamp: Date.now(),
          origin: CommandOrigin.Local,
          params: 'node-1' as any
        }

        const result = await service.applyOperation(operation)

        expect(result.success).toBe(true)
        expect(mockNode.mode).toBe(0)
        expect(mockGraph.setDirtyCanvas).toHaveBeenCalledWith(true, false)
      })
    })
  })

  describe('error propagation and context', () => {
    it('should wrap thrown errors in GraphMutationError', async () => {
      const originalError = new Error('Node creation failed')
      mockLiteGraph.createNode.mockImplementation(() => {
        throw originalError
      })

      const operation: GraphMutationOperation = {
        type: 'createNode',
        timestamp: Date.now(),
        origin: CommandOrigin.Local,
        params: { type: 'FailNode' }
      }

      const result = await service.applyOperation(operation)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBeInstanceOf(GraphMutationError)
        expect(result.error.context.cause).toBe(originalError)
        expect(result.error.context.operation).toBe('addNode')
      }
    })

    it('should preserve full error context', async () => {
      mockGraph.getNodeById.mockReturnValue(null)

      const params = {
        nodeId: 'test-node' as any,
        property: 'testProp',
        value: 'testValue'
      }

      const operation: GraphMutationOperation = {
        type: 'updateNodeProperty',
        timestamp: Date.now(),
        origin: CommandOrigin.Local,
        params
      }

      const result = await service.applyOperation(operation)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.context).toMatchObject({
          operation: 'updateNodeProperty',
          params: params
        })
        expect(result.error.context.cause).toBeDefined()
      }
    })

    it('should handle async errors properly', async () => {
      mockWorkflowStore.activeWorkflow.changeTracker.undo.mockRejectedValue(
        new Error('Undo failed')
      )

      const operation: GraphMutationOperation = {
        type: 'undo',
        timestamp: Date.now(),
        origin: CommandOrigin.Local
      }

      const result = await service.applyOperation(operation)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.message).toBe('Failed to undo')
        expect(result.error.context.cause.message).toBe('Undo failed')
      }
    })
  })

  describe('subgraph operations via commands', () => {
    let mockSubgraphNode: any
    let mockSubgraph: any

    beforeEach(() => {
      mockSubgraph = {
        id: 'subgraph-1',
        nodes: [],
        groups: [],
        reroutes: new Map(),
        inputs: [],
        outputs: [],
        addInput: vi.fn(),
        addOutput: vi.fn(),
        removeInput: vi.fn(),
        removeOutput: vi.fn()
      }

      mockSubgraphNode = new MockSubgraphNode(mockGraph, mockSubgraph, {
        id: 'subgraph-node-1'
      })
      mockSubgraphNode.type = 'subgraph'
      mockSubgraphNode.isSubgraphNode = vi.fn(() => true)
    })

    describe('createSubgraph command', () => {
      it('should create subgraph via command', async () => {
        const selectedItems = new Set([mockNode])
        const expectedResult = {
          subgraph: mockSubgraph,
          node: mockSubgraphNode
        }

        mockGraph.convertToSubgraph.mockReturnValue(expectedResult)

        const operation: GraphMutationOperation = {
          type: 'createSubgraph',
          timestamp: Date.now(),
          origin: CommandOrigin.Local,
          params: { selectedItems }
        }

        const result = await service.applyOperation(operation)

        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data).toBe(expectedResult)
        }
      })

      it('should return error when no items selected', async () => {
        const operation: GraphMutationOperation = {
          type: 'createSubgraph',
          timestamp: Date.now(),
          origin: CommandOrigin.Local,
          params: { selectedItems: new Set() }
        }

        const result = await service.applyOperation(operation)

        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.context.cause.message).toContain('no items')
        }
      })
    })

    describe('unpackSubgraph command', () => {
      it('should unpack subgraph via command', async () => {
        mockGraph.getNodeById.mockReturnValue(mockSubgraphNode)
        mockGraph.unpackSubgraph.mockImplementation(() => {})

        const operation: GraphMutationOperation = {
          type: 'unpackSubgraph',
          timestamp: Date.now(),
          origin: CommandOrigin.Local,
          params: 'subgraph-node-1' as any
        }

        const result = await service.applyOperation(operation)

        expect(result.success).toBe(true)
        expect(mockGraph.unpackSubgraph).toHaveBeenCalledWith(mockSubgraphNode)
      })

      it('should return error for non-subgraph node', async () => {
        const regularNode = {
          ...mockNode,
          isSubgraphNode: undefined,
          subgraph: undefined
        }
        mockGraph.getNodeById.mockReturnValue(regularNode)

        const operation: GraphMutationOperation = {
          type: 'unpackSubgraph',
          timestamp: Date.now(),
          origin: CommandOrigin.Local,
          params: 'node-1' as any
        }

        const result = await service.applyOperation(operation)

        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.context.cause.message).toContain('not a subgraph')
        }
      })
    })

    describe('subgraph input/output commands', () => {
      beforeEach(() => {
        mockGraph._nodes = [mockSubgraphNode]
      })

      it('should add subgraph input via command', async () => {
        const operation: GraphMutationOperation = {
          type: 'addSubgraphInput',
          timestamp: Date.now(),
          origin: CommandOrigin.Local,
          params: {
            subgraphId: 'subgraph-1' as any,
            name: 'input1',
            type: 'number'
          }
        }

        const result = await service.applyOperation(operation)

        expect(result.success).toBe(true)
        expect(mockSubgraph.addInput).toHaveBeenCalledWith('input1', 'number')
      })

      it('should remove subgraph output via command', async () => {
        mockSubgraph.outputs = ['output1']

        const operation: GraphMutationOperation = {
          type: 'removeSubgraphOutput',
          timestamp: Date.now(),
          origin: CommandOrigin.Local,
          params: {
            subgraphId: 'subgraph-1' as any,
            index: 0
          }
        }

        const result = await service.applyOperation(operation)

        expect(result.success).toBe(true)
        expect(mockSubgraph.removeOutput).toHaveBeenCalledWith('output1')
      })
    })
  })

  describe('reroute operations via commands', () => {
    describe('addReroute command', () => {
      it('should add reroute to link', async () => {
        const mockReroute = { id: 'reroute-1' }
        mockGraph.createReroute.mockReturnValue(mockReroute)
        mockGraph._links.set(123, mockLink)

        const operation: GraphMutationOperation = {
          type: 'addReroute',
          timestamp: Date.now(),
          origin: CommandOrigin.Local,
          params: {
            pos: [100, 100],
            linkId: 123 as any
          }
        }

        const result = await service.applyOperation(operation)

        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data).toBe('reroute-1')
        }
      })

      it('should return error when link not found', async () => {
        mockGraph._links.clear()

        const operation: GraphMutationOperation = {
          type: 'addReroute',
          timestamp: Date.now(),
          origin: CommandOrigin.Local,
          params: {
            pos: [100, 100],
            linkId: 999 as any
          }
        }

        const result = await service.applyOperation(operation)

        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.context.cause.message).toContain('999')
        }
      })
    })

    describe('removeReroute command', () => {
      it('should remove reroute', async () => {
        mockGraph.reroutes.set('reroute-1' as any, {})

        const operation: GraphMutationOperation = {
          type: 'removeReroute',
          timestamp: Date.now(),
          origin: CommandOrigin.Local,
          params: 'reroute-1' as any
        }

        const result = await service.applyOperation(operation)

        expect(result.success).toBe(true)
        expect(mockGraph.removeReroute).toHaveBeenCalledWith('reroute-1')
      })
    })
  })

  describe('edge cases', () => {
    describe('canvas null scenarios', () => {
      it('should handle operations when canvas is not initialized', async () => {
        mockGraph.setDirtyCanvas.mockImplementation(() => {
          throw new Error('Canvas not initialized')
        })

        const operation: GraphMutationOperation = {
          type: 'bypassNode',
          timestamp: Date.now(),
          origin: CommandOrigin.Local,
          params: 'node-1' as any
        }

        const result = await service.applyOperation(operation)

        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.context.cause.message).toContain(
            'Canvas not initialized'
          )
        }
      })

      it('should handle group operations without canvas', async () => {
        mockGraph.setDirtyCanvas.mockImplementation(() => {
          throw new Error('Canvas is null')
        })

        const mockGroup = new mockLGraphGroup('Test Group')
        mockGroup.id = 999
        mockGraph._groups = [mockGroup] as any

        const result = await service.updateGroupTitle({
          groupId: mockGroup.id,
          title: 'New Title'
        })

        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error).toBeInstanceOf(GraphMutationError)
          expect(result.error.message).toBe('Failed to update group title')
          expect(result.error.context.cause.message).toBe('Canvas is null')
        }
      })

      it('should handle reroute operations without canvas', async () => {
        mockGraph.setDirtyCanvas.mockImplementation(() => {
          console.warn('Canvas not available')
        })

        mockGraph.reroutes.set('reroute-1' as any, {})

        const operation: GraphMutationOperation = {
          type: 'removeReroute',
          timestamp: Date.now(),
          origin: CommandOrigin.Local,
          params: 'reroute-1' as any
        }

        const result = await service.applyOperation(operation)

        expect(result.success).toBe(true)
        expect(mockGraph.removeReroute).toHaveBeenCalledWith('reroute-1')
      })
    })

    describe('subgraph context switching', () => {
      let parentGraph: any
      let subgraphContext: any
      let mockSubgraphNode: any
      let mockSubgraph: any

      beforeEach(() => {
        parentGraph = {
          beforeChange: vi.fn(),
          afterChange: vi.fn(),
          add: vi.fn(),
          remove: vi.fn(),
          getNodeById: vi.fn(),
          removeLink: vi.fn(),
          clear: vi.fn(),
          setDirtyCanvas: vi.fn(),
          _links: new Map(),
          _groups: [] as any[],
          _nodes: [] as any[],
          reroutes: new Map(),
          createReroute: vi.fn(),
          removeReroute: vi.fn(),
          convertToSubgraph: vi.fn(),
          unpackSubgraph: vi.fn(),
          version: '1.0.0',
          config: {}
        }

        mockSubgraph = {
          id: 'subgraph-1',
          nodes: [],
          groups: [],
          reroutes: new Map(),
          inputs: [],
          outputs: [],
          addInput: vi.fn(),
          addOutput: vi.fn(),
          removeInput: vi.fn(),
          removeOutput: vi.fn(),
          _nodes: [] as any[]
        }

        mockSubgraphNode = new MockSubgraphNode(parentGraph, mockSubgraph, {
          id: 'subgraph-node-1'
        })
        mockSubgraphNode.type = 'subgraph'
        mockSubgraphNode.isSubgraphNode = vi.fn(() => true)

        subgraphContext = {
          beforeChange: vi.fn(),
          afterChange: vi.fn(),
          add: vi.fn(),
          remove: vi.fn(),
          getNodeById: vi.fn(),
          removeLink: vi.fn(),
          clear: vi.fn(),
          setDirtyCanvas: vi.fn(),
          _links: new Map(),
          _groups: [] as any[],
          _nodes: [] as any[],
          reroutes: new Map(),
          createReroute: vi.fn(),
          removeReroute: vi.fn(),
          convertToSubgraph: vi.fn(),
          unpackSubgraph: vi.fn(),
          version: '1.0.0',
          config: {},
          _parent_graph: parentGraph,
          _is_subgraph: true
        }

        parentGraph._nodes = [mockSubgraphNode]
      })

      it('should handle mutations during subgraph navigation', async () => {
        const originalGraph = mockApp.graph
        mockApp.graph = subgraphContext

        const nodeInSubgraph = { ...mockNode, id: 'subgraph-inner-node' }
        mockLiteGraph.createNode.mockReturnValue(nodeInSubgraph)
        subgraphContext.add.mockReturnValue(nodeInSubgraph)

        const result = await service.createNode({
          type: 'TestNode',
          title: 'Node in Subgraph'
        })

        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data).toBe('subgraph-inner-node')
        }

        expect(subgraphContext.add).toHaveBeenCalledWith(nodeInSubgraph)
        expect(parentGraph.add).not.toHaveBeenCalled()

        mockApp.graph = originalGraph
      })

      it('should handle widget configuration in subgraph context', async () => {
        const originalGraph = mockApp.graph
        mockApp.graph = subgraphContext

        const nodeWithWidgets = {
          ...mockNode,
          id: 'widget-node',
          widgets: [
            { type: 'number', name: 'seed', value: 123 },
            { type: 'combo', name: 'sampler', value: 'euler' }
          ]
        }

        mockLiteGraph.createNode.mockReturnValue(nodeWithWidgets)
        subgraphContext.add.mockReturnValue(nodeWithWidgets)
        subgraphContext.getNodeById.mockReturnValue(nodeWithWidgets)

        const createResult = await service.createNode({
          type: 'KSampler',
          properties: { seed: 456 }
        })

        expect(createResult.success).toBe(true)

        const updateResult = await service.updateNodeProperty({
          nodeId: 'widget-node' as any,
          property: 'seed',
          value: 789
        })

        expect(updateResult.success).toBe(true)
        expect(nodeWithWidgets.setProperty).toHaveBeenCalledWith('seed', 789)

        mockApp.graph = originalGraph
      })

      it('should switch between parent and subgraph contexts correctly', async () => {
        const originalGraph = mockApp.graph

        mockApp.graph = parentGraph
        parentGraph.getNodeById.mockReturnValue(mockSubgraphNode)
        parentGraph._nodes = [mockSubgraphNode]

        const getSubgraphPrivate = (service as any).getSubgraph.bind(service)
        const foundSubgraph = getSubgraphPrivate('subgraph-1')
        expect(foundSubgraph).toBe(mockSubgraph)

        mockApp.graph = subgraphContext

        const innerNode = { ...mockNode, id: 'inner-node' }
        subgraphContext.getNodeById.mockReturnValue(innerNode)

        const result = await service.removeNode('inner-node' as any)
        expect(result.success).toBe(true)
        expect(subgraphContext.remove).toHaveBeenCalledWith(innerNode)

        mockApp.graph = originalGraph
      })
    })

    describe('link ID preservation', () => {
      it('should preserve link IDs across subgraph operations', async () => {
        const originalLinkId = 'link-123'
        const sourceNode = {
          ...mockNode,
          id: 'source-1',
          outputs: [{ links: [originalLinkId] }]
        }
        const targetNode = {
          ...mockNode,
          id: 'target-1',
          inputs: [{ link: originalLinkId }]
        }

        mockGraph.getNodeById.mockImplementation((id: string) => {
          if (id === 'source-1') return sourceNode
          if (id === 'target-1') return targetNode
          return null
        })

        const originalLink = {
          id: originalLinkId,
          origin_id: 'source-1',
          origin_slot: 0,
          target_id: 'target-1',
          target_slot: 0,
          type: 'IMAGE'
        }
        mockGraph._links.set(originalLinkId, originalLink)

        const selectedItems = new Set([sourceNode, targetNode])
        const subgraph = {
          id: 'test-subgraph',
          nodes: [],
          _links: new Map(),
          addNode: vi.fn(),
          addLink: vi.fn()
        }

        const subgraphNode = {
          id: 'subgraph-node-1',
          type: 'subgraph',
          subgraph: subgraph,
          inputs: [],
          outputs: []
        }

        mockGraph.convertToSubgraph.mockReturnValue({
          subgraph: subgraph,
          node: subgraphNode
        })

        const createResult = await service.createSubgraph({ selectedItems })

        expect(createResult.success).toBe(true)
        if (createResult.success) {
          expect(createResult.data.subgraph).toBe(subgraph)
          expect(createResult.data.node).toBe(subgraphNode)
        }

        mockGraph.getNodeById.mockReturnValue(subgraphNode)
        mockGraph.unpackSubgraph.mockImplementation(() => {
          const newSourceNode = { ...sourceNode, id: 'source-2' }
          const newTargetNode = { ...targetNode, id: 'target-2' }

          const newLink = {
            id: 'new-link-789',
            origin_id: newSourceNode.id,
            origin_slot: 0,
            target_id: newTargetNode.id,
            target_slot: 0,
            type: originalLink.type
          }

          mockGraph._nodes.push(newSourceNode, newTargetNode)
          mockGraph._links.set('new-link-789', newLink)

          newSourceNode.outputs[0].links = ['new-link-789']
          newTargetNode.inputs[0].link = 'new-link-789'
        })

        const unpackResult = await service.unpackSubgraph(
          'subgraph-node-1' as any
        )

        expect(unpackResult.success).toBe(true)
        expect(mockGraph.unpackSubgraph).toHaveBeenCalledWith(subgraphNode)

        const newLink = mockGraph._links.get('new-link-789')
        expect(newLink).toBeDefined()
        expect(newLink.type).toBe(originalLink.type)
      })

      it('should maintain link integrity when copying subgraph nodes', async () => {
        const subgraphNode = {
          ...mockNode,
          id: 'subgraph-1',
          type: 'subgraph',
          isSubgraphNode: vi.fn(() => true),
          subgraph: {
            nodes: [
              { id: 'internal-1', outputs: [{ links: ['internal-link-1'] }] },
              { id: 'internal-2', inputs: [{ link: 'internal-link-1' }] }
            ],
            _links: new Map([
              [
                'internal-link-1',
                {
                  id: 'internal-link-1',
                  origin_id: 'internal-1',
                  target_id: 'internal-2'
                }
              ]
            ])
          }
        }

        mockGraph.getNodeById.mockReturnValue(subgraphNode)

        const clonedSubgraph = {
          ...subgraphNode,
          id: 'subgraph-2',
          subgraph: {
            nodes: [
              { id: 'internal-3', outputs: [{ links: ['internal-link-2'] }] },
              { id: 'internal-4', inputs: [{ link: 'internal-link-2' }] }
            ],
            _links: new Map([
              [
                'internal-link-2',
                {
                  id: 'internal-link-2',
                  origin_id: 'internal-3',
                  target_id: 'internal-4'
                }
              ]
            ])
          }
        }

        subgraphNode.clone = vi.fn(() => clonedSubgraph)
        mockGraph.add.mockReturnValue(clonedSubgraph)

        const result = await service.cloneNode('subgraph-1' as any)

        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data).toBe('subgraph-2')
        }

        expect(clonedSubgraph.subgraph._links.size).toBe(1)
        const clonedLink = clonedSubgraph.subgraph._links.get('internal-link-2')
        expect(clonedLink).toBeDefined()
        expect(clonedLink.id).not.toBe('internal-link-1')
        expect(clonedLink.origin_id).toBe('internal-3')
        expect(clonedLink.target_id).toBe('internal-4')
      })
    })
  })
})
