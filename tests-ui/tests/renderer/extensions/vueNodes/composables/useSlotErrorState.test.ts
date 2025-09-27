import { beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'

import { useSlotErrorState } from '@/renderer/extensions/vueNodes/composables/useSlotErrorState'

describe('useSlotErrorState', () => {
  let slotErrorState: ReturnType<typeof useSlotErrorState>

  beforeEach(() => {
    slotErrorState = useSlotErrorState()
    // Clear all errors before each test
    slotErrorState.clearAllErrors()
  })

  describe('setSlotError and hasSlotError', () => {
    it('should set and retrieve input slot error state', async () => {
      const nodeId = 'node-123'
      const slotIndex = 0
      const slotType = 'input' as const

      // Initially no error
      expect(slotErrorState.hasSlotError(nodeId, slotIndex, slotType)).toBe(
        false
      )

      // Set error
      slotErrorState.setSlotError(nodeId, slotIndex, slotType, true)
      await nextTick()

      // Should have error
      expect(slotErrorState.hasSlotError(nodeId, slotIndex, slotType)).toBe(
        true
      )
    })

    it('should set and retrieve output slot error state', async () => {
      const nodeId = 'node-456'
      const slotIndex = 1
      const slotType = 'output' as const

      // Initially no error
      expect(slotErrorState.hasSlotError(nodeId, slotIndex, slotType)).toBe(
        false
      )

      // Set error
      slotErrorState.setSlotError(nodeId, slotIndex, slotType, true)
      await nextTick()

      // Should have error
      expect(slotErrorState.hasSlotError(nodeId, slotIndex, slotType)).toBe(
        true
      )
    })

    it('should clear error when set to false', async () => {
      const nodeId = 'node-789'
      const slotIndex = 2
      const slotType = 'input' as const

      // Set error
      slotErrorState.setSlotError(nodeId, slotIndex, slotType, true)
      expect(slotErrorState.hasSlotError(nodeId, slotIndex, slotType)).toBe(
        true
      )

      // Clear error
      slotErrorState.setSlotError(nodeId, slotIndex, slotType, false)
      await nextTick()

      // Should not have error
      expect(slotErrorState.hasSlotError(nodeId, slotIndex, slotType)).toBe(
        false
      )
    })

    it('should handle multiple slots for same node', async () => {
      const nodeId = 'node-multi'

      // Set errors on different slots
      slotErrorState.setSlotError(nodeId, 0, 'input', true)
      slotErrorState.setSlotError(nodeId, 1, 'input', true)
      slotErrorState.setSlotError(nodeId, 0, 'output', true)

      await nextTick()

      // All should have errors
      expect(slotErrorState.hasSlotError(nodeId, 0, 'input')).toBe(true)
      expect(slotErrorState.hasSlotError(nodeId, 1, 'input')).toBe(true)
      expect(slotErrorState.hasSlotError(nodeId, 0, 'output')).toBe(true)

      // Other slots should not have errors
      expect(slotErrorState.hasSlotError(nodeId, 2, 'input')).toBe(false)
      expect(slotErrorState.hasSlotError(nodeId, 1, 'output')).toBe(false)
    })

    it('should handle multiple nodes independently', async () => {
      const nodeId1 = 'node-1'
      const nodeId2 = 'node-2'

      // Set errors on different nodes
      slotErrorState.setSlotError(nodeId1, 0, 'input', true)
      slotErrorState.setSlotError(nodeId2, 0, 'input', true)

      await nextTick()

      // Both should have errors
      expect(slotErrorState.hasSlotError(nodeId1, 0, 'input')).toBe(true)
      expect(slotErrorState.hasSlotError(nodeId2, 0, 'input')).toBe(true)

      // Clear error on first node only
      slotErrorState.setSlotError(nodeId1, 0, 'input', false)
      await nextTick()

      // First node should not have error, second should still have error
      expect(slotErrorState.hasSlotError(nodeId1, 0, 'input')).toBe(false)
      expect(slotErrorState.hasSlotError(nodeId2, 0, 'input')).toBe(true)
    })
  })

  describe('clearNodeErrors', () => {
    it('should clear all errors for a specific node', async () => {
      const nodeId = 'node-clear'

      // Set multiple errors for the node
      slotErrorState.setSlotError(nodeId, 0, 'input', true)
      slotErrorState.setSlotError(nodeId, 1, 'input', true)
      slotErrorState.setSlotError(nodeId, 0, 'output', true)

      // Also set error for different node
      slotErrorState.setSlotError('other-node', 0, 'input', true)

      await nextTick()

      // Verify errors are set
      expect(slotErrorState.hasSlotError(nodeId, 0, 'input')).toBe(true)
      expect(slotErrorState.hasSlotError(nodeId, 1, 'input')).toBe(true)
      expect(slotErrorState.hasSlotError(nodeId, 0, 'output')).toBe(true)
      expect(slotErrorState.hasSlotError('other-node', 0, 'input')).toBe(true)

      // Clear errors for specific node
      slotErrorState.clearNodeErrors(nodeId)
      await nextTick()

      // Errors for specific node should be cleared
      expect(slotErrorState.hasSlotError(nodeId, 0, 'input')).toBe(false)
      expect(slotErrorState.hasSlotError(nodeId, 1, 'input')).toBe(false)
      expect(slotErrorState.hasSlotError(nodeId, 0, 'output')).toBe(false)

      // Other node should still have error
      expect(slotErrorState.hasSlotError('other-node', 0, 'input')).toBe(true)
    })
  })

  describe('clearAllErrors', () => {
    it('should clear all errors across all nodes', async () => {
      // Set errors on multiple nodes
      slotErrorState.setSlotError('node-1', 0, 'input', true)
      slotErrorState.setSlotError('node-1', 1, 'input', true)
      slotErrorState.setSlotError('node-2', 0, 'output', true)
      slotErrorState.setSlotError('node-3', 2, 'input', true)

      await nextTick()

      // Verify errors are set
      expect(slotErrorState.hasSlotError('node-1', 0, 'input')).toBe(true)
      expect(slotErrorState.hasSlotError('node-1', 1, 'input')).toBe(true)
      expect(slotErrorState.hasSlotError('node-2', 0, 'output')).toBe(true)
      expect(slotErrorState.hasSlotError('node-3', 2, 'input')).toBe(true)

      // Clear all errors
      slotErrorState.clearAllErrors()
      await nextTick()

      // All errors should be cleared
      expect(slotErrorState.hasSlotError('node-1', 0, 'input')).toBe(false)
      expect(slotErrorState.hasSlotError('node-1', 1, 'input')).toBe(false)
      expect(slotErrorState.hasSlotError('node-2', 0, 'output')).toBe(false)
      expect(slotErrorState.hasSlotError('node-3', 2, 'input')).toBe(false)
    })
  })

  describe('reactive state', () => {
    it('should provide readonly reactive state', () => {
      // The slotErrorState should be readonly - this is enforced by TypeScript
      // We can verify it's readonly by checking the property exists and is a Map
      expect(slotErrorState.slotErrorState).toBeInstanceOf(Map)
      expect(slotErrorState.slotErrorState.size).toBe(0)
    })

    it('should update reactive state when errors change', async () => {
      const nodeId = 'reactive-test'
      const slotIndex = 0
      const slotType = 'input' as const

      // Initially empty
      expect(slotErrorState.slotErrorState.size).toBe(0)

      // Add error
      slotErrorState.setSlotError(nodeId, slotIndex, slotType, true)
      await nextTick()

      // State should contain the error
      expect(slotErrorState.slotErrorState.size).toBe(1)
      expect(
        slotErrorState.slotErrorState.has(`${nodeId}-${slotType}-${slotIndex}`)
      ).toBe(true)

      // Clear error
      slotErrorState.setSlotError(nodeId, slotIndex, slotType, false)
      await nextTick()

      // State should be empty again
      expect(slotErrorState.slotErrorState.size).toBe(0)
    })
  })

  describe('edge cases', () => {
    it('should handle empty node IDs gracefully', () => {
      expect(slotErrorState.hasSlotError('', 0, 'input')).toBe(false)

      slotErrorState.setSlotError('', 0, 'input', true)
      expect(slotErrorState.hasSlotError('', 0, 'input')).toBe(true)
    })

    it('should handle negative slot indices', () => {
      const nodeId = 'test-node'

      expect(slotErrorState.hasSlotError(nodeId, -1, 'input')).toBe(false)

      slotErrorState.setSlotError(nodeId, -1, 'input', true)
      expect(slotErrorState.hasSlotError(nodeId, -1, 'input')).toBe(true)
    })

    it('should handle large slot indices', () => {
      const nodeId = 'test-node'
      const largeIndex = 999999

      expect(slotErrorState.hasSlotError(nodeId, largeIndex, 'output')).toBe(
        false
      )

      slotErrorState.setSlotError(nodeId, largeIndex, 'output', true)
      expect(slotErrorState.hasSlotError(nodeId, largeIndex, 'output')).toBe(
        true
      )
    })
  })
})
