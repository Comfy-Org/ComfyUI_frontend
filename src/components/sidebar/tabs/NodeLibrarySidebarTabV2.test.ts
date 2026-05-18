import { createTestingPinia } from '@pinia/testing'
import { ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import { render, screen } from '@testing-library/vue'

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

  function renderComponent() {
    return render(NodeLibrarySidebarTabV2, {
      global: {
        plugins: [createTestingPinia({ stubActions: false }), i18n],
        stubs: {
          teleport: true
        }
      }
    })
  }

  it('should render with tabs', () => {
    renderComponent()

    const triggers = screen.getAllByRole('tab')
    expect(triggers).toHaveLength(3)
  })

  it('should render search box', () => {
    renderComponent()

    expect(screen.getByTestId('search-box')).toBeInTheDocument()
  })

  it('should render only the selected panel', () => {
    renderComponent()

    expect(screen.getByTestId('essential-panel')).toBeInTheDocument()
    expect(screen.queryByTestId('all-panel')).not.toBeInTheDocument()
    expect(screen.queryByTestId('blueprints-panel')).not.toBeInTheDocument()
  })
})
