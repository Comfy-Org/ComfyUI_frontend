import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useSettingStore } from '@/platform/settings/settingStore'
import { useNodeReplacementStore } from './nodeReplacementStore'

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: vi.fn()
}))

function mockSettingStore(enabled: boolean) {
  vi.mocked(useSettingStore, { partial: true }).mockReturnValue({
    get: vi.fn().mockImplementation((key: string) => {
      if (key === 'Comfy.NodeReplacement.Enabled') {
        return enabled
      }
      return false
    })
  })
}

describe('useNodeReplacementStore', () => {
  let store: ReturnType<typeof useNodeReplacementStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    mockSettingStore(true)
    store = useNodeReplacementStore()
  })

  it('should initialize with empty replacements', () => {
    expect(store.replacements).toEqual({})
    expect(store.isLoaded).toBe(false)
  })

  describe('getReplacementFor', () => {
    it('should return first replacement for existing node type', () => {
      store.replacements = {
        OldNode: [
          {
            new_node_id: 'NewNodeA',
            old_node_id: 'OldNode',
            old_widget_ids: null,
            input_mapping: null,
            output_mapping: null
          },
          {
            new_node_id: 'NewNodeB',
            old_node_id: 'OldNode',
            old_widget_ids: null,
            input_mapping: null,
            output_mapping: null
          }
        ]
      }

      const result = store.getReplacementFor('OldNode')

      expect(result).not.toBeNull()
      expect(result?.new_node_id).toBe('NewNodeA')
    })

    it('should return null for non-existing node type', () => {
      store.replacements = {
        OldNode: [
          {
            new_node_id: 'NewNode',
            old_node_id: 'OldNode',
            old_widget_ids: null,
            input_mapping: null,
            output_mapping: null
          }
        ]
      }

      const result = store.getReplacementFor('NonExistentNode')

      expect(result).toBeNull()
    })

    it('should return null for empty replacement array', () => {
      store.replacements = {
        OldNode: []
      }

      const result = store.getReplacementFor('OldNode')

      expect(result).toBeNull()
    })

    it('should return null when feature is disabled', () => {
      mockSettingStore(false)
      store.replacements = {
        OldNode: [
          {
            new_node_id: 'NewNode',
            old_node_id: 'OldNode',
            old_widget_ids: null,
            input_mapping: null,
            output_mapping: null
          }
        ]
      }

      const result = store.getReplacementFor('OldNode')

      expect(result).toBeNull()
    })
  })

  describe('hasReplacement', () => {
    it('should return true when replacement exists', () => {
      store.replacements = {
        OldNode: [
          {
            new_node_id: 'NewNode',
            old_node_id: 'OldNode',
            old_widget_ids: null,
            input_mapping: null,
            output_mapping: null
          }
        ]
      }

      expect(store.hasReplacement('OldNode')).toBe(true)
    })

    it('should return false when node type does not exist', () => {
      store.replacements = {}

      expect(store.hasReplacement('NonExistentNode')).toBe(false)
    })

    it('should return false when replacement array is empty', () => {
      store.replacements = {
        OldNode: []
      }

      expect(store.hasReplacement('OldNode')).toBe(false)
    })

    it('should return false when feature is disabled', () => {
      mockSettingStore(false)
      store.replacements = {
        OldNode: [
          {
            new_node_id: 'NewNode',
            old_node_id: 'OldNode',
            old_widget_ids: null,
            input_mapping: null,
            output_mapping: null
          }
        ]
      }

      expect(store.hasReplacement('OldNode')).toBe(false)
    })
  })

  describe('isEnabled', () => {
    it('should return true when setting is enabled', () => {
      mockSettingStore(true)
      expect(store.isEnabled()).toBe(true)
    })

    it('should return false when setting is disabled', () => {
      mockSettingStore(false)
      expect(store.isEnabled()).toBe(false)
    })
  })
})
