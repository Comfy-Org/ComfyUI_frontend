import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { MissingNodeType } from '@/types/comfy'

vi.mock('@/i18n', () => ({
  st: vi.fn((_key: string, fallback: string) => fallback)
}))

vi.mock('@/platform/distribution/types', () => ({
  isCloud: false
}))

const mockShowErrorsTab = vi.hoisted(() => ({ value: false }))

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: vi.fn(() => ({
    get: vi.fn(() => mockShowErrorsTab.value)
  }))
}))

import { useMissingNodesErrorStore } from './missingNodesErrorStore'

describe('missingNodesErrorStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('setMissingNodeTypes', () => {
    it('sets missingNodesError with provided types', () => {
      const store = useMissingNodesErrorStore()
      const types: MissingNodeType[] = [
        { type: 'NodeA', nodeId: '1', isReplaceable: false }
      ]
      store.setMissingNodeTypes(types)

      expect(store.missingNodesError).not.toBeNull()
      expect(store.missingNodesError?.nodeTypes).toHaveLength(1)
      expect(store.hasMissingNodes).toBe(true)
    })

    it('clears missingNodesError when given empty array', () => {
      const store = useMissingNodesErrorStore()
      store.setMissingNodeTypes([
        { type: 'NodeA', nodeId: '1', isReplaceable: false }
      ])
      expect(store.missingNodesError).not.toBeNull()

      store.setMissingNodeTypes([])
      expect(store.missingNodesError).toBeNull()
      expect(store.hasMissingNodes).toBe(false)
    })

    it('deduplicates string entries by value', () => {
      const store = useMissingNodesErrorStore()
      store.setMissingNodeTypes([
        'NodeA',
        'NodeA',
        'NodeB'
      ] as MissingNodeType[])

      expect(store.missingNodesError?.nodeTypes).toHaveLength(2)
    })

    it('deduplicates object entries by nodeId when present', () => {
      const store = useMissingNodesErrorStore()
      store.setMissingNodeTypes([
        { type: 'NodeA', nodeId: '1', isReplaceable: false },
        { type: 'NodeA', nodeId: '1', isReplaceable: false },
        { type: 'NodeA', nodeId: '2', isReplaceable: false }
      ])

      expect(store.missingNodesError?.nodeTypes).toHaveLength(2)
    })

    it('deduplicates object entries by type when nodeId is absent', () => {
      const store = useMissingNodesErrorStore()
      store.setMissingNodeTypes([
        { type: 'NodeA', isReplaceable: false },
        { type: 'NodeA', isReplaceable: true }
      ] as MissingNodeType[])

      expect(store.missingNodesError?.nodeTypes).toHaveLength(1)
    })

    it('keeps distinct nodeIds even when type is the same', () => {
      const store = useMissingNodesErrorStore()
      store.setMissingNodeTypes([
        { type: 'NodeA', nodeId: '1', isReplaceable: false },
        { type: 'NodeA', nodeId: '2', isReplaceable: false },
        { type: 'NodeA', nodeId: '3', isReplaceable: false }
      ])

      expect(store.missingNodesError?.nodeTypes).toHaveLength(3)
    })
  })

  describe('surfaceMissingNodes', () => {
    beforeEach(() => {
      mockShowErrorsTab.value = false
    })

    it('stores missing node types and returns false when setting disabled', () => {
      const store = useMissingNodesErrorStore()
      const types: MissingNodeType[] = [
        { type: 'NodeA', nodeId: '1', isReplaceable: false }
      ]
      const shouldShowOverlay = store.surfaceMissingNodes(types)

      expect(store.missingNodesError).not.toBeNull()
      expect(store.missingNodesError?.nodeTypes).toHaveLength(1)
      expect(store.hasMissingNodes).toBe(true)
      expect(shouldShowOverlay).toBe(false)
    })

    it('returns true when ShowErrorsTab setting is enabled', () => {
      mockShowErrorsTab.value = true
      const store = useMissingNodesErrorStore()
      const shouldShowOverlay = store.surfaceMissingNodes([
        { type: 'NodeA', nodeId: '1', isReplaceable: false }
      ])

      expect(shouldShowOverlay).toBe(true)
    })

    it('returns false when ShowErrorsTab setting is disabled', () => {
      mockShowErrorsTab.value = false
      const store = useMissingNodesErrorStore()
      const shouldShowOverlay = store.surfaceMissingNodes([
        { type: 'NodeA', nodeId: '1', isReplaceable: false }
      ])

      expect(shouldShowOverlay).toBe(false)
    })

    it('returns false for empty types even when setting is enabled', () => {
      mockShowErrorsTab.value = true
      const store = useMissingNodesErrorStore()
      const shouldShowOverlay = store.surfaceMissingNodes([])

      expect(shouldShowOverlay).toBe(false)
    })

    it('deduplicates node types', () => {
      const store = useMissingNodesErrorStore()
      store.surfaceMissingNodes([
        { type: 'NodeA', nodeId: '1', isReplaceable: false },
        { type: 'NodeA', nodeId: '1', isReplaceable: false },
        { type: 'NodeB', nodeId: '2', isReplaceable: false }
      ])

      expect(store.missingNodesError?.nodeTypes).toHaveLength(2)
    })
  })

  describe('removeMissingNodesByType', () => {
    it('removes matching types from the missing nodes list', () => {
      const store = useMissingNodesErrorStore()
      store.setMissingNodeTypes([
        { type: 'NodeA', nodeId: '1', isReplaceable: false },
        { type: 'NodeB', nodeId: '2', isReplaceable: false },
        { type: 'NodeC', nodeId: '3', isReplaceable: false }
      ])

      store.removeMissingNodesByType(['NodeA', 'NodeC'])

      expect(store.missingNodesError?.nodeTypes).toHaveLength(1)
      const remaining = store.missingNodesError?.nodeTypes[0]
      expect(typeof remaining !== 'string' && remaining?.type).toBe('NodeB')
    })

    it('clears missingNodesError when all types are removed', () => {
      const store = useMissingNodesErrorStore()
      store.setMissingNodeTypes([
        { type: 'NodeA', nodeId: '1', isReplaceable: false }
      ])

      store.removeMissingNodesByType(['NodeA'])

      expect(store.missingNodesError).toBeNull()
      expect(store.hasMissingNodes).toBe(false)
    })

    it('does nothing when missingNodesError is null', () => {
      const store = useMissingNodesErrorStore()
      expect(store.missingNodesError).toBeNull()

      store.removeMissingNodesByType(['NodeA'])
      expect(store.missingNodesError).toBeNull()
    })

    it('does nothing when removing non-existent types', () => {
      const store = useMissingNodesErrorStore()
      store.setMissingNodeTypes([
        { type: 'NodeA', nodeId: '1', isReplaceable: false }
      ])

      store.removeMissingNodesByType(['NonExistent'])

      expect(store.missingNodesError?.nodeTypes).toHaveLength(1)
    })

    it('handles removing from string entries', () => {
      const store = useMissingNodesErrorStore()
      store.setMissingNodeTypes([
        'StringNodeA',
        'StringNodeB'
      ] as MissingNodeType[])

      store.removeMissingNodesByType(['StringNodeA'])

      expect(store.missingNodesError?.nodeTypes).toHaveLength(1)
    })
  })

  describe('removeMissingNodesByNodeId', () => {
    it('removes entries matching the nodeId', () => {
      const store = useMissingNodesErrorStore()
      store.setMissingNodeTypes([
        { type: 'NodeA', nodeId: '1', isReplaceable: false },
        { type: 'NodeB', nodeId: '2', isReplaceable: false }
      ])

      store.removeMissingNodesByNodeId('1')

      expect(store.missingNodesError?.nodeTypes).toHaveLength(1)
      const remaining = store.missingNodesError?.nodeTypes[0]
      expect(typeof remaining !== 'string' && remaining?.nodeId).toBe('2')
    })

    it('keeps string entries (they have no nodeId)', () => {
      const store = useMissingNodesErrorStore()
      store.setMissingNodeTypes([
        'StringNode',
        { type: 'NodeA', nodeId: '1', isReplaceable: false }
      ] as MissingNodeType[])

      store.removeMissingNodesByNodeId('1')

      expect(store.missingNodesError?.nodeTypes).toHaveLength(1)
      expect(store.missingNodesError?.nodeTypes[0]).toBe('StringNode')
    })

    it('keeps entries with different nodeIds', () => {
      const store = useMissingNodesErrorStore()
      store.setMissingNodeTypes([
        { type: 'NodeA', nodeId: '1', isReplaceable: false },
        { type: 'NodeB', nodeId: '2', isReplaceable: false },
        { type: 'NodeC', nodeId: '3', isReplaceable: false }
      ])

      store.removeMissingNodesByNodeId('2')

      expect(store.missingNodesError?.nodeTypes).toHaveLength(2)
    })

    it('clears missingNodesError when all object entries are removed', () => {
      const store = useMissingNodesErrorStore()
      store.setMissingNodeTypes([
        { type: 'NodeA', nodeId: '1', isReplaceable: false }
      ])

      store.removeMissingNodesByNodeId('1')

      expect(store.missingNodesError).toBeNull()
      expect(store.hasMissingNodes).toBe(false)
    })

    it('does nothing when missingNodesError is null', () => {
      const store = useMissingNodesErrorStore()
      store.removeMissingNodesByNodeId('1')
      expect(store.missingNodesError).toBeNull()
    })
  })
})
