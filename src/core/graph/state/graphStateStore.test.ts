import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { useGraphStateStore } from './graphStateStore'

describe('graphStateStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('execute SetNodeError command', () => {
    it('sets hasError on new node', () => {
      const store = useGraphStateStore()

      store.execute({
        type: 'SetNodeError',
        version: 1,
        nodeId: '123',
        hasError: true
      })

      expect(store.getNodeState('123')?.hasError).toBe(true)
    })

    it('updates hasError on existing node', () => {
      const store = useGraphStateStore()

      store.execute({
        type: 'SetNodeError',
        version: 1,
        nodeId: '123',
        hasError: true
      })

      store.execute({
        type: 'SetNodeError',
        version: 1,
        nodeId: '123',
        hasError: false
      })

      expect(store.getNodeState('123')?.hasError).toBe(false)
    })

    it('handles subgraph node locator IDs', () => {
      const store = useGraphStateStore()

      store.execute({
        type: 'SetNodeError',
        version: 1,
        nodeId: 'uuid-123:456',
        hasError: true
      })

      expect(store.getNodeState('uuid-123:456')?.hasError).toBe(true)
    })
  })

  describe('execute ClearAllErrors command', () => {
    it('clears all error flags', () => {
      const store = useGraphStateStore()

      store.execute({
        type: 'SetNodeError',
        version: 1,
        nodeId: '1',
        hasError: true
      })
      store.execute({
        type: 'SetNodeError',
        version: 1,
        nodeId: '2',
        hasError: true
      })

      store.execute({ type: 'ClearAllErrors', version: 1 })

      expect(store.getNodeState('1')?.hasError).toBe(false)
      expect(store.getNodeState('2')?.hasError).toBe(false)
    })
  })

  describe('getNodesWithErrors', () => {
    it('returns only nodes with errors', () => {
      const store = useGraphStateStore()

      store.execute({
        type: 'SetNodeError',
        version: 1,
        nodeId: '1',
        hasError: true
      })
      store.execute({
        type: 'SetNodeError',
        version: 1,
        nodeId: '2',
        hasError: false
      })
      store.execute({
        type: 'SetNodeError',
        version: 1,
        nodeId: '3',
        hasError: true
      })

      const nodesWithErrors = store.getNodesWithErrors()

      expect(nodesWithErrors).toHaveLength(2)
      expect(nodesWithErrors).toContain('1')
      expect(nodesWithErrors).toContain('3')
      expect(nodesWithErrors).not.toContain('2')
    })
  })

  describe('stateRef reactivity', () => {
    it('increments revision on command execution', () => {
      const store = useGraphStateStore()
      const initialRevision = store.stateRef

      store.execute({
        type: 'SetNodeError',
        version: 1,
        nodeId: '1',
        hasError: true
      })

      expect(store.stateRef).not.toBe(initialRevision)
    })
  })
})
