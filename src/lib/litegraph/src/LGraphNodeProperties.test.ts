import { beforeEach, describe, expect, it } from 'vitest'

import { LGraphNodeProperties } from '@/lib/litegraph/src/LGraphNodeProperties'
import type { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import {
  createMockLGraph,
  createMockLGraphNode
} from '@/utils/__tests__/litegraphTestUtils'

describe('LGraphNodeProperties', () => {
  let mockNode: LGraphNode
  let mockGraph: LGraph

  beforeEach(() => {
    mockGraph = createMockLGraph()

    mockNode = createMockLGraphNode({
      id: 123,
      title: 'Test Node',
      flags: {},
      graph: mockGraph
    })
  })

  describe('property tracking', () => {
    it('should track changes to existing properties', () => {
      new LGraphNodeProperties(mockNode)

      mockNode.title = 'New Title'

      expect(mockGraph.trigger).toHaveBeenCalledWith('node:property:changed', {
        nodeId: mockNode.id,
        property: 'title',
        oldValue: 'Test Node',
        newValue: 'New Title'
      })
    })

    it('should emit event when value is set to the same value', () => {
      new LGraphNodeProperties(mockNode)

      mockNode.title = 'Test Node' // Same value as original

      expect(mockGraph.trigger).toHaveBeenCalledTimes(1)
    })

    it('should not emit events when node has no graph', () => {
      mockNode.graph = null
      new LGraphNodeProperties(mockNode)

      // Should not throw
      expect(() => {
        mockNode.title = 'New Title'
      }).not.toThrow()
    })
  })

  describe('isTracked', () => {
    it('should correctly identify tracked properties', () => {
      const propManager = new LGraphNodeProperties(mockNode)

      expect(propManager.isTracked('title')).toBe(true)
      expect(propManager.isTracked('mode')).toBe(true)
      // shape emits from its own accessor; flags are covered by store reactivity
      expect(propManager.isTracked('shape')).toBe(false)
      expect(propManager.isTracked('flags.collapsed')).toBe(false)
      expect(propManager.isTracked('untracked')).toBe(false)
    })
  })

  describe('serialization behavior', () => {
    it('should keep tracked properties enumerable', () => {
      const initialDescriptor = Object.getOwnPropertyDescriptor(
        mockNode,
        'title'
      )
      expect(initialDescriptor?.enumerable).toBe(true)

      new LGraphNodeProperties(mockNode)

      const afterDescriptor = Object.getOwnPropertyDescriptor(mockNode, 'title')
      expect(afterDescriptor?.enumerable).toBe(true)
    })
  })
})
