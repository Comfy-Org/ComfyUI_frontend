import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { useGraphErrorStateStore } from './graphErrorStateStore'
import type { GraphError } from './graphErrorStateStore'

describe('graphErrorStateStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('REPLACE_SOURCE command', () => {
    it('adds errors for a source', () => {
      const store = useGraphErrorStateStore()
      const errors: GraphError[] = [
        {
          key: 'frontend:slot:123:model',
          source: 'frontend',
          target: { kind: 'slot', nodeId: '123', slotName: 'model' },
          code: 'MISSING_REQUIRED_INPUT'
        }
      ]

      store.execute({ type: 'REPLACE_SOURCE', source: 'frontend', errors })

      expect(store.hasErrorsForNode('123')).toBe(true)
      expect(store.hasSlotError('123', 'model')).toBe(true)
      expect(store.version).toBe(1)
    })

    it('replaces all errors for a source', () => {
      const store = useGraphErrorStateStore()

      store.execute({
        type: 'REPLACE_SOURCE',
        source: 'frontend',
        errors: [
          {
            key: 'frontend:slot:1:a',
            source: 'frontend',
            target: { kind: 'slot', nodeId: '1', slotName: 'a' }
          },
          {
            key: 'frontend:slot:2:b',
            source: 'frontend',
            target: { kind: 'slot', nodeId: '2', slotName: 'b' }
          }
        ]
      })

      expect(store.hasErrorsForNode('1')).toBe(true)
      expect(store.hasErrorsForNode('2')).toBe(true)

      store.execute({
        type: 'REPLACE_SOURCE',
        source: 'frontend',
        errors: [
          {
            key: 'frontend:slot:3:c',
            source: 'frontend',
            target: { kind: 'slot', nodeId: '3', slotName: 'c' }
          }
        ]
      })

      expect(store.hasErrorsForNode('1')).toBe(false)
      expect(store.hasErrorsForNode('2')).toBe(false)
      expect(store.hasErrorsForNode('3')).toBe(true)
    })

    it('preserves errors from other sources', () => {
      const store = useGraphErrorStateStore()

      store.execute({
        type: 'REPLACE_SOURCE',
        source: 'backend',
        errors: [
          {
            key: 'backend:node:1',
            source: 'backend',
            target: { kind: 'node', nodeId: '1' }
          }
        ]
      })

      store.execute({
        type: 'REPLACE_SOURCE',
        source: 'frontend',
        errors: [
          {
            key: 'frontend:slot:2:a',
            source: 'frontend',
            target: { kind: 'slot', nodeId: '2', slotName: 'a' }
          }
        ]
      })

      expect(store.hasErrorsForNode('1')).toBe(true)
      expect(store.hasErrorsForNode('2')).toBe(true)
    })
  })

  describe('CLEAR_SOURCE command', () => {
    it('clears errors for a source', () => {
      const store = useGraphErrorStateStore()

      store.execute({
        type: 'REPLACE_SOURCE',
        source: 'frontend',
        errors: [
          {
            key: 'frontend:slot:1:a',
            source: 'frontend',
            target: { kind: 'slot', nodeId: '1', slotName: 'a' }
          }
        ]
      })

      store.execute({ type: 'CLEAR_SOURCE', source: 'frontend' })

      expect(store.hasErrorsForNode('1')).toBe(false)
    })

    it('preserves other sources', () => {
      const store = useGraphErrorStateStore()

      store.execute({
        type: 'REPLACE_SOURCE',
        source: 'backend',
        errors: [
          {
            key: 'backend:node:1',
            source: 'backend',
            target: { kind: 'node', nodeId: '1' }
          }
        ]
      })
      store.execute({
        type: 'REPLACE_SOURCE',
        source: 'frontend',
        errors: [
          {
            key: 'frontend:slot:2:a',
            source: 'frontend',
            target: { kind: 'slot', nodeId: '2', slotName: 'a' }
          }
        ]
      })

      store.execute({ type: 'CLEAR_SOURCE', source: 'frontend' })

      expect(store.hasErrorsForNode('1')).toBe(true)
      expect(store.hasErrorsForNode('2')).toBe(false)
    })
  })

  describe('CLEAR_ALL command', () => {
    it('clears all errors', () => {
      const store = useGraphErrorStateStore()

      store.execute({
        type: 'REPLACE_SOURCE',
        source: 'backend',
        errors: [
          {
            key: 'backend:node:1',
            source: 'backend',
            target: { kind: 'node', nodeId: '1' }
          }
        ]
      })
      store.execute({
        type: 'REPLACE_SOURCE',
        source: 'frontend',
        errors: [
          {
            key: 'frontend:slot:2:a',
            source: 'frontend',
            target: { kind: 'slot', nodeId: '2', slotName: 'a' }
          }
        ]
      })

      store.execute({ type: 'CLEAR_ALL' })

      expect(store.hasErrorsForNode('1')).toBe(false)
      expect(store.hasErrorsForNode('2')).toBe(false)
    })
  })

  describe('getErrorsForNode', () => {
    it('returns all errors for a node', () => {
      const store = useGraphErrorStateStore()

      store.execute({
        type: 'REPLACE_SOURCE',
        source: 'frontend',
        errors: [
          {
            key: 'frontend:slot:1:a',
            source: 'frontend',
            target: { kind: 'slot', nodeId: '1', slotName: 'a' }
          },
          {
            key: 'frontend:slot:1:b',
            source: 'frontend',
            target: { kind: 'slot', nodeId: '1', slotName: 'b' }
          }
        ]
      })

      const errors = store.getErrorsForNode('1')
      expect(errors).toHaveLength(2)
    })

    it('returns empty array for node without errors', () => {
      const store = useGraphErrorStateStore()
      expect(store.getErrorsForNode('999')).toEqual([])
    })
  })

  describe('getSlotErrors', () => {
    it('returns only slot errors for specific slot', () => {
      const store = useGraphErrorStateStore()

      store.execute({
        type: 'REPLACE_SOURCE',
        source: 'frontend',
        errors: [
          {
            key: 'frontend:node:1',
            source: 'frontend',
            target: { kind: 'node', nodeId: '1' }
          },
          {
            key: 'frontend:slot:1:model',
            source: 'frontend',
            target: { kind: 'slot', nodeId: '1', slotName: 'model' }
          },
          {
            key: 'frontend:slot:1:clip',
            source: 'frontend',
            target: { kind: 'slot', nodeId: '1', slotName: 'clip' }
          }
        ]
      })

      const slotErrors = store.getSlotErrors('1', 'model')
      expect(slotErrors).toHaveLength(1)
      expect(slotErrors[0].target).toEqual({
        kind: 'slot',
        nodeId: '1',
        slotName: 'model'
      })
    })
  })
})
