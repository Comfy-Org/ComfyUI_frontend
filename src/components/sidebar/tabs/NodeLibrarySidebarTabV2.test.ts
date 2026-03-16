import { mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import type { TestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import { useNodeHelpStore } from '@/stores/workspace/nodeHelpStore'

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

vi.mock('./nodeLibrary/BlueprintsPanel.vue', () => ({
  default: {
    name: 'BlueprintsPanel',
    template: '<div data-testid="blueprints-panel"><slot /></div>',
    props: ['sections', 'expandedKeys']
  }
}))

vi.mock('./nodeLibrary/EssentialNodesPanel.vue', () => ({
  default: {
    name: 'EssentialNodesPanel',
    template: '<div data-testid="essential-panel"><slot /></div>',
    props: ['root', 'expandedKeys', 'flatNodes']
  }
}))

vi.mock('./nodeLibrary/NodeDragPreview.vue', () => ({
  default: {
    name: 'NodeDragPreview',
    template: '<div />'
  }
}))

vi.mock('@/components/sidebar/tabs/nodeLibrary/NodeHelpPage.vue', () => ({
  default: {
    name: 'NodeHelpPage',
    template: '<div data-testid="node-help-page">{{ node.display_name }}</div>',
    props: ['node']
  }
}))

vi.mock('@/components/ui/search-input/SearchInput.vue', () => ({
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

  function createTestPinia(): TestingPinia {
    const pinia = createTestingPinia({ stubActions: false })
    setActivePinia(pinia)
    return pinia
  }

  function mountComponent(pinia = createTestPinia()) {
    return mount(NodeLibrarySidebarTabV2, {
      global: {
        plugins: [pinia, i18n],
        stubs: {
          teleport: true
        }
      }
    })
  }

  it('should render with tabs', () => {
    const wrapper = mountComponent()

    const triggers = wrapper.findAll('[role="tab"]')
    expect(triggers).toHaveLength(3)
  })

  it('should render search box', () => {
    const wrapper = mountComponent()

    expect(wrapper.find('[data-testid="search-box"]').exists()).toBe(true)
  })

  it('should render only the selected panel', () => {
    const wrapper = mountComponent()

    expect(wrapper.find('[data-testid="essential-panel"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="all-panel"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="blueprints-panel"]').exists()).toBe(
      false
    )
  })

  it('should render node help instead of the node library when help is open', () => {
    const pinia = createTestPinia()
    const nodeHelpStore = useNodeHelpStore()
    nodeHelpStore.openHelp({
      nodePath: 'loaders/LoadImage',
      display_name: 'Load Image'
    } as Parameters<typeof nodeHelpStore.openHelp>[0])

    const wrapper = mountComponent(pinia)

    expect(wrapper.find('[data-testid="node-help-page"]').text()).toContain(
      'Load Image'
    )
    expect(wrapper.find('[data-testid="search-box"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="essential-panel"]').exists()).toBe(false)
  })
})
