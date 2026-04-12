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
        { sourceNodeId: '10', sourceWidgetName: 'seed' },
        { sourceNodeId: '11', sourceWidgetName: 'steps' }
      ]
      store.setPromotions(graphA, nodeId, entries)
      expect(store.getPromotions(graphA, nodeId)).toEqual(entries)
    })

    it('returns a defensive copy', () => {
      store.setPromotions(graphA, nodeId, [
        { sourceNodeId: '10', sourceWidgetName: 'seed' }
      ])

      const result = store.getPromotions(graphA, nodeId)
      result.push({ sourceNodeId: '11', sourceWidgetName: 'steps' })

      expect(store.getPromotions(graphA, nodeId)).toEqual([
        { sourceNodeId: '10', sourceWidgetName: 'seed' }
      ])
    })
  })

  describe('isPromoted', () => {
    it('returns false when nothing is promoted', () => {
      expect(
        store.isPromoted(graphA, nodeId, {
          sourceNodeId: '10',
          sourceWidgetName: 'seed'
        })
      ).toBe(false)
    })

    it('returns true for a promoted entry', () => {
      store.promote(graphA, nodeId, {
        sourceNodeId: '10',
        sourceWidgetName: 'seed'
      })
      expect(
        store.isPromoted(graphA, nodeId, {
          sourceNodeId: '10',
          sourceWidgetName: 'seed'
        })
      ).toBe(true)
    })

    it('returns false for a different widget on the same node', () => {
      store.promote(graphA, nodeId, {
        sourceNodeId: '10',
        sourceWidgetName: 'seed'
      })
      expect(
        store.isPromoted(graphA, nodeId, {
          sourceNodeId: '10',
          sourceWidgetName: 'steps'
        })
      ).toBe(false)
    })
  })

  describe('isPromotedByAny', () => {
    const nodeA = 1 as NodeId
    const nodeB = 2 as NodeId

    it('returns false when nothing is promoted', () => {
      expect(
        store.isPromotedByAny(graphA, {
          sourceNodeId: '10',
          sourceWidgetName: 'seed'
        })
      ).toBe(false)
    })

    it('returns true when promoted by one parent', () => {
      store.promote(graphA, nodeA, {
        sourceNodeId: '10',
        sourceWidgetName: 'seed'
      })
      expect(
        store.isPromotedByAny(graphA, {
          sourceNodeId: '10',
          sourceWidgetName: 'seed'
        })
      ).toBe(true)
    })

    it('returns true when promoted by multiple parents', () => {
      store.promote(graphA, nodeA, {
        sourceNodeId: '10',
        sourceWidgetName: 'seed'
      })
      store.promote(graphA, nodeB, {
        sourceNodeId: '10',
        sourceWidgetName: 'seed'
      })
      expect(
        store.isPromotedByAny(graphA, {
          sourceNodeId: '10',
          sourceWidgetName: 'seed'
        })
      ).toBe(true)
    })

    it('returns false after demoting from all parents', () => {
      store.promote(graphA, nodeA, {
        sourceNodeId: '10',
        sourceWidgetName: 'seed'
      })
      store.promote(graphA, nodeB, {
        sourceNodeId: '10',
        sourceWidgetName: 'seed'
      })
      store.demote(graphA, nodeA, {
        sourceNodeId: '10',
        sourceWidgetName: 'seed'
      })
      store.demote(graphA, nodeB, {
        sourceNodeId: '10',
        sourceWidgetName: 'seed'
      })
      expect(
        store.isPromotedByAny(graphA, {
          sourceNodeId: '10',
          sourceWidgetName: 'seed'
        })
      ).toBe(false)
    })

    it('returns true when still promoted by one parent after partial demote', () => {
      store.promote(graphA, nodeA, {
        sourceNodeId: '10',
        sourceWidgetName: 'seed'
      })
      store.promote(graphA, nodeB, {
        sourceNodeId: '10',
        sourceWidgetName: 'seed'
      })
      store.demote(graphA, nodeA, {
        sourceNodeId: '10',
        sourceWidgetName: 'seed'
      })
      expect(
        store.isPromotedByAny(graphA, {
          sourceNodeId: '10',
          sourceWidgetName: 'seed'
        })
      ).toBe(true)
    })

    it('returns false for different widget on same node', () => {
      store.promote(graphA, nodeA, {
        sourceNodeId: '10',
        sourceWidgetName: 'seed'
      })
      expect(
        store.isPromotedByAny(graphA, {
          sourceNodeId: '10',
          sourceWidgetName: 'steps'
        })
      ).toBe(false)
    })
  })

  describe('setPromotions', () => {
    it('replaces existing entries', () => {
      store.promote(graphA, nodeId, {
        sourceNodeId: '10',
        sourceWidgetName: 'seed'
      })
      store.setPromotions(graphA, nodeId, [
        { sourceNodeId: '11', sourceWidgetName: 'steps' }
      ])
      expect(
        store.isPromoted(graphA, nodeId, {
          sourceNodeId: '10',
          sourceWidgetName: 'seed'
        })
      ).toBe(false)
      expect(
        store.isPromoted(graphA, nodeId, {
          sourceNodeId: '11',
          sourceWidgetName: 'steps'
        })
      ).toBe(true)
    })

    it('clears entries when set to empty array', () => {
      store.promote(graphA, nodeId, {
        sourceNodeId: '10',
        sourceWidgetName: 'seed'
      })
      store.setPromotions(graphA, nodeId, [])
      expect(store.getPromotions(graphA, nodeId)).toEqual([])
    })

    it('preserves order', () => {
      const entries = [
        { sourceNodeId: '10', sourceWidgetName: 'seed' },
        { sourceNodeId: '11', sourceWidgetName: 'steps' },
        { sourceNodeId: '12', sourceWidgetName: 'cfg' }
      ]
      store.setPromotions(graphA, nodeId, entries)
      expect(store.getPromotions(graphA, nodeId)).toEqual(entries)
    })
  })

  describe('promote', () => {
    it('adds a new entry', () => {
      store.promote(graphA, nodeId, {
        sourceNodeId: '10',
        sourceWidgetName: 'seed'
      })
      expect(store.getPromotions(graphA, nodeId)).toHaveLength(1)
    })

    it('does not duplicate existing entries', () => {
      store.promote(graphA, nodeId, {
        sourceNodeId: '10',
        sourceWidgetName: 'seed'
      })
      store.promote(graphA, nodeId, {
        sourceNodeId: '10',
        sourceWidgetName: 'seed'
      })
      expect(store.getPromotions(graphA, nodeId)).toHaveLength(1)
    })

    it('appends to existing entries', () => {
      store.promote(graphA, nodeId, {
        sourceNodeId: '10',
        sourceWidgetName: 'seed'
      })
      store.promote(graphA, nodeId, {
        sourceNodeId: '11',
        sourceWidgetName: 'steps'
      })
      expect(store.getPromotions(graphA, nodeId)).toHaveLength(2)
    })
  })

  describe('demote', () => {
    it('removes an existing entry', () => {
      store.promote(graphA, nodeId, {
        sourceNodeId: '10',
        sourceWidgetName: 'seed'
      })
      store.demote(graphA, nodeId, {
        sourceNodeId: '10',
        sourceWidgetName: 'seed'
      })
      expect(store.getPromotions(graphA, nodeId)).toEqual([])
    })

    it('is a no-op for non-existent entries', () => {
      store.promote(graphA, nodeId, {
        sourceNodeId: '10',
        sourceWidgetName: 'seed'
      })
      store.demote(graphA, nodeId, {
        sourceNodeId: '99',
        sourceWidgetName: 'nonexistent'
      })
      expect(store.getPromotions(graphA, nodeId)).toHaveLength(1)
    })

    it('preserves other entries', () => {
      store.promote(graphA, nodeId, {
        sourceNodeId: '10',
        sourceWidgetName: 'seed'
      })
      store.promote(graphA, nodeId, {
        sourceNodeId: '11',
        sourceWidgetName: 'steps'
      })
      store.demote(graphA, nodeId, {
        sourceNodeId: '10',
        sourceWidgetName: 'seed'
      })
      expect(store.getPromotions(graphA, nodeId)).toEqual([
        { sourceNodeId: '11', sourceWidgetName: 'steps' }
      ])
    })
  })

  describe('movePromotion', () => {
    it('moves an entry from one index to another', () => {
      store.promote(graphA, nodeId, {
        sourceNodeId: '10',
        sourceWidgetName: 'seed'
      })
      store.promote(graphA, nodeId, {
        sourceNodeId: '11',
        sourceWidgetName: 'steps'
      })
      store.promote(graphA, nodeId, {
        sourceNodeId: '12',
        sourceWidgetName: 'cfg'
      })
      store.movePromotion(graphA, nodeId, 0, 2)
      expect(store.getPromotions(graphA, nodeId)).toEqual([
        { sourceNodeId: '11', sourceWidgetName: 'steps' },
        { sourceNodeId: '12', sourceWidgetName: 'cfg' },
        { sourceNodeId: '10', sourceWidgetName: 'seed' }
      ])
    })

    it('is a no-op for out-of-bounds indices', () => {
      store.promote(graphA, nodeId, {
        sourceNodeId: '10',
        sourceWidgetName: 'seed'
      })
      store.movePromotion(graphA, nodeId, 0, 5)
      expect(store.getPromotions(graphA, nodeId)).toEqual([
        { sourceNodeId: '10', sourceWidgetName: 'seed' }
      ])
    })

    it('is a no-op when fromIndex equals toIndex', () => {
      store.promote(graphA, nodeId, {
        sourceNodeId: '10',
        sourceWidgetName: 'seed'
      })
      store.promote(graphA, nodeId, {
        sourceNodeId: '11',
        sourceWidgetName: 'steps'
      })
      store.movePromotion(graphA, nodeId, 1, 1)
      expect(store.getPromotions(graphA, nodeId)).toEqual([
        { sourceNodeId: '10', sourceWidgetName: 'seed' },
        { sourceNodeId: '11', sourceWidgetName: 'steps' }
      ])
    })
  })

  describe('ref-counted isPromotedByAny', () => {
    const nodeA = 1 as NodeId
    const nodeB = 2 as NodeId

    it('tracks across setPromotions calls', () => {
      store.setPromotions(graphA, nodeA, [
        { sourceNodeId: '10', sourceWidgetName: 'seed' }
      ])
      expect(
        store.isPromotedByAny(graphA, {
          sourceNodeId: '10',
          sourceWidgetName: 'seed'
        })
      ).toBe(true)

      store.setPromotions(graphA, nodeB, [
        { sourceNodeId: '10', sourceWidgetName: 'seed' }
      ])
      expect(
        store.isPromotedByAny(graphA, {
          sourceNodeId: '10',
          sourceWidgetName: 'seed'
        })
      ).toBe(true)

      // Remove from A — still promoted by B
      store.setPromotions(graphA, nodeA, [])
      expect(
        store.isPromotedByAny(graphA, {
          sourceNodeId: '10',
          sourceWidgetName: 'seed'
        })
      ).toBe(true)

      // Remove from B — now gone
      store.setPromotions(graphA, nodeB, [])
      expect(
        store.isPromotedByAny(graphA, {
          sourceNodeId: '10',
          sourceWidgetName: 'seed'
        })
      ).toBe(false)
    })

    it('handles replacement via setPromotions correctly', () => {
      store.setPromotions(graphA, nodeA, [
        { sourceNodeId: '10', sourceWidgetName: 'seed' },
        { sourceNodeId: '11', sourceWidgetName: 'steps' }
      ])
      expect(
        store.isPromotedByAny(graphA, {
          sourceNodeId: '10',
          sourceWidgetName: 'seed'
        })
      ).toBe(true)
      expect(
        store.isPromotedByAny(graphA, {
          sourceNodeId: '11',
          sourceWidgetName: 'steps'
        })
      ).toBe(true)

      // Replace with different entries
      store.setPromotions(graphA, nodeA, [
        { sourceNodeId: '11', sourceWidgetName: 'steps' },
        { sourceNodeId: '12', sourceWidgetName: 'cfg' }
      ])
      expect(
        store.isPromotedByAny(graphA, {
          sourceNodeId: '10',
          sourceWidgetName: 'seed'
        })
      ).toBe(false)
      expect(
        store.isPromotedByAny(graphA, {
          sourceNodeId: '11',
          sourceWidgetName: 'steps'
        })
      ).toBe(true)
      expect(
        store.isPromotedByAny(graphA, {
          sourceNodeId: '12',
          sourceWidgetName: 'cfg'
        })
      ).toBe(true)
    })

    it('stays consistent through movePromotion', () => {
      store.promote(graphA, nodeA, {
        sourceNodeId: '10',
        sourceWidgetName: 'seed'
      })
      store.promote(graphA, nodeA, {
        sourceNodeId: '11',
        sourceWidgetName: 'steps'
      })
      store.movePromotion(graphA, nodeA, 0, 1)
      expect(
        store.isPromotedByAny(graphA, {
          sourceNodeId: '10',
          sourceWidgetName: 'seed'
        })
      ).toBe(true)
      expect(
        store.isPromotedByAny(graphA, {
          sourceNodeId: '11',
          sourceWidgetName: 'steps'
        })
      ).toBe(true)
    })
  })

  describe('multi-node isolation', () => {
    const nodeA = 1 as NodeId
    const nodeB = 2 as NodeId

    it('keeps promotions separate per subgraph node', () => {
      store.promote(graphA, nodeA, {
        sourceNodeId: '10',
        sourceWidgetName: 'seed'
      })
      store.promote(graphA, nodeB, {
        sourceNodeId: '20',
        sourceWidgetName: 'cfg'
      })

      expect(store.getPromotions(graphA, nodeA)).toEqual([
        { sourceNodeId: '10', sourceWidgetName: 'seed' }
      ])
      expect(store.getPromotions(graphA, nodeB)).toEqual([
        { sourceNodeId: '20', sourceWidgetName: 'cfg' }
      ])
    })

    it('demoting from one node does not affect another', () => {
      store.promote(graphA, nodeA, {
        sourceNodeId: '10',
        sourceWidgetName: 'seed'
      })
      store.promote(graphA, nodeB, {
        sourceNodeId: '10',
        sourceWidgetName: 'seed'
      })
      store.demote(graphA, nodeA, {
        sourceNodeId: '10',
        sourceWidgetName: 'seed'
      })

      expect(
        store.isPromoted(graphA, nodeA, {
          sourceNodeId: '10',
          sourceWidgetName: 'seed'
        })
      ).toBe(false)
      expect(
        store.isPromoted(graphA, nodeB, {
          sourceNodeId: '10',
          sourceWidgetName: 'seed'
        })
      ).toBe(true)
    })
  })

  describe('clearGraph resets ref counts', () => {
    const nodeA = 1 as NodeId
    const nodeB = 2 as NodeId

    it('resets isPromotedByAny after clearGraph', () => {
      store.promote(graphA, nodeA, {
        sourceNodeId: '10',
        sourceWidgetName: 'seed'
      })
      store.promote(graphA, nodeB, {
        sourceNodeId: '11',
        sourceWidgetName: 'steps'
      })
      expect(
        store.isPromotedByAny(graphA, {
          sourceNodeId: '10',
          sourceWidgetName: 'seed'
        })
      ).toBe(true)
      expect(
        store.isPromotedByAny(graphA, {
          sourceNodeId: '11',
          sourceWidgetName: 'steps'
        })
      ).toBe(true)

      store.clearGraph(graphA)

      expect(
        store.isPromotedByAny(graphA, {
          sourceNodeId: '10',
          sourceWidgetName: 'seed'
        })
      ).toBe(false)
      expect(
        store.isPromotedByAny(graphA, {
          sourceNodeId: '11',
          sourceWidgetName: 'steps'
        })
      ).toBe(false)
    })
  })

  describe('setPromotions idempotency', () => {
    it('does not double ref counts when called twice with same entries', () => {
      const entries = [
        { sourceNodeId: '10', sourceWidgetName: 'seed' },
        { sourceNodeId: '11', sourceWidgetName: 'steps' }
      ]
      store.setPromotions(graphA, nodeId, entries)
      store.setPromotions(graphA, nodeId, entries)

      expect(
        store.isPromotedByAny(graphA, {
          sourceNodeId: '10',
          sourceWidgetName: 'seed'
        })
      ).toBe(true)
      expect(
        store.isPromotedByAny(graphA, {
          sourceNodeId: '11',
          sourceWidgetName: 'steps'
        })
      ).toBe(true)

      store.setPromotions(graphA, nodeId, [])

      expect(
        store.isPromotedByAny(graphA, {
          sourceNodeId: '10',
          sourceWidgetName: 'seed'
        })
      ).toBe(false)
      expect(
        store.isPromotedByAny(graphA, {
          sourceNodeId: '11',
          sourceWidgetName: 'steps'
        })
      ).toBe(false)
    })
  })

  describe('promote/demote interleaved with setPromotions', () => {
    it('maintains consistent ref counts through mixed operations', () => {
      const nodeA = 1 as NodeId

      store.promote(graphA, nodeA, {
        sourceNodeId: '10',
        sourceWidgetName: 'seed'
      })
      expect(
        store.isPromotedByAny(graphA, {
          sourceNodeId: '10',
          sourceWidgetName: 'seed'
        })
      ).toBe(true)

      store.setPromotions(graphA, nodeA, [
        { sourceNodeId: '10', sourceWidgetName: 'seed' },
        { sourceNodeId: '11', sourceWidgetName: 'steps' }
      ])
      expect(
        store.isPromotedByAny(graphA, {
          sourceNodeId: '10',
          sourceWidgetName: 'seed'
        })
      ).toBe(true)
      expect(
        store.isPromotedByAny(graphA, {
          sourceNodeId: '11',
          sourceWidgetName: 'steps'
        })
      ).toBe(true)

      store.demote(graphA, nodeA, {
        sourceNodeId: '10',
        sourceWidgetName: 'seed'
      })

      expect(
        store.isPromotedByAny(graphA, {
          sourceNodeId: '10',
          sourceWidgetName: 'seed'
        })
      ).toBe(false)
      expect(
        store.isPromotedByAny(graphA, {
          sourceNodeId: '11',
          sourceWidgetName: 'steps'
        })
      ).toBe(true)
    })
  })

  describe('graph isolation', () => {
    it('isolates promotions by graph id', () => {
      store.promote(graphA, nodeId, {
        sourceNodeId: '10',
        sourceWidgetName: 'seed'
      })
      store.promote(graphB, nodeId, {
        sourceNodeId: '20',
        sourceWidgetName: 'steps'
      })

      expect(store.getPromotions(graphA, nodeId)).toEqual([
        { sourceNodeId: '10', sourceWidgetName: 'seed' }
      ])
      expect(store.getPromotions(graphB, nodeId)).toEqual([
        { sourceNodeId: '20', sourceWidgetName: 'steps' }
      ])
    })

    it('clearGraph only removes one graph namespace', () => {
      store.promote(graphA, nodeId, {
        sourceNodeId: '10',
        sourceWidgetName: 'seed'
      })
      store.promote(graphB, nodeId, {
        sourceNodeId: '20',
        sourceWidgetName: 'steps'
      })

      store.clearGraph(graphA)

      expect(store.getPromotions(graphA, nodeId)).toEqual([])
      expect(store.getPromotions(graphB, nodeId)).toEqual([
        { sourceNodeId: '20', sourceWidgetName: 'steps' }
      ])
      expect(
        store.isPromotedByAny(graphA, {
          sourceNodeId: '10',
          sourceWidgetName: 'seed'
        })
      ).toBe(false)
      expect(
        store.isPromotedByAny(graphB, {
          sourceNodeId: '20',
          sourceWidgetName: 'steps'
        })
      ).toBe(true)
    })
  })

  describe('sourceNodeId disambiguation', () => {
    it('promote with disambiguatingSourceNodeId is found by matching isPromoted', () => {
      store.promote(graphA, nodeId, {
        sourceNodeId: '10',
        sourceWidgetName: 'text',
        disambiguatingSourceNodeId: '99'
      })
      expect(
        store.isPromoted(graphA, nodeId, {
          sourceNodeId: '10',
          sourceWidgetName: 'text',
          disambiguatingSourceNodeId: '99'
        })
      ).toBe(true)
    })

    it('isPromoted with different disambiguatingSourceNodeId returns false', () => {
      store.promote(graphA, nodeId, {
        sourceNodeId: '10',
        sourceWidgetName: 'text',
        disambiguatingSourceNodeId: '99'
      })
      expect(
        store.isPromoted(graphA, nodeId, {
          sourceNodeId: '10',
          sourceWidgetName: 'text',
          disambiguatingSourceNodeId: '88'
        })
      ).toBe(false)
    })

    it('isPromoted with undefined disambiguatingSourceNodeId does not match entry with disambiguatingSourceNodeId', () => {
      store.promote(graphA, nodeId, {
        sourceNodeId: '10',
        sourceWidgetName: 'text',
        disambiguatingSourceNodeId: '99'
      })
      expect(
        store.isPromoted(graphA, nodeId, {
          sourceNodeId: '10',
          sourceWidgetName: 'text'
        })
      ).toBe(false)
    })

    it('two entries with same sourceNodeId/sourceWidgetName but different disambiguatingSourceNodeId coexist', () => {
      store.promote(graphA, nodeId, {
        sourceNodeId: '3',
        sourceWidgetName: 'text',
        disambiguatingSourceNodeId: '1'
      })
      store.promote(graphA, nodeId, {
        sourceNodeId: '3',
        sourceWidgetName: 'text',
        disambiguatingSourceNodeId: '2'
      })
      expect(store.getPromotions(graphA, nodeId)).toHaveLength(2)
      expect(
        store.isPromoted(graphA, nodeId, {
          sourceNodeId: '3',
          sourceWidgetName: 'text',
          disambiguatingSourceNodeId: '1'
        })
      ).toBe(true)
      expect(
        store.isPromoted(graphA, nodeId, {
          sourceNodeId: '3',
          sourceWidgetName: 'text',
          disambiguatingSourceNodeId: '2'
        })
      ).toBe(true)
    })

    it('demote with disambiguatingSourceNodeId removes only matching entry', () => {
      store.promote(graphA, nodeId, {
        sourceNodeId: '3',
        sourceWidgetName: 'text',
        disambiguatingSourceNodeId: '1'
      })
      store.promote(graphA, nodeId, {
        sourceNodeId: '3',
        sourceWidgetName: 'text',
        disambiguatingSourceNodeId: '2'
      })
      store.demote(graphA, nodeId, {
        sourceNodeId: '3',
        sourceWidgetName: 'text',
        disambiguatingSourceNodeId: '1'
      })
      expect(store.getPromotions(graphA, nodeId)).toHaveLength(1)
      expect(
        store.isPromoted(graphA, nodeId, {
          sourceNodeId: '3',
          sourceWidgetName: 'text',
          disambiguatingSourceNodeId: '1'
        })
      ).toBe(false)
      expect(
        store.isPromoted(graphA, nodeId, {
          sourceNodeId: '3',
          sourceWidgetName: 'text',
          disambiguatingSourceNodeId: '2'
        })
      ).toBe(true)
    })

    it('isPromotedByAny with disambiguatingSourceNodeId matches exact key and base key', () => {
      store.promote(graphA, nodeId, {
        sourceNodeId: '3',
        sourceWidgetName: 'text',
        disambiguatingSourceNodeId: '1'
      })
      expect(
        store.isPromotedByAny(graphA, {
          sourceNodeId: '3',
          sourceWidgetName: 'text',
          disambiguatingSourceNodeId: '1'
        })
      ).toBe(true)
      expect(
        store.isPromotedByAny(graphA, {
          sourceNodeId: '3',
          sourceWidgetName: 'text',
          disambiguatingSourceNodeId: '2'
        })
      ).toBe(false)
      // Base-key lookup succeeds because dual-indexing keeps a ref count
      // on the base key for callers that lack a disambiguator.
      expect(
        store.isPromotedByAny(graphA, {
          sourceNodeId: '3',
          sourceWidgetName: 'text'
        })
      ).toBe(true)
    })

    it('setPromotions with disambiguatingSourceNodeId entries maintains correct ref-counts', () => {
      const nodeA = 1 as NodeId
      const nodeB = 2 as NodeId
      store.setPromotions(graphA, nodeA, [
        {
          sourceNodeId: '3',
          sourceWidgetName: 'text',
          disambiguatingSourceNodeId: '1'
        }
      ])
      store.setPromotions(graphA, nodeB, [
        {
          sourceNodeId: '3',
          sourceWidgetName: 'text',
          disambiguatingSourceNodeId: '1'
        }
      ])
      expect(
        store.isPromotedByAny(graphA, {
          sourceNodeId: '3',
          sourceWidgetName: 'text',
          disambiguatingSourceNodeId: '1'
        })
      ).toBe(true)

      store.setPromotions(graphA, nodeA, [])
      expect(
        store.isPromotedByAny(graphA, {
          sourceNodeId: '3',
          sourceWidgetName: 'text',
          disambiguatingSourceNodeId: '1'
        })
      ).toBe(true)

      store.setPromotions(graphA, nodeB, [])
      expect(
        store.isPromotedByAny(graphA, {
          sourceNodeId: '3',
          sourceWidgetName: 'text',
          disambiguatingSourceNodeId: '1'
        })
      ).toBe(false)
    })
  })
})
