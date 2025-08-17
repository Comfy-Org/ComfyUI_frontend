import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { GroupNodeHandler } from '@/extensions/core/groupNode'
import type {
  ExecutableLGraphNode,
  ExecutionId,
  LGraphNode
} from '@/lib/litegraph/src/litegraph'
import { ExecutableGroupNodeChildDTO } from '@/utils/executableGroupNodeChildDTO'

describe('ExecutableGroupNodeChildDTO', () => {
  let mockNode: LGraphNode
  let mockInputNode: LGraphNode
  let mockNodesByExecutionId: Map<ExecutionId, ExecutableLGraphNode>
  let mockGroupNodeHandler: GroupNodeHandler

  beforeEach(() => {
    // Create mock nodes
    mockNode = {
      id: '10:3',
      graph: {},
      getInputNode: vi.fn(),
      getInputLink: vi.fn(),
      inputs: []
    } as any

    mockInputNode = {
      id: '1',
      graph: {}
    } as any

    // Create the nodesByExecutionId map
    mockNodesByExecutionId = new Map()

    mockGroupNodeHandler = {} as GroupNodeHandler
  })

  describe('resolveInput', () => {
    it('should resolve input from external node (node outside the group)', () => {
      // Setup: External node with ID '1'
      const externalNodeDto = {
        id: '1',
        type: 'TestNode'
      } as ExecutableLGraphNode

      mockNodesByExecutionId.set('1', externalNodeDto)

      mockNode.getInputNode = vi.fn().mockReturnValue(mockInputNode)
      mockNode.getInputLink = vi.fn().mockReturnValue({
        origin_slot: 0
      })

      const dto = new ExecutableGroupNodeChildDTO(
        mockNode,
        ['10'], // Group node ID is 10
        mockNodesByExecutionId,
        undefined,
        mockGroupNodeHandler
      )

      const result = dto.resolveInput(0)

      expect(result).toEqual({
        node: externalNodeDto,
        origin_id: '1',
        origin_slot: 0
      })
    })

    it('should resolve input from internal node (node inside the same group)', () => {
      // Setup: Internal node with ID '10:2'
      const internalInputNode = {
        id: '10:2',
        graph: {}
      } as LGraphNode

      const internalNodeDto = {
        id: '2',
        type: 'InternalNode'
      } as ExecutableLGraphNode

      // Internal nodes are stored with just their index
      mockNodesByExecutionId.set('2', internalNodeDto)

      mockNode.getInputNode = vi.fn().mockReturnValue(internalInputNode)
      mockNode.getInputLink = vi.fn().mockReturnValue({
        origin_slot: 1
      })

      const dto = new ExecutableGroupNodeChildDTO(
        mockNode,
        ['10'],
        mockNodesByExecutionId,
        undefined,
        mockGroupNodeHandler
      )

      const result = dto.resolveInput(0)

      expect(result).toEqual({
        node: internalNodeDto,
        origin_id: '10:2',
        origin_slot: 1
      })
    })

    it('should return undefined if no input node exists', () => {
      mockNode.getInputNode = vi.fn().mockReturnValue(null)

      const dto = new ExecutableGroupNodeChildDTO(
        mockNode,
        ['10'],
        mockNodesByExecutionId,
        undefined,
        mockGroupNodeHandler
      )

      const result = dto.resolveInput(0)

      expect(result).toBeUndefined()
    })

    it('should throw error if input link is missing', () => {
      mockNode.getInputNode = vi.fn().mockReturnValue(mockInputNode)
      mockNode.getInputLink = vi.fn().mockReturnValue(null)

      const dto = new ExecutableGroupNodeChildDTO(
        mockNode,
        ['10'],
        mockNodesByExecutionId,
        undefined,
        mockGroupNodeHandler
      )

      expect(() => dto.resolveInput(0)).toThrow('Failed to get input link')
    })

    it('should throw error if input node cannot be found in nodesByExecutionId', () => {
      // Node exists but is not in the map
      mockNode.getInputNode = vi.fn().mockReturnValue(mockInputNode)
      mockNode.getInputLink = vi.fn().mockReturnValue({
        origin_slot: 0
      })

      const dto = new ExecutableGroupNodeChildDTO(
        mockNode,
        ['10'],
        mockNodesByExecutionId, // Empty map
        undefined,
        mockGroupNodeHandler
      )

      expect(() => dto.resolveInput(0)).toThrow(
        'Failed to get input node 1 for group node child 10:10:3 with slot 0'
      )
    })

    it('should handle nested group nodes correctly', () => {
      // Setup: Node in a nested group with ID '10:5:2'
      const nestedInputNode = {
        id: '10:5:2',
        graph: {}
      } as LGraphNode

      const nestedNodeDto = {
        id: '2',
        type: 'NestedNode'
      } as ExecutableLGraphNode

      mockNodesByExecutionId.set('2', nestedNodeDto)

      mockNode.getInputNode = vi.fn().mockReturnValue(nestedInputNode)
      mockNode.getInputLink = vi.fn().mockReturnValue({
        origin_slot: 2
      })

      const dto = new ExecutableGroupNodeChildDTO(
        mockNode,
        ['10', '5'], // Nested in group 10, then group 5
        mockNodesByExecutionId,
        undefined,
        mockGroupNodeHandler
      )

      const result = dto.resolveInput(0)

      expect(result).toEqual({
        node: nestedNodeDto,
        origin_id: '10:5:2',
        origin_slot: 2
      })
    })
  })
})
