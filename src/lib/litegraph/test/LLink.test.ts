import { describe, expect, it, vi } from 'vitest'

import { LGraph, LGraphNode, LLink } from '@/lib/litegraph/src/litegraph'

import { test } from './testExtensions'

describe('LLink', () => {
  test('matches previous snapshot', () => {
    const link = new LLink(1, 'float', 4, 2, 5, 3)
    expect(link.serialize()).toMatchSnapshot('Basic')
  })

  test('serializes to the previous snapshot', () => {
    const link = new LLink(1, 'float', 4, 2, 5, 3)
    expect(link.serialize()).toMatchSnapshot('Basic')
  })

  describe('disconnect', () => {
    it('should clear the target input link reference when disconnecting', () => {
      // Create a graph and nodes
      const graph = new LGraph()
      const sourceNode = new LGraphNode('Source')
      const targetNode = new LGraphNode('Target')

      // Add nodes to graph
      graph.add(sourceNode)
      graph.add(targetNode)

      // Add slots
      sourceNode.addOutput('out', 'number')
      targetNode.addInput('in', 'number')

      // Connect the nodes
      const link = sourceNode.connect(0, targetNode, 0)
      expect(link).toBeDefined()
      expect(targetNode.inputs[0].link).toBe(link?.id)

      // Mock setDirtyCanvas
      const setDirtyCanvasSpy = vi.spyOn(targetNode, 'setDirtyCanvas')

      // Disconnect the link
      link?.disconnect(graph)

      // Verify the target input's link reference is cleared
      expect(targetNode.inputs[0].link).toBeNull()

      // Verify setDirtyCanvas was called
      expect(setDirtyCanvasSpy).toHaveBeenCalledWith(true, false)
    })

    it('should handle disconnecting when target node is not found', () => {
      // Create a link with invalid target
      const graph = new LGraph()
      const link = new LLink(1, 'number', 1, 0, 999, 0) // Invalid target id

      // Should not throw when disconnecting
      expect(() => link.disconnect(graph)).not.toThrow()
    })

    it('should only clear link reference if it matches the current link id', () => {
      // Create a graph and nodes
      const graph = new LGraph()
      const sourceNode1 = new LGraphNode('Source1')
      const sourceNode2 = new LGraphNode('Source2')
      const targetNode = new LGraphNode('Target')

      // Add nodes to graph
      graph.add(sourceNode1)
      graph.add(sourceNode2)
      graph.add(targetNode)

      // Add slots
      sourceNode1.addOutput('out', 'number')
      sourceNode2.addOutput('out', 'number')
      targetNode.addInput('in', 'number')

      // Create first connection
      const link1 = sourceNode1.connect(0, targetNode, 0)
      expect(link1).toBeDefined()

      // Disconnect first connection
      targetNode.disconnectInput(0)

      // Create second connection
      const link2 = sourceNode2.connect(0, targetNode, 0)
      expect(link2).toBeDefined()
      expect(targetNode.inputs[0].link).toBe(link2?.id)

      // Try to disconnect the first link (which is already disconnected)
      // It should not affect the current connection
      link1?.disconnect(graph)

      // The input should still have the second link
      expect(targetNode.inputs[0].link).toBe(link2?.id)
    })
  })
})
