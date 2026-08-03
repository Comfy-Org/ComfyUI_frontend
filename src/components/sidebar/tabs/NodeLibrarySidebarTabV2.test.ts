import { createTestingPinia } from '@pinia/testing'
import userEvent from '@testing-library/user-event'
import { fireEvent, render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { createI18n } from 'vue-i18n'

import NodeLibrarySidebarTabV2 from './NodeLibrarySidebarTabV2.vue'

const hoisted = vi.hoisted(() => ({
  mockSearchNode: vi.fn<(query: string) => unknown[]>(() => [])
}))

vi.mock('@/services/nodeSearchService', () => ({
  NodeSearchService: class {
    searchNode = hoisted.mockSearchNode
  }
}))

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
    startDrag: vi.fn(),
    cancelDrag: vi.fn()
  })
}))

vi.mock('@/services/nodeOrganizationService', () => ({
  DEFAULT_TAB_ID: 'essentials',
  DEFAULT_SORTING_ID: 'alphabetical',
  nodeOrganizationService: {
    organizeNodesTab: vi.fn(() => []),
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
    template:
      '<input data-testid="search-box" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
    props: ['modelValue', 'placeholder'],
    emits: ['update:modelValue', 'search'],
    setup() {
      return { focus: vi.fn() }
    },
    expose: ['focus']
  }
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      sideToolbar: {
        nodeLibraryTab: {
          noMatchingNodes: 'No nodes match "{query}"'
        }
      }
    }
  }
})

describe('NodeLibrarySidebarTabV2', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    hoisted.mockSearchNode.mockReset()
    hoisted.mockSearchNode.mockReturnValue([])
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
    expect(triggers).toHaveLength(2)
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

  describe('search empty state', () => {
    it('does not render the empty state when search query is empty', () => {
      renderComponent()

      expect(screen.queryByText(/No nodes match/)).not.toBeInTheDocument()
      expect(screen.getByTestId('essential-panel')).toBeInTheDocument()
    })

    it('renders the empty state with the query when search has no matches', async () => {
      const user = userEvent.setup()
      hoisted.mockSearchNode.mockReturnValue([])
      renderComponent()

      const [, allTab] = screen.getAllByRole('tab')
      await user.click(allTab)
      await fireEvent.update(screen.getByTestId('search-box'), 'gibberish')

      expect(screen.getByText('No nodes match "gibberish"')).toBeInTheDocument()
      expect(screen.queryByTestId('all-panel')).not.toBeInTheDocument()
    })

    it('hides the empty state when the search has matches', async () => {
      hoisted.mockSearchNode.mockReturnValue([{ name: 'KSampler' }])
      renderComponent()

      await fireEvent.update(screen.getByTestId('search-box'), 'ksampler')

      expect(screen.queryByText(/No nodes match/)).not.toBeInTheDocument()
      expect(screen.getByTestId('essential-panel')).toBeInTheDocument()
    })

    it('hides the empty state once the query is cleared', async () => {
      const user = userEvent.setup()
      hoisted.mockSearchNode.mockReturnValue([])
      renderComponent()

      const [, allTab] = screen.getAllByRole('tab')
      await user.click(allTab)

      const input = screen.getByTestId('search-box')
      await fireEvent.update(input, 'gibberish')
      expect(screen.getByText('No nodes match "gibberish"')).toBeInTheDocument()

      await fireEvent.update(input, '')

      expect(screen.queryByText(/No nodes match/)).not.toBeInTheDocument()
      expect(screen.getByTestId('all-panel')).toBeInTheDocument()
    })
  })
})
