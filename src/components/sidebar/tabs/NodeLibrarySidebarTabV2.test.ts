import { computed, ref } from 'vue'
import { describe, expect, it } from 'vitest'

import type { TabId } from '@/types/nodeOrganizationTypes'

describe('NodeLibrarySidebarTabV2 expandedKeys logic', () => {
  describe('per-tab expandedKeys', () => {
    function createExpandedKeysState(initialTab: TabId = 'essential') {
      const selectedTab = ref<TabId>(initialTab)
      const expandedKeysByTab = ref<Record<TabId, string[]>>({
        essential: [],
        all: [],
        custom: []
      })
      const expandedKeys = computed({
        get: () => expandedKeysByTab.value[selectedTab.value],
        set: (value) => {
          expandedKeysByTab.value[selectedTab.value] = value
        }
      })

      return { selectedTab, expandedKeysByTab, expandedKeys }
    }

    it('should initialize with empty arrays for all tabs', () => {
      const { expandedKeysByTab } = createExpandedKeysState()

      expect(expandedKeysByTab.value.essential).toEqual([])
      expect(expandedKeysByTab.value.all).toEqual([])
      expect(expandedKeysByTab.value.custom).toEqual([])
    })

    it('should return keys for the current tab', () => {
      const { selectedTab, expandedKeysByTab, expandedKeys } =
        createExpandedKeysState('essential')

      expandedKeysByTab.value.essential = ['key1', 'key2']
      expandedKeysByTab.value.all = ['key3']

      expect(expandedKeys.value).toEqual(['key1', 'key2'])

      selectedTab.value = 'all'
      expect(expandedKeys.value).toEqual(['key3'])
    })

    it('should set keys only for the current tab', () => {
      const { expandedKeysByTab, expandedKeys } =
        createExpandedKeysState('essential')

      expandedKeys.value = ['new-key1', 'new-key2']

      expect(expandedKeysByTab.value.essential).toEqual([
        'new-key1',
        'new-key2'
      ])
      expect(expandedKeysByTab.value.all).toEqual([])
      expect(expandedKeysByTab.value.custom).toEqual([])
    })

    it('should preserve keys when switching tabs', () => {
      const { selectedTab, expandedKeysByTab, expandedKeys } =
        createExpandedKeysState('essential')

      expandedKeys.value = ['essential-key']
      selectedTab.value = 'all'
      expandedKeys.value = ['all-key']
      selectedTab.value = 'custom'
      expandedKeys.value = ['custom-key']

      expect(expandedKeysByTab.value.essential).toEqual(['essential-key'])
      expect(expandedKeysByTab.value.all).toEqual(['all-key'])
      expect(expandedKeysByTab.value.custom).toEqual(['custom-key'])

      selectedTab.value = 'essential'
      expect(expandedKeys.value).toEqual(['essential-key'])
    })

    it('should not share keys between tabs', () => {
      const { selectedTab, expandedKeys } = createExpandedKeysState('essential')

      expandedKeys.value = ['shared-key']

      selectedTab.value = 'all'
      expect(expandedKeys.value).toEqual([])

      selectedTab.value = 'custom'
      expect(expandedKeys.value).toEqual([])

      selectedTab.value = 'essential'
      expect(expandedKeys.value).toEqual(['shared-key'])
    })
  })
})
