import { mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import { TabsContent, TabsList, TabsRoot, TabsTrigger } from 'reka-ui'
import { computed, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import type { TabId } from '@/types/nodeOrganizationTypes'

import NodeLibrarySidebarTabV2 from './NodeLibrarySidebarTabV2.vue'

vi.mock('@vueuse/core', async () => {
  const actual = await vi.importActual('@vueuse/core')
  return {
    ...actual,
    useLocalStorage: vi.fn((_key: string, defaultValue: unknown) =>
      ref(defaultValue)
    )
  }
})

vi.mock('@/composables/node/useNodeDragToCanvas', () => ({
  useNodeDragToCanvas: () => ({
    isDragging: { value: false },
    draggedNode: { value: null },
    cursorPosition: { value: { x: 0, y: 0 } },
    startDrag: vi.fn(),
    cancelDrag: vi.fn(),
    setupGlobalListeners: vi.fn(),
    cleanupGlobalListeners: vi.fn()
  })
}))

vi.mock('@/services/nodeOrganizationService', () => ({
  DEFAULT_TAB_ID: 'essentials',
  DEFAULT_SORTING_ID: 'alphabetical',
  nodeOrganizationService: {
    organizeNodesByTab: vi.fn(() => []),
    getSortingStrategies: vi.fn(() => [])
  }
}))

vi.mock('./nodeLibrary/AllNodesPanel.vue', () => ({
  default: {
    name: 'AllNodesPanel',
    template: '<div data-testid="all-panel"><slot /></div>',
    props: ['sections', 'expandedKeys', 'fillNodeInfo']
  }
}))

vi.mock('./nodeLibrary/CustomNodesPanel.vue', () => ({
  default: {
    name: 'CustomNodesPanel',
    template: '<div data-testid="custom-panel"><slot /></div>',
    props: ['sections', 'expandedKeys']
  }
}))

vi.mock('./nodeLibrary/EssentialNodesPanel.vue', () => ({
  default: {
    name: 'EssentialNodesPanel',
    template: '<div data-testid="essential-panel"><slot /></div>',
    props: ['root', 'expandedKeys']
  }
}))

vi.mock('./nodeLibrary/NodeDragPreview.vue', () => ({
  default: {
    name: 'NodeDragPreview',
    template: '<div />'
  }
}))

vi.mock('@/components/common/SearchBoxV2.vue', () => ({
  default: {
    name: 'SearchBox',
    template: '<input data-testid="search-box" />',
    props: ['modelValue', 'placeholder'],
    setup() {
      return { focus: vi.fn() }
    },
    expose: ['focus']
  }
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: {} }
})

describe('NodeLibrarySidebarTabV2', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function mountComponent() {
    return mount(NodeLibrarySidebarTabV2, {
      global: {
        plugins: [createTestingPinia({ stubActions: false }), i18n],
        components: {
          TabsRoot,
          TabsList,
          TabsTrigger,
          TabsContent
        },
        stubs: {
          teleport: true
        }
      }
    })
  }

  it('should render with tabs', () => {
    const wrapper = mountComponent()

    const triggers = wrapper.findAllComponents(TabsTrigger)
    expect(triggers.length).toBe(3)
  })

  it('should render search box', () => {
    const wrapper = mountComponent()

    expect(wrapper.find('[data-testid="search-box"]').exists()).toBe(true)
  })

  it('should render only the selected panel', () => {
    const wrapper = mountComponent()

    expect(wrapper.find('[data-testid="essential-panel"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="all-panel"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="custom-panel"]').exists()).toBe(false)
  })
})

describe('NodeLibrarySidebarTabV2 expandedKeys logic', () => {
  describe('per-tab expandedKeys', () => {
    function createExpandedKeysState(initialTab: TabId = 'essentials') {
      const selectedTab = ref<TabId>(initialTab)
      const expandedKeysByTab = ref<Record<TabId, string[]>>({
        essentials: [],
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

      expect(expandedKeysByTab.value.essentials).toEqual([])
      expect(expandedKeysByTab.value.all).toEqual([])
      expect(expandedKeysByTab.value.custom).toEqual([])
    })

    it('should return keys for the current tab', () => {
      const { selectedTab, expandedKeysByTab, expandedKeys } =
        createExpandedKeysState('essentials')

      expandedKeysByTab.value.essentials = ['key1', 'key2']
      expandedKeysByTab.value.all = ['key3']

      expect(expandedKeys.value).toEqual(['key1', 'key2'])

      selectedTab.value = 'all'
      expect(expandedKeys.value).toEqual(['key3'])
    })

    it('should set keys only for the current tab', () => {
      const { expandedKeysByTab, expandedKeys } =
        createExpandedKeysState('essentials')

      expandedKeys.value = ['new-key1', 'new-key2']

      expect(expandedKeysByTab.value.essentials).toEqual([
        'new-key1',
        'new-key2'
      ])
      expect(expandedKeysByTab.value.all).toEqual([])
      expect(expandedKeysByTab.value.custom).toEqual([])
    })

    it('should preserve keys when switching tabs', () => {
      const { selectedTab, expandedKeysByTab, expandedKeys } =
        createExpandedKeysState('essentials')

      expandedKeys.value = ['essentials-key']
      selectedTab.value = 'all'
      expandedKeys.value = ['all-key']
      selectedTab.value = 'custom'
      expandedKeys.value = ['custom-key']

      expect(expandedKeysByTab.value.essentials).toEqual(['essentials-key'])
      expect(expandedKeysByTab.value.all).toEqual(['all-key'])
      expect(expandedKeysByTab.value.custom).toEqual(['custom-key'])

      selectedTab.value = 'essentials'
      expect(expandedKeys.value).toEqual(['essentials-key'])
    })

    it('should not share keys between tabs', () => {
      const { selectedTab, expandedKeys } =
        createExpandedKeysState('essentials')

      expandedKeys.value = ['shared-key']

      selectedTab.value = 'all'
      expect(expandedKeys.value).toEqual([])

      selectedTab.value = 'custom'
      expect(expandedKeys.value).toEqual([])

      selectedTab.value = 'essentials'
      expect(expandedKeys.value).toEqual(['shared-key'])
    })
  })
})
