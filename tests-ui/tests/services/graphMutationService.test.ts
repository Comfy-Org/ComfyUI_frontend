import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { IGraphMutationService } from '@/services/IGraphMutationService'
import {
  GraphMutationService,
  ValidationException,
  useGraphMutationService
} from '@/services/graphMutationService'

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
  _groups: [],
  _nodes: [],
  reroutes: new Map(),
  createReroute: vi.fn(),
  removeReroute: vi.fn(),
  convertToSubgraph: vi.fn(),
  unpackSubgraph: vi.fn(),
  version: '1.0.0',
  config: {}
}))

const mockApp = vi.hoisted(() => ({
  graph: mockGraph
}))

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

vi.mock('@/stores/workflowStore', () => ({
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

vi.mock('@/lib/litegraph/src/subgraph/SubgraphNode', () => ({
  SubgraphNode: vi.fn().mockImplementation((graph, subgraph, data) => ({
    id: data.id,
    subgraph,
    graph: graph
  }))
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
      expect(service).toHaveProperty('addNode')
      expect(service).toHaveProperty('removeNode')
      expect(service).toHaveProperty('connect')
      expect(service).toHaveProperty('transaction')
      expect(service).toHaveProperty('undo')
      expect(service).toHaveProperty('redo')
      expect(typeof service.addNode).toBe('function')
      expect(typeof service.removeNode).toBe('function')
      expect(typeof service.connect).toBe('function')
    })

    it('should have singleton behavior through useGraphMutationService', () => {
      const instance1 = useGraphMutationService()
      const instance2 = useGraphMutationService()

      expect(instance1).toBe(instance2)
    })
  })

  describe('node operations', () => {
    describe('addNode', () => {
      it('should add a node successfully', async () => {
        const params = {
          type: 'LoadImage',
          pos: [100, 200] as [number, number],
          title: 'My Image Loader',
          properties: { seed: 12345 }
        }

        const nodeId = await service.addNode(params)

        expect(mockLiteGraph.createNode).toHaveBeenCalledWith('LoadImage')
        expect(mockGraph.beforeChange).toHaveBeenCalled()
        expect(mockGraph.add).toHaveBeenCalledWith(mockNode)
        expect(mockGraph.afterChange).toHaveBeenCalled()
        expect(
          mockWorkflowStore.activeWorkflow.changeTracker.checkState
        ).toHaveBeenCalled()
        expect(nodeId).toBe('node-1')
      })

      it('should handle node creation failure', async () => {
        mockLiteGraph.createNode.mockReturnValue(null)

        await expect(service.addNode({ type: 'InvalidType' })).rejects.toThrow(
          'Failed to create node of type: InvalidType'
        )
      })

      it('should handle graph add failure', async () => {
        mockGraph.add.mockReturnValue(null)

        await expect(service.addNode({ type: 'TestNode' })).rejects.toThrow(
          'Failed to add node to graph'
        )
      })

      it('should set node properties correctly', async () => {
        const params = {
          type: 'TestNode',
          pos: [50, 75] as [number, number],
          title: 'Custom Title',
          properties: { prop1: 'value1', prop2: 42 }
        }

        await service.addNode(params)

        expect(mockNode.pos).toEqual([50, 75])
        expect(mockNode.title).toBe('Custom Title')
        expect(mockNode.properties).toBeDefined()
      })
    })

    describe('removeNode', () => {
      it('should remove a node successfully', async () => {
        await service.removeNode('node-1')

        expect(mockGraph.getNodeById).toHaveBeenCalledWith('node-1')
        expect(mockGraph.remove).toHaveBeenCalledWith(mockNode)
        expect(
          mockWorkflowStore.activeWorkflow.changeTracker.checkState
        ).toHaveBeenCalled()
      })

      it('should handle node not found', async () => {
        mockGraph.getNodeById.mockReturnValue(null)

        await expect(service.removeNode('nonexistent')).rejects.toThrow(
          'Node with id nonexistent not found'
        )
      })
    })

    describe('updateNodeProperty', () => {
      it('should update node property successfully', async () => {
        await service.updateNodeProperty('node-1', 'seed', 54321)

        expect(mockGraph.getNodeById).toHaveBeenCalledWith('node-1')
        expect(mockNode.setProperty).toHaveBeenCalledWith('seed', 54321)
        expect(mockGraph.beforeChange).toHaveBeenCalled()
        expect(mockGraph.afterChange).toHaveBeenCalled()
      })

      it('should handle node not found', async () => {
        mockGraph.getNodeById.mockReturnValue(null)

        await expect(
          service.updateNodeProperty('nonexistent', 'prop', 'value')
        ).rejects.toThrow('Node with id nonexistent not found')
      })
    })

    describe('updateNodeTitle', () => {
      it('should update node title successfully', async () => {
        await service.updateNodeTitle('node-1', 'New Title')

        expect(mockNode.title).toBe('New Title')
        expect(mockGraph.beforeChange).toHaveBeenCalled()
        expect(mockGraph.afterChange).toHaveBeenCalled()
      })
    })

    describe('changeNodeMode', () => {
      it('should change node mode successfully', async () => {
        mockNode.changeMode.mockReturnValue(true)

        await service.changeNodeMode('node-1', 4)

        expect(mockNode.changeMode).toHaveBeenCalledWith(4)
        expect(mockGraph.beforeChange).toHaveBeenCalled()
        expect(mockGraph.afterChange).toHaveBeenCalled()
      })

      it('should handle mode change failure', async () => {
        mockNode.changeMode.mockReturnValue(false)

        await expect(service.changeNodeMode('node-1', 999)).rejects.toThrow(
          'Failed to change node mode to 999'
        )
      })
    })

    describe('cloneNode', () => {
      it('should clone node with custom position', async () => {
        const clonedId = await service.cloneNode('node-1', [300, 400])

        expect(mockNode.clone).toHaveBeenCalled()
        expect(mockGraph.add).toHaveBeenCalled()
        expect(clonedId).toBe('node-1') // mockNode.id is returned
      })

      it('should clone node with offset position', async () => {
        mockNode.pos = [100, 200]

        await service.cloneNode('node-1')

        const clonedNode = mockNode.clone()
        expect(clonedNode.pos).toEqual([150, 250]) // Original + 50 offset
      })

      it('should handle clone failure', async () => {
        mockNode.clone.mockReturnValue(null)

        await expect(service.cloneNode('node-1')).rejects.toThrow(
          'Failed to clone node'
        )
      })
    })
  })

  describe('connection operations', () => {
    describe('connect', () => {
      it('should create connection successfully', async () => {
        const params = {
          sourceNodeId: 'node-1' as any,
          sourceSlot: 0,
          targetNodeId: 'node-2' as any,
          targetSlot: 1
        }

        const linkId = await service.connect(params)

        expect(mockGraph.getNodeById).toHaveBeenCalledWith('node-1')
        expect(mockGraph.getNodeById).toHaveBeenCalledWith('node-2')
        expect(mockNode.connect).toHaveBeenCalledWith(0, mockNode, 1)
        expect(linkId).toBe('123')
      })

      it('should handle source node not found', async () => {
        mockGraph.getNodeById.mockImplementation((id: string) =>
          id === 'node-1' ? null : mockNode
        )

        const params = {
          sourceNodeId: 'node-1' as any,
          sourceSlot: 0,
          targetNodeId: 'node-2' as any,
          targetSlot: 1
        }

        await expect(service.connect(params)).rejects.toThrow(
          'Source node with id node-1 not found'
        )
      })

      it('should handle connection failure', async () => {
        mockNode.connect.mockReturnValue(null)

        const params = {
          sourceNodeId: 'node-1' as any,
          sourceSlot: 0,
          targetNodeId: 'node-2' as any,
          targetSlot: 1
        }

        await expect(service.connect(params)).rejects.toThrow(
          'Failed to create connection'
        )
      })
    })

    describe('disconnect operations', () => {
      it('should disconnect input successfully', async () => {
        mockNode.disconnectInput.mockReturnValue(true)

        const result = await service.disconnectInput('node-1', 0)

        expect(mockNode.disconnectInput).toHaveBeenCalledWith(0)
        expect(result).toBe(true)
      })

      it('should disconnect output successfully', async () => {
        mockNode.disconnectOutput.mockReturnValue(true)

        const result = await service.disconnectOutput('node-1', 0)

        expect(mockNode.disconnectOutput).toHaveBeenCalledWith(0)
        expect(result).toBe(true)
      })

      it('should disconnect output to specific target', async () => {
        mockNode.disconnectOutput.mockReturnValue(true)

        const result = await service.disconnectOutputTo('node-1', 0, 'node-2')

        expect(mockNode.disconnectOutput).toHaveBeenCalledWith(0, mockNode)
        expect(result).toBe(true)
      })
    })

    describe('disconnectLink', () => {
      it('should disconnect link successfully', async () => {
        await service.disconnectLink(123)

        expect(mockGraph.removeLink).toHaveBeenCalledWith(123)
        expect(mockGraph.beforeChange).toHaveBeenCalled()
        expect(mockGraph.afterChange).toHaveBeenCalled()
      })
    })
  })

  describe('group operations', () => {
    let mockGroup: any

    beforeEach(() => {
      mockGroup = new mockLGraphGroup('Test Group')
      mockGroup.id = 999
      mockGraph._groups = [mockGroup] as any
    })

    describe('createGroup', () => {
      it('should create group with all parameters', async () => {
        const params = {
          title: 'My Group',
          pos: [50, 60] as [number, number],
          size: [300, 250] as [number, number],
          color: '#ff0000',
          fontSize: 16
        }

        const groupId = await service.createGroup(params)

        expect(mockGraph.add).toHaveBeenCalled()
        expect(typeof groupId).toBe('number')
        expect(groupId).toBeGreaterThanOrEqual(1000)
      })

      it('should create group with default values', async () => {
        const groupId = await service.createGroup({})

        expect(mockGraph.add).toHaveBeenCalled()
        expect(typeof groupId).toBe('number')
        expect(groupId).toBeGreaterThanOrEqual(1000)
      })
    })

    describe('removeGroup', () => {
      it('should remove group successfully', async () => {
        await service.removeGroup(mockGroup.id)

        expect(mockGraph.remove).toHaveBeenCalledWith(mockGroup)
      })

      it('should handle group not found', async () => {
        await expect(service.removeGroup(123456)).rejects.toThrow(
          'Group with id 123456 not found'
        )
      })
    })

    describe('updateGroupTitle', () => {
      it('should update group title successfully', async () => {
        await service.updateGroupTitle(mockGroup.id, 'New Title')

        expect(mockGroup.title).toBe('New Title')
        expect(mockGraph.setDirtyCanvas).toHaveBeenCalledWith(true, false)
      })
    })

    describe('moveGroup', () => {
      it('should move group successfully', async () => {
        await service.moveGroup(mockGroup.id, 25, 30)

        expect(mockGroup.move).toHaveBeenCalledWith(25, 30, false)
        expect(mockGraph.setDirtyCanvas).toHaveBeenCalledWith(true, false)
      })
    })

    describe('addNodesToGroup', () => {
      it('should add nodes to group successfully', async () => {
        await service.addNodesToGroup(mockGroup.id, ['node-1', 'node-2'])

        expect(mockGroup.addNodes).toHaveBeenCalledWith([mockNode, mockNode])
        expect(mockGroup.recomputeInsideNodes).toHaveBeenCalled()
      })

      it('should handle node not found', async () => {
        mockGraph.getNodeById.mockImplementation((id: string) =>
          id === 'node-1' ? mockNode : null
        )

        await expect(
          service.addNodesToGroup(mockGroup.id, ['node-1', 'nonexistent'])
        ).rejects.toThrow('Node with id nonexistent not found')
      })
    })
  })

  describe('batch operations', () => {
    describe('addNodes', () => {
      it('should add multiple nodes successfully', async () => {
        const nodes = [
          { type: 'Node1', pos: [0, 0] as [number, number] },
          { type: 'Node2', pos: [100, 100] as [number, number] }
        ]

        const nodeIds = await service.addNodes(nodes)

        expect(mockLiteGraph.createNode).toHaveBeenCalledTimes(2)
        expect(mockGraph.add).toHaveBeenCalledTimes(2)
        expect(nodeIds).toHaveLength(2)
      })

      it('should handle partial failure and rollback', async () => {
        mockLiteGraph.createNode
          .mockReturnValueOnce(mockNode)
          .mockReturnValueOnce(null)

        const nodes = [{ type: 'Node1' }, { type: 'InvalidNode' }]

        await expect(service.addNodes(nodes)).rejects.toThrow(
          'Failed to create node of type: InvalidNode'
        )

        expect(mockGraph.afterChange).toHaveBeenCalled()
      })
    })

    describe('removeNodes', () => {
      it('should remove multiple nodes successfully', async () => {
        await service.removeNodes(['node-1', 'node-2'])

        expect(mockGraph.remove).toHaveBeenCalledTimes(2)
      })

      it('should validate all nodes exist first', async () => {
        mockGraph.getNodeById.mockImplementation((id: string) =>
          id === 'node-1' ? mockNode : null
        )

        await expect(
          service.removeNodes(['node-1', 'nonexistent'])
        ).rejects.toThrow('Node with id nonexistent not found')

        expect(mockGraph.remove).not.toHaveBeenCalled()
      })
    })

    describe('duplicateNodes', () => {
      beforeEach(() => {
        const node1 = {
          ...mockNode,
          id: 'node-1',
          outputs: [{ links: [123] }]
        }
        const node2 = { ...mockNode, id: 'node-2' }

        mockGraph.getNodeById.mockImplementation((id: string) => {
          if (id === 'node-1') return node1
          if (id === 'node-2') return node2
          if (id === 'cloned-node') return { ...mockNode, id: 'cloned-node' }
          return null
        })

        mockGraph.add.mockImplementation((node: any) => ({
          ...node,
          id: 'cloned-node'
        }))
      })

      it('should duplicate nodes with connections', async () => {
        const newNodeIds = await service.duplicateNodes(
          ['node-1', 'node-2'],
          [100, 50]
        )

        expect(mockNode.clone).toHaveBeenCalledTimes(2)
        expect(mockGraph.add).toHaveBeenCalledTimes(2)
        expect(newNodeIds).toHaveLength(2)
      })

      it('should use default offset when not provided', async () => {
        const newNodeIds = await service.duplicateNodes(['node-1'])

        expect(newNodeIds).toHaveLength(1)
      })
    })
  })

  describe('clipboard operations', () => {
    beforeEach(() => {
      // Clear localStorage before each test
      localStorage.clear()
    })

    describe('copyNodes', () => {
      it('should copy nodes to clipboard', async () => {
        // Mock node.clone() to return a clonable node
        const clonedNode = {
          serialize: vi.fn(() => ({
            id: 'node-1',
            type: 'TestNode',
            pos: [0, 0]
          }))
        }
        mockNode.clone = vi.fn(() => clonedNode)

        await service.copyNodes(['node-1'])

        const storedData = localStorage.getItem('litegrapheditor_clipboard')
        expect(storedData).not.toBeNull()

        const clipboard = JSON.parse(storedData!)
        expect(clipboard.nodes).toHaveLength(1)
        expect(clipboard.nodes[0].id).toBe('node-1')
        expect(mockNode.clone).toHaveBeenCalled()

        const clipboardData = service.getClipboard()
        expect(clipboardData).not.toBeNull()
        expect(clipboardData!.nodes).toHaveLength(1)
        expect(clipboardData!.isCut).toBe(false)
      })

      it('should handle empty node list', async () => {
        await expect(service.copyNodes([])).rejects.toThrow('No nodes to copy')
      })

      it('should handle node not found', async () => {
        mockGraph.getNodeById.mockReturnValue(null)

        await expect(service.copyNodes(['nonexistent'])).rejects.toThrow(
          'Node with id nonexistent not found'
        )
      })
    })

    describe('cutNodes', () => {
      it('should cut nodes to clipboard', async () => {
        // Mock node.clone() to return a clonable node
        const clonedNode = {
          serialize: vi.fn(() => ({
            id: 'node-1',
            type: 'TestNode',
            pos: [0, 0]
          }))
        }
        mockNode.clone = vi.fn(() => clonedNode)

        await service.cutNodes(['node-1'])

        const clipboard = service.getClipboard()
        expect(clipboard!.isCut).toBe(true)

        const storedData = localStorage.getItem('litegrapheditor_clipboard')
        const clipboardData = JSON.parse(storedData!)
        expect(clipboardData.isCut).toBe(true)
        expect(clipboardData.originalIds).toEqual(['node-1'])
      })
    })

    describe('pasteNodes', () => {
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

      it('should paste nodes from clipboard', async () => {
        const pastedIds = await service.pasteNodes([200, 300])

        expect(mockLiteGraph.createNode).toHaveBeenCalledWith('TestNode')
        expect(mockGraph.add).toHaveBeenCalled()
        expect(pastedIds).toHaveLength(1)
        expect(pastedIds[0]).toBe('new-node-1')
      })

      it('should handle empty clipboard', async () => {
        localStorage.clear()

        await expect(service.pasteNodes()).rejects.toThrow('Clipboard is empty')
      })

      it('should use default offset when position not provided', async () => {
        const pastedIds = await service.pasteNodes()

        expect(pastedIds).toHaveLength(1)
      })
    })

    describe('clipboard utilities', () => {
      it('should check clipboard content correctly', async () => {
        expect(service.hasClipboardContent()).toBe(false)

        const clonedNode = {
          serialize: vi.fn(() => ({
            id: 'node-1',
            type: 'TestNode',
            pos: [0, 0]
          }))
        }
        mockNode.clone = vi.fn(() => clonedNode)

        await service.copyNodes(['node-1'])

        expect(service.hasClipboardContent()).toBe(true)
      })

      it('should clear clipboard', async () => {
        // Setup clipboard data
        localStorage.setItem(
          'litegrapheditor_clipboard',
          JSON.stringify({
            nodes: [{ id: 'node-1', type: 'TestNode' }],
            links: []
          })
        )
        expect(service.hasClipboardContent()).toBe(true)

        service.clearClipboard()
        expect(service.hasClipboardContent()).toBe(false)
        expect(localStorage.getItem('litegrapheditor_clipboard')).toBeNull()
      })
    })
  })

  describe('transaction support', () => {
    it('should execute transaction successfully', async () => {
      let executionCount = 0

      const result = await service.transaction(async () => {
        executionCount++
        await service.addNode({ type: 'TestNode' })
        return 'success'
      })

      expect(result).toBe('success')
      expect(executionCount).toBe(1)
      expect(mockGraph.beforeChange).toHaveBeenCalled()
      expect(mockGraph.afterChange).toHaveBeenCalled()
    })

    it('should handle transaction errors', async () => {
      await expect(
        service.transaction(async () => {
          throw new Error('Transaction failed')
        })
      ).rejects.toThrow('Transaction failed')

      expect(mockGraph.beforeChange).toHaveBeenCalled()
      expect(mockGraph.afterChange).toHaveBeenCalled()
    })

    it('should support nested transactions', async () => {
      await service.transaction(async () => {
        await service.transaction(async () => {
          await service.addNode({ type: 'NestedNode' })
        })
      })

      expect(mockGraph.beforeChange).toHaveBeenCalledTimes(2)
      expect(mockGraph.afterChange).toHaveBeenCalledTimes(2)
    })
  })

  describe('undo/redo operations', () => {
    it('should call undo on change tracker', async () => {
      await service.undo()

      expect(
        mockWorkflowStore.activeWorkflow.changeTracker.undo
      ).toHaveBeenCalled()
    })

    it('should call redo on change tracker', async () => {
      await service.redo()

      expect(
        mockWorkflowStore.activeWorkflow.changeTracker.redo
      ).toHaveBeenCalled()
    })

    it('should handle missing change tracker', async () => {
      const localService = new GraphMutationService()
      const originalActiveWorkflow = mockWorkflowStore.activeWorkflow
      mockWorkflowStore.activeWorkflow = null as any

      await expect(localService.undo()).rejects.toThrow(
        'No active workflow or change tracker'
      )

      mockWorkflowStore.activeWorkflow = originalActiveWorkflow
    })
  })

  describe('graph-level operations', () => {
    describe('clearGraph', () => {
      it('should clear graph successfully', async () => {
        await service.clearGraph()

        expect(mockGraph.beforeChange).toHaveBeenCalled()
        expect(mockGraph.clear).toHaveBeenCalled()
        expect(mockGraph.afterChange).toHaveBeenCalled()

        if (mockWorkflowStore.activeWorkflow?.changeTracker) {
          expect(
            mockWorkflowStore.activeWorkflow.changeTracker.checkState
          ).toHaveBeenCalled()
        }
      })
    })

    describe('execution control', () => {
      it('should bypass node successfully', async () => {
        await service.bypassNode('node-1')

        expect(mockNode.mode).toBe(4) // LGraphEventMode.BYPASS
        expect(mockGraph.setDirtyCanvas).toHaveBeenCalledWith(true, false)
      })

      it('should unbypass node successfully', async () => {
        await service.unbypassNode('node-1')

        expect(mockNode.mode).toBe(0) // LGraphEventMode.ALWAYS
        expect(mockGraph.setDirtyCanvas).toHaveBeenCalledWith(true, false)
      })
    })
  })

  describe('validation system', () => {
    it('should handle ValidationException correctly', () => {
      const errors = [
        { code: 'INVALID_TYPE', message: 'Invalid node type' },
        { code: 'MISSING_PARAM', message: 'Missing parameter' }
      ]

      const exception = new ValidationException(errors)

      expect(exception.name).toBe('ValidationException')
      expect(exception.errors).toEqual(errors)
      expect(exception.message).toBe('Invalid node type, Missing parameter')
    })
  })

  describe('error handling', () => {
    it('should maintain graph state on errors', async () => {
      mockLiteGraph.createNode.mockImplementation(() => {
        throw new Error('Node creation failed')
      })

      await expect(service.addNode({ type: 'FailNode' })).rejects.toThrow()

      expect(mockLiteGraph.createNode).toHaveBeenCalled()
    })

    it('should handle change tracker unavailable', async () => {
      const originalChangeTracker =
        mockWorkflowStore.activeWorkflow?.changeTracker

      if (mockWorkflowStore.activeWorkflow) {
        mockWorkflowStore.activeWorkflow.changeTracker = null as any
      }

      await service.addNode({ type: 'TestNode' })

      expect(mockGraph.beforeChange).toHaveBeenCalled()
      expect(mockGraph.afterChange).toHaveBeenCalled()

      if (mockWorkflowStore.activeWorkflow) {
        mockWorkflowStore.activeWorkflow.changeTracker = originalChangeTracker
      }
    })
  })

  describe('subgraph operations', () => {
    let mockSubgraphNode: any
    let mockSubgraph: any

    beforeEach(() => {
      mockSubgraph = {
        id: 'subgraph-1',
        nodes: [],
        groups: [],
        reroutes: new Map()
      }

      mockSubgraphNode = {
        id: 'subgraph-node-1',
        type: 'subgraph',
        subgraph: mockSubgraph,
        isSubgraphNode: vi.fn(() => true)
      }
    })

    describe('createSubgraph', () => {
      it('should create subgraph from selected items', async () => {
        const selectedItems = new Set([mockNode])
        const expectedResult = {
          subgraph: mockSubgraph,
          node: mockSubgraphNode
        }

        mockGraph.convertToSubgraph.mockReturnValue(expectedResult)

        const result = await service.createSubgraph({ selectedItems })

        expect(mockGraph.convertToSubgraph).toHaveBeenCalledWith(selectedItems)
        expect(result).toBe(expectedResult)
      })

      it('should throw error when no items selected', async () => {
        const selectedItems = new Set()

        await expect(service.createSubgraph({ selectedItems })).rejects.toThrow(
          'Cannot create subgraph: no items selected'
        )
      })

      it('should handle convertToSubgraph failure', async () => {
        const selectedItems = new Set([mockNode])
        mockGraph.convertToSubgraph.mockReturnValue(null)

        await expect(service.createSubgraph({ selectedItems })).rejects.toThrow(
          'Failed to create subgraph'
        )
      })
    })

    describe('unpackSubgraph', () => {
      it('should unpack subgraph node successfully', async () => {
        mockGraph.getNodeById.mockReturnValue(mockSubgraphNode)
        mockGraph.unpackSubgraph.mockImplementation(() => {})

        await service.unpackSubgraph('subgraph-node-1')

        expect(mockGraph.unpackSubgraph).toHaveBeenCalledWith(mockSubgraphNode)
        expect(mockGraph.beforeChange).toHaveBeenCalled()
        expect(mockGraph.afterChange).toHaveBeenCalled()
      })

      it('should throw error for non-existent node', async () => {
        mockGraph.getNodeById.mockReturnValue(null)

        await expect(service.unpackSubgraph('non-existent')).rejects.toThrow(
          'Node with id non-existent not found'
        )
      })

      it('should throw error for non-subgraph node', async () => {
        const regularNode = {
          ...mockNode,
          isSubgraphNode: undefined,
          subgraph: undefined
        }
        mockGraph.getNodeById.mockReturnValue(regularNode)

        await expect(service.unpackSubgraph('node-1')).rejects.toThrow(
          'Node is not a subgraph node'
        )
      })

      it('should handle unpack errors gracefully', async () => {
        mockGraph.getNodeById.mockReturnValue(mockSubgraphNode)
        mockGraph.unpackSubgraph
          .mockImplementation(() => {})
          .mockImplementation(() => {
            throw new Error('Unpack failed')
          })

        await expect(service.unpackSubgraph('subgraph-node-1')).rejects.toThrow(
          'Unpack failed'
        )

        expect(mockGraph.afterChange).toHaveBeenCalled()
      })
    })
  })

  describe('edge cases', () => {
    it('should handle nodes without outputs in duplication', async () => {
      const nodeWithoutOutputs = { ...mockNode, outputs: null }
      mockGraph.getNodeById.mockReturnValue(nodeWithoutOutputs)

      const newNodeIds = await service.duplicateNodes(['node-1'])

      expect(newNodeIds).toHaveLength(1)
    })

    it('should handle empty connections in clipboard', async () => {
      const nodeWithoutConnections = { ...mockNode, outputs: [], inputs: [] }
      mockGraph.getNodeById.mockReturnValue(nodeWithoutConnections)

      // Mock node.clone()
      const clonedNode = {
        serialize: vi.fn(() => ({
          id: 'node-1',
          type: 'TestNode',
          pos: [0, 0]
        }))
      }
      nodeWithoutConnections.clone = vi.fn(() => clonedNode)

      await service.copyNodes(['node-1'])

      const clipboard = service.getClipboard()
      expect(clipboard!.connections).toHaveLength(0)
    })
  })
})
