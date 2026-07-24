import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import type { UUID } from '@/utils/uuid'

import { usePreviewExposureStore } from './previewExposureStore'

describe(usePreviewExposureStore, () => {
  let store: ReturnType<typeof usePreviewExposureStore>
  const rootGraphA = 'root-graph-a' as UUID
  const rootGraphB = 'root-graph-b' as UUID
  const hostA = '7'
  const hostB = '8'

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

      const stored = store.getExposures(rootGraphA, hostA)
      expect(stored).toEqual(next)
      expect(stored).not.toBe(next)
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

  describe('findExposure / hasExposure', () => {
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

    it('matches on both sourceNodeId and sourcePreviewName', () => {
      const source = { sourceNodeId: '43', sourcePreviewName: 'preview' }

      expect(store.hasExposure(rootGraphA, hostA, source)).toBe(true)
      expect(store.findExposure(rootGraphA, hostA, source)).toEqual({
        name: 'preview_1',
        sourceNodeId: '43',
        sourcePreviewName: 'preview'
      })
    })

    it('does not match when only one field matches', () => {
      expect(
        store.hasExposure(rootGraphA, hostA, {
          sourceNodeId: '42',
          sourcePreviewName: 'other'
        })
      ).toBe(false)
      expect(
        store.hasExposure(rootGraphA, hostA, {
          sourceNodeId: '99',
          sourcePreviewName: 'preview'
        })
      ).toBe(false)
    })

    it('normalizes a numeric sourceNodeId before comparing', () => {
      const source = { sourceNodeId: 42, sourcePreviewName: 'preview' }

      expect(store.hasExposure(rootGraphA, hostA, source)).toBe(true)
      expect(store.findExposure(rootGraphA, hostA, source)?.sourceNodeId).toBe(
        '42'
      )
    })

    it('returns undefined/false for an unknown host', () => {
      const source = { sourceNodeId: '42', sourcePreviewName: 'preview' }

      expect(store.findExposure(rootGraphA, hostB, source)).toBeUndefined()
      expect(store.hasExposure(rootGraphA, hostB, source)).toBe(false)
    })
  })

  describe('getExposuresAsPromotionShape', () => {
    it('returns an empty array for unknown host', () => {
      expect(store.getExposuresAsPromotionShape(rootGraphA, hostA)).toEqual([])
    })

    it('maps each exposure to {sourceNodeId, sourceWidgetName} preserving order', () => {
      store.addExposure(rootGraphA, hostA, {
        sourceNodeId: '42',
        sourcePreviewName: 'preview'
      })
      store.addExposure(rootGraphA, hostA, {
        sourceNodeId: '43',
        sourcePreviewName: 'preview'
      })

      expect(store.getExposuresAsPromotionShape(rootGraphA, hostA)).toEqual([
        { sourceNodeId: '42', sourceWidgetName: 'preview' },
        { sourceNodeId: '43', sourceWidgetName: 'preview' }
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
      const hostInB = '7'
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
      const hostInB = '7'
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
    it('returns a single-step chain for an existing exposure when no resolver is provided', () => {
      const entry = store.addExposure(rootGraphA, hostA, {
        sourceNodeId: '42',
        sourcePreviewName: 'preview'
      })

      const result = store.resolveChain(rootGraphA, hostA, entry.name)

      expect(result?.steps).toHaveLength(1)
      expect(result?.steps[0]).toMatchObject({
        rootGraphId: rootGraphA,
        hostNodeLocator: hostA,
        exposure: {
          name: 'preview',
          sourceNodeId: '42',
          sourcePreviewName: 'preview'
        }
      })
      expect(result?.leaf).toEqual({
        rootGraphId: rootGraphA,
        sourceNodeId: '42',
        sourcePreviewName: 'preview'
      })
    })

    it('returns undefined when the named exposure is missing', () => {
      expect(store.resolveChain(rootGraphA, hostA, 'absent')).toBeUndefined()
    })

    it('walks one nested host when a resolver is provided', () => {
      const innerHost = '99'
      store.addExposure(rootGraphA, innerHost, {
        sourceNodeId: 'inner-leaf',
        sourcePreviewName: 'inner-preview'
      })
      const outer = store.addExposure(rootGraphA, hostA, {
        sourceNodeId: '99',
        sourcePreviewName: 'inner-preview'
      })

      const resolved = store.resolveChain(
        rootGraphA,
        hostA,
        outer.name,
        (rootGraphId, hostLocator, sourceNodeId) => {
          if (hostLocator === hostA && sourceNodeId === '99') {
            return { rootGraphId, hostNodeLocator: innerHost }
          }
          return undefined
        }
      )

      expect(resolved?.steps).toHaveLength(2)
      expect(resolved?.steps[0].hostNodeLocator).toBe(hostA)
      expect(resolved?.steps[1].hostNodeLocator).toBe(innerHost)
      expect(resolved?.leaf).toEqual({
        rootGraphId: rootGraphA,
        sourceNodeId: 'inner-leaf',
        sourcePreviewName: 'inner-preview'
      })
    })

    it('walks two nested hosts (three-step chain)', () => {
      const inner = '50'
      const innermost = '60'
      store.addExposure(rootGraphA, innermost, {
        sourceNodeId: 'leaf',
        sourcePreviewName: '$$canvas-image-preview'
      })
      store.addExposure(rootGraphA, inner, {
        sourceNodeId: '60',
        sourcePreviewName: '$$canvas-image-preview'
      })
      const outer = store.addExposure(rootGraphA, hostA, {
        sourceNodeId: '50',
        sourcePreviewName: '$$canvas-image-preview'
      })

      const resolved = store.resolveChain(
        rootGraphA,
        hostA,
        outer.name,
        (rootGraphId, hostLocator, sourceNodeId) => {
          if (hostLocator === hostA && sourceNodeId === '50')
            return { rootGraphId, hostNodeLocator: inner }
          if (hostLocator === inner && sourceNodeId === '60')
            return { rootGraphId, hostNodeLocator: innermost }
          return undefined
        }
      )

      expect(resolved?.steps).toHaveLength(3)
      expect(resolved?.steps.map((s) => s.hostNodeLocator)).toEqual([
        hostA,
        inner,
        innermost
      ])
      expect(resolved?.leaf).toEqual({
        rootGraphId: rootGraphA,
        sourceNodeId: 'leaf',
        sourcePreviewName: '$$canvas-image-preview'
      })
    })
  })
})
