import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import type { UUID } from '@/lib/litegraph/src/utils/uuid'
import { createNodeLocatorId } from '@/types/nodeIdentification'

import { usePreviewExposureStore } from './previewExposureStore'

describe(usePreviewExposureStore, () => {
  let store: ReturnType<typeof usePreviewExposureStore>
  const rootGraphA = 'root-graph-a' as UUID
  const rootGraphB = 'root-graph-b' as UUID
  const hostA = createNodeLocatorId(rootGraphA, 7)
  const hostB = createNodeLocatorId(rootGraphA, 8)

  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    store = usePreviewExposureStore()
  })

  describe('getExposures', () => {
    it('returns empty readonly array for unknown host', () => {
      expect(store.getExposures(rootGraphA, hostA)).toEqual([])
    })
  })

  describe('addExposure', () => {
    it('appends a new exposure and returns it with name = sourcePreviewName when no collision', () => {
      const entry = store.addExposure(rootGraphA, hostA, {
        sourceNodeId: '42',
        sourcePreviewName: '$$canvas-image-preview'
      })

      expect(entry).toEqual({
        name: '$$canvas-image-preview',
        sourceNodeId: '42',
        sourcePreviewName: '$$canvas-image-preview'
      })
      expect(store.getExposures(rootGraphA, hostA)).toEqual([entry])
    })

    it('disambiguates name collisions via nextUniqueName', () => {
      const first = store.addExposure(rootGraphA, hostA, {
        sourceNodeId: '42',
        sourcePreviewName: 'preview'
      })
      const second = store.addExposure(rootGraphA, hostA, {
        sourceNodeId: '43',
        sourcePreviewName: 'preview'
      })
      const third = store.addExposure(rootGraphA, hostA, {
        sourceNodeId: '44',
        sourcePreviewName: 'preview'
      })

      expect(first.name).toBe('preview')
      expect(second.name).toBe('preview_1')
      expect(third.name).toBe('preview_2')
      expect(store.getExposures(rootGraphA, hostA).map((e) => e.name)).toEqual([
        'preview',
        'preview_1',
        'preview_2'
      ])
    })
  })

  describe('setExposures', () => {
    it('replaces the array for the host', () => {
      store.addExposure(rootGraphA, hostA, {
        sourceNodeId: '42',
        sourcePreviewName: 'preview'
      })

      const next = [
        {
          name: 'replaced',
          sourceNodeId: '99',
          sourcePreviewName: 'other'
        }
      ]
      store.setExposures(rootGraphA, hostA, next)

      expect(store.getExposures(rootGraphA, hostA)).toEqual(next)
    })

    it('clears the host bucket when given an empty array', () => {
      store.addExposure(rootGraphA, hostA, {
        sourceNodeId: '42',
        sourcePreviewName: 'preview'
      })

      store.setExposures(rootGraphA, hostA, [])

      expect(store.getExposures(rootGraphA, hostA)).toEqual([])
    })
  })

  describe('removeExposure', () => {
    beforeEach(() => {
      store.addExposure(rootGraphA, hostA, {
        sourceNodeId: '42',
        sourcePreviewName: 'preview'
      })
      store.addExposure(rootGraphA, hostA, {
        sourceNodeId: '43',
        sourcePreviewName: 'preview'
      })
    })

    it('removes the matching entry by name', () => {
      store.removeExposure(rootGraphA, hostA, 'preview_1')

      expect(store.getExposures(rootGraphA, hostA).map((e) => e.name)).toEqual([
        'preview'
      ])
    })

    it('is a no-op when no entry matches', () => {
      const before = store.getExposures(rootGraphA, hostA)
      store.removeExposure(rootGraphA, hostA, 'does-not-exist')
      expect(store.getExposures(rootGraphA, hostA)).toEqual(before)
    })
  })

  describe('moveExposure', () => {
    beforeEach(() => {
      store.setExposures(rootGraphA, hostA, [
        { name: 'a', sourceNodeId: '1', sourcePreviewName: 'a' },
        { name: 'b', sourceNodeId: '2', sourcePreviewName: 'b' },
        { name: 'c', sourceNodeId: '3', sourcePreviewName: 'c' }
      ])
    })

    it('reorders entries from -> to', () => {
      store.moveExposure(rootGraphA, hostA, 0, 2)

      expect(store.getExposures(rootGraphA, hostA).map((e) => e.name)).toEqual([
        'b',
        'c',
        'a'
      ])
    })

    it('is a no-op for equal indices', () => {
      store.moveExposure(rootGraphA, hostA, 1, 1)
      expect(store.getExposures(rootGraphA, hostA).map((e) => e.name)).toEqual([
        'a',
        'b',
        'c'
      ])
    })

    it('is a no-op for out-of-bounds indices', () => {
      store.moveExposure(rootGraphA, hostA, -1, 2)
      store.moveExposure(rootGraphA, hostA, 0, 5)
      expect(store.getExposures(rootGraphA, hostA).map((e) => e.name)).toEqual([
        'a',
        'b',
        'c'
      ])
    })
  })

  describe('clearGraph', () => {
    it('removes all hosts under the rootGraphId without affecting others', () => {
      store.addExposure(rootGraphA, hostA, {
        sourceNodeId: '1',
        sourcePreviewName: 'p'
      })
      store.addExposure(rootGraphA, hostB, {
        sourceNodeId: '2',
        sourcePreviewName: 'p'
      })
      const hostInB = createNodeLocatorId(rootGraphB, 7)
      store.addExposure(rootGraphB, hostInB, {
        sourceNodeId: '3',
        sourcePreviewName: 'p'
      })

      store.clearGraph(rootGraphA)

      expect(store.getExposures(rootGraphA, hostA)).toEqual([])
      expect(store.getExposures(rootGraphA, hostB)).toEqual([])
      expect(store.getExposures(rootGraphB, hostInB)).toHaveLength(1)
    })
  })

  describe('isolation between (rootGraphId, hostNodeLocator) pairs', () => {
    it('keeps separate buckets per host and per root graph', () => {
      store.addExposure(rootGraphA, hostA, {
        sourceNodeId: '1',
        sourcePreviewName: 'p'
      })
      store.addExposure(rootGraphA, hostB, {
        sourceNodeId: '2',
        sourcePreviewName: 'p'
      })
      const hostInB = createNodeLocatorId(rootGraphB, 7)
      store.addExposure(rootGraphB, hostInB, {
        sourceNodeId: '3',
        sourcePreviewName: 'p'
      })

      expect(store.getExposures(rootGraphA, hostA)).toHaveLength(1)
      expect(store.getExposures(rootGraphA, hostB)).toHaveLength(1)
      expect(store.getExposures(rootGraphB, hostInB)).toHaveLength(1)
      expect(store.getExposures(rootGraphA, hostA)[0].sourceNodeId).toBe('1')
      expect(store.getExposures(rootGraphA, hostB)[0].sourceNodeId).toBe('2')
      expect(store.getExposures(rootGraphB, hostInB)[0].sourceNodeId).toBe('3')
    })
  })

  describe('resolveChain', () => {
    it('returns a single-link chain for an existing exposure', () => {
      const entry = store.addExposure(rootGraphA, hostA, {
        sourceNodeId: '42',
        sourcePreviewName: 'preview'
      })

      expect(store.resolveChain(rootGraphA, hostA, entry.name)).toEqual({
        rootGraphId: rootGraphA,
        hostNodeLocator: hostA,
        name: 'preview',
        source: {
          sourceNodeId: '42',
          sourcePreviewName: 'preview'
        }
      })
    })

    it('returns undefined when the named exposure is missing', () => {
      expect(store.resolveChain(rootGraphA, hostA, 'absent')).toBeUndefined()
    })

    it('does not yet walk nested-host chains (PR-A stub)', () => {
      // Set up a host whose exposure points to a sourceNodeId that itself
      // has its own preview exposure registered. PR-A must surface only the
      // direct source — no recursion through the inner host.
      const innerHost = createNodeLocatorId(rootGraphA, 99)
      store.addExposure(rootGraphA, innerHost, {
        sourceNodeId: 'inner-leaf',
        sourcePreviewName: 'inner-preview'
      })
      const outer = store.addExposure(rootGraphA, hostA, {
        sourceNodeId: '99',
        sourcePreviewName: 'outer-preview'
      })

      const resolved = store.resolveChain(rootGraphA, hostA, outer.name)

      expect(resolved?.source).toEqual({
        sourceNodeId: '99',
        sourcePreviewName: 'outer-preview'
      })
    })
  })
})
