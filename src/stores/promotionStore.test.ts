import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import type { NodeId } from '@/lib/litegraph/src/LGraphNode'

import { usePromotionStore } from './promotionStore'

describe('usePromotionStore', () => {
  let store: ReturnType<typeof usePromotionStore>
  const nodeId = 1 as NodeId

  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    store = usePromotionStore()
  })

  describe('getPromotions', () => {
    it('returns empty array for unknown node', () => {
      expect(store.getPromotions(nodeId)).toEqual([])
    })

    it('returns entries after setPromotions', () => {
      const entries = [
        { interiorNodeId: '10', widgetName: 'seed' },
        { interiorNodeId: '11', widgetName: 'steps' }
      ]
      store.setPromotions(nodeId, entries)
      expect(store.getPromotions(nodeId)).toEqual(entries)
    })
  })

  describe('isPromoted', () => {
    it('returns false when nothing is promoted', () => {
      expect(store.isPromoted(nodeId, '10', 'seed')).toBe(false)
    })

    it('returns true for a promoted entry', () => {
      store.promote(nodeId, '10', 'seed')
      expect(store.isPromoted(nodeId, '10', 'seed')).toBe(true)
    })

    it('returns false for a different widget on the same node', () => {
      store.promote(nodeId, '10', 'seed')
      expect(store.isPromoted(nodeId, '10', 'steps')).toBe(false)
    })
  })

  describe('isPromotedByAny', () => {
    const nodeA = 1 as NodeId
    const nodeB = 2 as NodeId

    it('returns false when nothing is promoted', () => {
      expect(store.isPromotedByAny('10', 'seed')).toBe(false)
    })

    it('returns true when promoted by one parent', () => {
      store.promote(nodeA, '10', 'seed')
      expect(store.isPromotedByAny('10', 'seed')).toBe(true)
    })

    it('returns true when promoted by multiple parents', () => {
      store.promote(nodeA, '10', 'seed')
      store.promote(nodeB, '10', 'seed')
      expect(store.isPromotedByAny('10', 'seed')).toBe(true)
    })

    it('returns false after demoting from all parents', () => {
      store.promote(nodeA, '10', 'seed')
      store.promote(nodeB, '10', 'seed')
      store.demote(nodeA, '10', 'seed')
      store.demote(nodeB, '10', 'seed')
      expect(store.isPromotedByAny('10', 'seed')).toBe(false)
    })

    it('returns true when still promoted by one parent after partial demote', () => {
      store.promote(nodeA, '10', 'seed')
      store.promote(nodeB, '10', 'seed')
      store.demote(nodeA, '10', 'seed')
      expect(store.isPromotedByAny('10', 'seed')).toBe(true)
    })

    it('returns false for different widget on same node', () => {
      store.promote(nodeA, '10', 'seed')
      expect(store.isPromotedByAny('10', 'steps')).toBe(false)
    })
  })

  describe('setPromotions', () => {
    it('replaces existing entries', () => {
      store.promote(nodeId, '10', 'seed')
      store.setPromotions(nodeId, [
        { interiorNodeId: '11', widgetName: 'steps' }
      ])
      expect(store.isPromoted(nodeId, '10', 'seed')).toBe(false)
      expect(store.isPromoted(nodeId, '11', 'steps')).toBe(true)
    })

    it('clears entries when set to empty array', () => {
      store.promote(nodeId, '10', 'seed')
      store.setPromotions(nodeId, [])
      expect(store.getPromotions(nodeId)).toEqual([])
    })

    it('preserves order', () => {
      const entries = [
        { interiorNodeId: '10', widgetName: 'seed' },
        { interiorNodeId: '11', widgetName: 'steps' },
        { interiorNodeId: '12', widgetName: 'cfg' }
      ]
      store.setPromotions(nodeId, entries)
      expect(store.getPromotions(nodeId)).toEqual(entries)
    })
  })

  describe('promote', () => {
    it('adds a new entry', () => {
      store.promote(nodeId, '10', 'seed')
      expect(store.getPromotions(nodeId)).toHaveLength(1)
    })

    it('does not duplicate existing entries', () => {
      store.promote(nodeId, '10', 'seed')
      store.promote(nodeId, '10', 'seed')
      expect(store.getPromotions(nodeId)).toHaveLength(1)
    })

    it('appends to existing entries', () => {
      store.promote(nodeId, '10', 'seed')
      store.promote(nodeId, '11', 'steps')
      expect(store.getPromotions(nodeId)).toHaveLength(2)
    })
  })

  describe('demote', () => {
    it('removes an existing entry', () => {
      store.promote(nodeId, '10', 'seed')
      store.demote(nodeId, '10', 'seed')
      expect(store.getPromotions(nodeId)).toEqual([])
    })

    it('is a no-op for non-existent entries', () => {
      store.promote(nodeId, '10', 'seed')
      store.demote(nodeId, '99', 'nonexistent')
      expect(store.getPromotions(nodeId)).toHaveLength(1)
    })

    it('preserves other entries', () => {
      store.promote(nodeId, '10', 'seed')
      store.promote(nodeId, '11', 'steps')
      store.demote(nodeId, '10', 'seed')
      expect(store.getPromotions(nodeId)).toEqual([
        { interiorNodeId: '11', widgetName: 'steps' }
      ])
    })
  })

  describe('movePromotion', () => {
    it('moves an entry from one index to another', () => {
      store.promote(nodeId, '10', 'seed')
      store.promote(nodeId, '11', 'steps')
      store.promote(nodeId, '12', 'cfg')
      store.movePromotion(nodeId, 0, 2)
      expect(store.getPromotions(nodeId)).toEqual([
        { interiorNodeId: '11', widgetName: 'steps' },
        { interiorNodeId: '12', widgetName: 'cfg' },
        { interiorNodeId: '10', widgetName: 'seed' }
      ])
    })

    it('is a no-op for out-of-bounds indices', () => {
      store.promote(nodeId, '10', 'seed')
      store.movePromotion(nodeId, 0, 5)
      expect(store.getPromotions(nodeId)).toEqual([
        { interiorNodeId: '10', widgetName: 'seed' }
      ])
    })

    it('is a no-op when fromIndex equals toIndex', () => {
      store.promote(nodeId, '10', 'seed')
      store.promote(nodeId, '11', 'steps')
      store.movePromotion(nodeId, 1, 1)
      expect(store.getPromotions(nodeId)).toEqual([
        { interiorNodeId: '10', widgetName: 'seed' },
        { interiorNodeId: '11', widgetName: 'steps' }
      ])
    })
  })

  describe('multi-node isolation', () => {
    const nodeA = 1 as NodeId
    const nodeB = 2 as NodeId

    it('keeps promotions separate per subgraph node', () => {
      store.promote(nodeA, '10', 'seed')
      store.promote(nodeB, '20', 'cfg')

      expect(store.getPromotions(nodeA)).toEqual([
        { interiorNodeId: '10', widgetName: 'seed' }
      ])
      expect(store.getPromotions(nodeB)).toEqual([
        { interiorNodeId: '20', widgetName: 'cfg' }
      ])
    })

    it('demoting from one node does not affect another', () => {
      store.promote(nodeA, '10', 'seed')
      store.promote(nodeB, '10', 'seed')
      store.demote(nodeA, '10', 'seed')

      expect(store.isPromoted(nodeA, '10', 'seed')).toBe(false)
      expect(store.isPromoted(nodeB, '10', 'seed')).toBe(true)
    })
  })
})
