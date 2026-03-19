import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import type { NodeId } from '@/lib/litegraph/src/LGraphNode'
import type { UUID } from '@/lib/litegraph/src/utils/uuid'

import { usePromotionStore } from './promotionStore'

describe(usePromotionStore, () => {
  let store: ReturnType<typeof usePromotionStore>
  const graphA = 'graph-a' as UUID
  const graphB = 'graph-b' as UUID
  const nodeId = 1 as NodeId

  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    store = usePromotionStore()
  })

  describe('getPromotions', () => {
    it('returns empty array for unknown node', () => {
      expect(store.getPromotions(graphA, nodeId)).toEqual([])
    })

    it('returns a stable empty ref for unknown node', () => {
      const first = store.getPromotionsRef(graphA, nodeId)
      const second = store.getPromotionsRef(graphA, nodeId)

      expect(second).toBe(first)
    })

    it('returns entries after setPromotions', () => {
      const entries = [
        { interiorNodeId: '10', widgetName: 'seed' },
        { interiorNodeId: '11', widgetName: 'steps' }
      ]
      store.setPromotions(graphA, nodeId, entries)
      expect(store.getPromotions(graphA, nodeId)).toEqual(entries)
    })

    it('returns a defensive copy', () => {
      store.setPromotions(graphA, nodeId, [
        { interiorNodeId: '10', widgetName: 'seed' }
      ])

      const result = store.getPromotions(graphA, nodeId)
      result.push({ interiorNodeId: '11', widgetName: 'steps' })

      expect(store.getPromotions(graphA, nodeId)).toEqual([
        { interiorNodeId: '10', widgetName: 'seed' }
      ])
    })
  })

  describe('isPromoted', () => {
    it('returns false when nothing is promoted', () => {
      expect(store.isPromoted(graphA, nodeId, '10', 'seed')).toBe(false)
    })

    it('returns true for a promoted entry', () => {
      store.promote(graphA, nodeId, '10', 'seed')
      expect(store.isPromoted(graphA, nodeId, '10', 'seed')).toBe(true)
    })

    it('returns false for a different widget on the same node', () => {
      store.promote(graphA, nodeId, '10', 'seed')
      expect(store.isPromoted(graphA, nodeId, '10', 'steps')).toBe(false)
    })
  })

  describe('isPromotedByAny', () => {
    const nodeA = 1 as NodeId
    const nodeB = 2 as NodeId

    it('returns false when nothing is promoted', () => {
      expect(store.isPromotedByAny(graphA, '10', 'seed')).toBe(false)
    })

    it('returns true when promoted by one parent', () => {
      store.promote(graphA, nodeA, '10', 'seed')
      expect(store.isPromotedByAny(graphA, '10', 'seed')).toBe(true)
    })

    it('returns true when promoted by multiple parents', () => {
      store.promote(graphA, nodeA, '10', 'seed')
      store.promote(graphA, nodeB, '10', 'seed')
      expect(store.isPromotedByAny(graphA, '10', 'seed')).toBe(true)
    })

    it('returns false after demoting from all parents', () => {
      store.promote(graphA, nodeA, '10', 'seed')
      store.promote(graphA, nodeB, '10', 'seed')
      store.demote(graphA, nodeA, '10', 'seed')
      store.demote(graphA, nodeB, '10', 'seed')
      expect(store.isPromotedByAny(graphA, '10', 'seed')).toBe(false)
    })

    it('returns true when still promoted by one parent after partial demote', () => {
      store.promote(graphA, nodeA, '10', 'seed')
      store.promote(graphA, nodeB, '10', 'seed')
      store.demote(graphA, nodeA, '10', 'seed')
      expect(store.isPromotedByAny(graphA, '10', 'seed')).toBe(true)
    })

    it('returns false for different widget on same node', () => {
      store.promote(graphA, nodeA, '10', 'seed')
      expect(store.isPromotedByAny(graphA, '10', 'steps')).toBe(false)
    })
  })

  describe('setPromotions', () => {
    it('replaces existing entries', () => {
      store.promote(graphA, nodeId, '10', 'seed')
      store.setPromotions(graphA, nodeId, [
        { interiorNodeId: '11', widgetName: 'steps' }
      ])
      expect(store.isPromoted(graphA, nodeId, '10', 'seed')).toBe(false)
      expect(store.isPromoted(graphA, nodeId, '11', 'steps')).toBe(true)
    })

    it('clears entries when set to empty array', () => {
      store.promote(graphA, nodeId, '10', 'seed')
      store.setPromotions(graphA, nodeId, [])
      expect(store.getPromotions(graphA, nodeId)).toEqual([])
    })

    it('preserves order', () => {
      const entries = [
        { interiorNodeId: '10', widgetName: 'seed' },
        { interiorNodeId: '11', widgetName: 'steps' },
        { interiorNodeId: '12', widgetName: 'cfg' }
      ]
      store.setPromotions(graphA, nodeId, entries)
      expect(store.getPromotions(graphA, nodeId)).toEqual(entries)
    })
  })

  describe('promote', () => {
    it('adds a new entry', () => {
      store.promote(graphA, nodeId, '10', 'seed')
      expect(store.getPromotions(graphA, nodeId)).toHaveLength(1)
    })

    it('does not duplicate existing entries', () => {
      store.promote(graphA, nodeId, '10', 'seed')
      store.promote(graphA, nodeId, '10', 'seed')
      expect(store.getPromotions(graphA, nodeId)).toHaveLength(1)
    })

    it('appends to existing entries', () => {
      store.promote(graphA, nodeId, '10', 'seed')
      store.promote(graphA, nodeId, '11', 'steps')
      expect(store.getPromotions(graphA, nodeId)).toHaveLength(2)
    })
  })

  describe('demote', () => {
    it('removes an existing entry', () => {
      store.promote(graphA, nodeId, '10', 'seed')
      store.demote(graphA, nodeId, '10', 'seed')
      expect(store.getPromotions(graphA, nodeId)).toEqual([])
    })

    it('is a no-op for non-existent entries', () => {
      store.promote(graphA, nodeId, '10', 'seed')
      store.demote(graphA, nodeId, '99', 'nonexistent')
      expect(store.getPromotions(graphA, nodeId)).toHaveLength(1)
    })

    it('preserves other entries', () => {
      store.promote(graphA, nodeId, '10', 'seed')
      store.promote(graphA, nodeId, '11', 'steps')
      store.demote(graphA, nodeId, '10', 'seed')
      expect(store.getPromotions(graphA, nodeId)).toEqual([
        { interiorNodeId: '11', widgetName: 'steps' }
      ])
    })
  })

  describe('movePromotion', () => {
    it('moves an entry from one index to another', () => {
      store.promote(graphA, nodeId, '10', 'seed')
      store.promote(graphA, nodeId, '11', 'steps')
      store.promote(graphA, nodeId, '12', 'cfg')
      store.movePromotion(graphA, nodeId, 0, 2)
      expect(store.getPromotions(graphA, nodeId)).toEqual([
        { interiorNodeId: '11', widgetName: 'steps' },
        { interiorNodeId: '12', widgetName: 'cfg' },
        { interiorNodeId: '10', widgetName: 'seed' }
      ])
    })

    it('is a no-op for out-of-bounds indices', () => {
      store.promote(graphA, nodeId, '10', 'seed')
      store.movePromotion(graphA, nodeId, 0, 5)
      expect(store.getPromotions(graphA, nodeId)).toEqual([
        { interiorNodeId: '10', widgetName: 'seed' }
      ])
    })

    it('is a no-op when fromIndex equals toIndex', () => {
      store.promote(graphA, nodeId, '10', 'seed')
      store.promote(graphA, nodeId, '11', 'steps')
      store.movePromotion(graphA, nodeId, 1, 1)
      expect(store.getPromotions(graphA, nodeId)).toEqual([
        { interiorNodeId: '10', widgetName: 'seed' },
        { interiorNodeId: '11', widgetName: 'steps' }
      ])
    })
  })

  describe('ref-counted isPromotedByAny', () => {
    const nodeA = 1 as NodeId
    const nodeB = 2 as NodeId

    it('tracks across setPromotions calls', () => {
      store.setPromotions(graphA, nodeA, [
        { interiorNodeId: '10', widgetName: 'seed' }
      ])
      expect(store.isPromotedByAny(graphA, '10', 'seed')).toBe(true)

      store.setPromotions(graphA, nodeB, [
        { interiorNodeId: '10', widgetName: 'seed' }
      ])
      expect(store.isPromotedByAny(graphA, '10', 'seed')).toBe(true)

      // Remove from A — still promoted by B
      store.setPromotions(graphA, nodeA, [])
      expect(store.isPromotedByAny(graphA, '10', 'seed')).toBe(true)

      // Remove from B — now gone
      store.setPromotions(graphA, nodeB, [])
      expect(store.isPromotedByAny(graphA, '10', 'seed')).toBe(false)
    })

    it('handles replacement via setPromotions correctly', () => {
      store.setPromotions(graphA, nodeA, [
        { interiorNodeId: '10', widgetName: 'seed' },
        { interiorNodeId: '11', widgetName: 'steps' }
      ])
      expect(store.isPromotedByAny(graphA, '10', 'seed')).toBe(true)
      expect(store.isPromotedByAny(graphA, '11', 'steps')).toBe(true)

      // Replace with different entries
      store.setPromotions(graphA, nodeA, [
        { interiorNodeId: '11', widgetName: 'steps' },
        { interiorNodeId: '12', widgetName: 'cfg' }
      ])
      expect(store.isPromotedByAny(graphA, '10', 'seed')).toBe(false)
      expect(store.isPromotedByAny(graphA, '11', 'steps')).toBe(true)
      expect(store.isPromotedByAny(graphA, '12', 'cfg')).toBe(true)
    })

    it('stays consistent through movePromotion', () => {
      store.promote(graphA, nodeA, '10', 'seed')
      store.promote(graphA, nodeA, '11', 'steps')
      store.movePromotion(graphA, nodeA, 0, 1)
      expect(store.isPromotedByAny(graphA, '10', 'seed')).toBe(true)
      expect(store.isPromotedByAny(graphA, '11', 'steps')).toBe(true)
    })
  })

  describe('multi-node isolation', () => {
    const nodeA = 1 as NodeId
    const nodeB = 2 as NodeId

    it('keeps promotions separate per subgraph node', () => {
      store.promote(graphA, nodeA, '10', 'seed')
      store.promote(graphA, nodeB, '20', 'cfg')

      expect(store.getPromotions(graphA, nodeA)).toEqual([
        { interiorNodeId: '10', widgetName: 'seed' }
      ])
      expect(store.getPromotions(graphA, nodeB)).toEqual([
        { interiorNodeId: '20', widgetName: 'cfg' }
      ])
    })

    it('demoting from one node does not affect another', () => {
      store.promote(graphA, nodeA, '10', 'seed')
      store.promote(graphA, nodeB, '10', 'seed')
      store.demote(graphA, nodeA, '10', 'seed')

      expect(store.isPromoted(graphA, nodeA, '10', 'seed')).toBe(false)
      expect(store.isPromoted(graphA, nodeB, '10', 'seed')).toBe(true)
    })
  })

  describe('clearGraph resets ref counts', () => {
    const nodeA = 1 as NodeId
    const nodeB = 2 as NodeId

    it('resets isPromotedByAny after clearGraph', () => {
      store.promote(graphA, nodeA, '10', 'seed')
      store.promote(graphA, nodeB, '11', 'steps')
      expect(store.isPromotedByAny(graphA, '10', 'seed')).toBe(true)
      expect(store.isPromotedByAny(graphA, '11', 'steps')).toBe(true)

      store.clearGraph(graphA)

      expect(store.isPromotedByAny(graphA, '10', 'seed')).toBe(false)
      expect(store.isPromotedByAny(graphA, '11', 'steps')).toBe(false)
    })
  })

  describe('setPromotions idempotency', () => {
    it('does not double ref counts when called twice with same entries', () => {
      const entries = [
        { interiorNodeId: '10', widgetName: 'seed' },
        { interiorNodeId: '11', widgetName: 'steps' }
      ]
      store.setPromotions(graphA, nodeId, entries)
      store.setPromotions(graphA, nodeId, entries)

      expect(store.isPromotedByAny(graphA, '10', 'seed')).toBe(true)
      expect(store.isPromotedByAny(graphA, '11', 'steps')).toBe(true)

      store.setPromotions(graphA, nodeId, [])

      expect(store.isPromotedByAny(graphA, '10', 'seed')).toBe(false)
      expect(store.isPromotedByAny(graphA, '11', 'steps')).toBe(false)
    })
  })

  describe('promote/demote interleaved with setPromotions', () => {
    it('maintains consistent ref counts through mixed operations', () => {
      const nodeA = 1 as NodeId

      store.promote(graphA, nodeA, '10', 'seed')
      expect(store.isPromotedByAny(graphA, '10', 'seed')).toBe(true)

      store.setPromotions(graphA, nodeA, [
        { interiorNodeId: '10', widgetName: 'seed' },
        { interiorNodeId: '11', widgetName: 'steps' }
      ])
      expect(store.isPromotedByAny(graphA, '10', 'seed')).toBe(true)
      expect(store.isPromotedByAny(graphA, '11', 'steps')).toBe(true)

      store.demote(graphA, nodeA, '10', 'seed')

      expect(store.isPromotedByAny(graphA, '10', 'seed')).toBe(false)
      expect(store.isPromotedByAny(graphA, '11', 'steps')).toBe(true)
    })
  })

  describe('graph isolation', () => {
    it('isolates promotions by graph id', () => {
      store.promote(graphA, nodeId, '10', 'seed')
      store.promote(graphB, nodeId, '20', 'steps')

      expect(store.getPromotions(graphA, nodeId)).toEqual([
        { interiorNodeId: '10', widgetName: 'seed' }
      ])
      expect(store.getPromotions(graphB, nodeId)).toEqual([
        { interiorNodeId: '20', widgetName: 'steps' }
      ])
    })

    it('clearGraph only removes one graph namespace', () => {
      store.promote(graphA, nodeId, '10', 'seed')
      store.promote(graphB, nodeId, '20', 'steps')

      store.clearGraph(graphA)

      expect(store.getPromotions(graphA, nodeId)).toEqual([])
      expect(store.getPromotions(graphB, nodeId)).toEqual([
        { interiorNodeId: '20', widgetName: 'steps' }
      ])
      expect(store.isPromotedByAny(graphA, '10', 'seed')).toBe(false)
      expect(store.isPromotedByAny(graphB, '20', 'steps')).toBe(true)
    })
  })

  describe('sourceNodeId disambiguation', () => {
    it('promote with sourceNodeId is found by matching isPromoted', () => {
      store.promote(graphA, nodeId, '10', 'text', '99')
      expect(store.isPromoted(graphA, nodeId, '10', 'text', '99')).toBe(true)
    })

    it('isPromoted with different sourceNodeId returns false', () => {
      store.promote(graphA, nodeId, '10', 'text', '99')
      expect(store.isPromoted(graphA, nodeId, '10', 'text', '88')).toBe(false)
    })

    it('isPromoted with undefined sourceNodeId does not match entry with sourceNodeId', () => {
      store.promote(graphA, nodeId, '10', 'text', '99')
      expect(store.isPromoted(graphA, nodeId, '10', 'text')).toBe(false)
    })

    it('two entries with same interiorNodeId/widgetName but different sourceNodeId coexist', () => {
      store.promote(graphA, nodeId, '3', 'text', '1')
      store.promote(graphA, nodeId, '3', 'text', '2')
      expect(store.getPromotions(graphA, nodeId)).toHaveLength(2)
      expect(store.isPromoted(graphA, nodeId, '3', 'text', '1')).toBe(true)
      expect(store.isPromoted(graphA, nodeId, '3', 'text', '2')).toBe(true)
    })

    it('demote with sourceNodeId removes only matching entry', () => {
      store.promote(graphA, nodeId, '3', 'text', '1')
      store.promote(graphA, nodeId, '3', 'text', '2')
      store.demote(graphA, nodeId, '3', 'text', '1')
      expect(store.getPromotions(graphA, nodeId)).toHaveLength(1)
      expect(store.isPromoted(graphA, nodeId, '3', 'text', '1')).toBe(false)
      expect(store.isPromoted(graphA, nodeId, '3', 'text', '2')).toBe(true)
    })

    it('isPromotedByAny with sourceNodeId only matches keyed entries', () => {
      store.promote(graphA, nodeId, '3', 'text', '1')
      expect(store.isPromotedByAny(graphA, '3', 'text', '1')).toBe(true)
      expect(store.isPromotedByAny(graphA, '3', 'text', '2')).toBe(false)
      expect(store.isPromotedByAny(graphA, '3', 'text')).toBe(false)
    })

    it('setPromotions with sourceNodeId entries maintains correct ref-counts', () => {
      const nodeA = 1 as NodeId
      const nodeB = 2 as NodeId
      store.setPromotions(graphA, nodeA, [
        { interiorNodeId: '3', widgetName: 'text', sourceNodeId: '1' }
      ])
      store.setPromotions(graphA, nodeB, [
        { interiorNodeId: '3', widgetName: 'text', sourceNodeId: '1' }
      ])
      expect(store.isPromotedByAny(graphA, '3', 'text', '1')).toBe(true)

      store.setPromotions(graphA, nodeA, [])
      expect(store.isPromotedByAny(graphA, '3', 'text', '1')).toBe(true)

      store.setPromotions(graphA, nodeB, [])
      expect(store.isPromotedByAny(graphA, '3', 'text', '1')).toBe(false)
    })
  })
})
