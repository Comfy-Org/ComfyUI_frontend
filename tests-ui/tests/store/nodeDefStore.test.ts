import { LiteGraph } from '@comfyorg/litegraph'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ComfyNodeDef as ComfyNodeDefV1 } from '@/schemas/nodeDefSchema'
import { ComfyNodeDefImpl, useNodeDefStore } from '@/stores/nodeDefStore'

// Mock LiteGraph
vi.mock('@comfyorg/litegraph', async () => {
  const actual = await vi.importActual('@comfyorg/litegraph')
  return {
    ...actual,
    LiteGraph: {
      registered_node_types: {}
    }
  }
})

describe('useNodeDefStore', () => {
  let store: ReturnType<typeof useNodeDefStore>

  beforeEach(() => {
    // Set up Pinia
    setActivePinia(createPinia())
    // Create fresh store instance
    store = useNodeDefStore()
    // Clear registered node types
    LiteGraph.registered_node_types = {}
  })

  describe('updateNodeDefDisplayName', () => {
    const createTestNodeDef = (
      name: string,
      displayName: string
    ): ComfyNodeDefV1 => ({
      name,
      display_name: displayName,
      category: 'test',
      python_module: 'test_module',
      description: 'Test node',
      input: { required: {}, optional: {} },
      output: [],
      output_node: false
    })

    it('should update display name in nodeDefsByName mapping', () => {
      const nodeDef = createTestNodeDef('TestNode', 'Original Display Name')
      store.addNodeDef(nodeDef)

      store.updateNodeDefDisplayName('TestNode', 'New Display Name')

      const updatedNodeDef = store.nodeDefsByName['TestNode']
      expect(updatedNodeDef.display_name).toBe('New Display Name')
    })

    it('should update nodeDefsByDisplayName mapping', () => {
      const nodeDef = createTestNodeDef('TestNode', 'Original Display Name')
      store.addNodeDef(nodeDef)

      store.updateNodeDefDisplayName('TestNode', 'New Display Name')

      // Old display name should be removed
      expect(
        store.nodeDefsByDisplayName['Original Display Name']
      ).toBeUndefined()
      // New display name should be added
      expect(store.nodeDefsByDisplayName['New Display Name']).toBeDefined()
      expect(store.nodeDefsByDisplayName['New Display Name'].name).toBe(
        'TestNode'
      )
    })

    it('should update the object while preserving clone pattern', () => {
      const nodeDef = createTestNodeDef('TestNode', 'Original Display Name')
      store.addNodeDef(nodeDef)

      const originalRef = store.nodeDefsByName['TestNode']
      store.updateNodeDefDisplayName('TestNode', 'New Display Name')
      const updatedRef = store.nodeDefsByName['TestNode']

      // Clone creates a new reference but preserves properties
      expect(updatedRef).not.toBe(originalRef)
      expect(updatedRef.display_name).toBe('New Display Name')
      expect(updatedRef.name).toBe('TestNode')
      expect(updatedRef.category).toBe('test')
    })

    it('should update LiteGraph registered node type title', () => {
      const nodeDef = createTestNodeDef('TestNode', 'Original Display Name')
      store.addNodeDef(nodeDef)

      // Simulate a registered LiteGraph node type
      const mockNodeClass = { title: 'Original Display Name' }
      LiteGraph.registered_node_types['TestNode'] = mockNodeClass as any

      store.updateNodeDefDisplayName('TestNode', 'New Display Name')

      expect(mockNodeClass.title).toBe('New Display Name')
    })

    it('should handle non-existent node type gracefully', () => {
      // Should not throw when updating non-existent node
      expect(() => {
        store.updateNodeDefDisplayName('NonExistentNode', 'New Display Name')
      }).not.toThrow()
    })

    it('should handle missing LiteGraph registered type gracefully', () => {
      const nodeDef = createTestNodeDef('TestNode', 'Original Display Name')
      store.addNodeDef(nodeDef)

      // No registered LiteGraph type
      expect(LiteGraph.registered_node_types['TestNode']).toBeUndefined()

      // Should not throw
      expect(() => {
        store.updateNodeDefDisplayName('TestNode', 'New Display Name')
      }).not.toThrow()

      // Store should still be updated
      expect(store.nodeDefsByName['TestNode'].display_name).toBe(
        'New Display Name'
      )
    })

    it('should work with ComfyNodeDefImpl instances', () => {
      const nodeDef = createTestNodeDef('TestNode', 'Original Display Name')
      const nodeDefImpl = new ComfyNodeDefImpl(nodeDef)

      // Manually add to store mappings
      store.nodeDefsByName['TestNode'] = nodeDefImpl
      store.nodeDefsByDisplayName['Original Display Name'] = nodeDefImpl

      store.updateNodeDefDisplayName('TestNode', 'New Display Name')

      expect(store.nodeDefsByName['TestNode'].display_name).toBe(
        'New Display Name'
      )
      expect(store.nodeDefsByDisplayName['New Display Name']).toBeDefined()
    })
  })
})