import { getActivePinia } from 'pinia'
import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { useLocalStorage } from '@vueuse/core'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { createI18n } from 'vue-i18n'

import NodeLibrarySidebarTabV2 from './NodeLibrarySidebarTabV2.vue'

const hoisted = vi.hoisted(() => ({
  mockSearchNode: vi.fn<(query: string) => unknown[]>(() => [])
}))

vi.mock<unknown>(import('@/services/nodeSearchService'), () => ({
  NodeSearchService: class {
    searchNode = hoisted.mockSearchNode
  }
}))

vi.mock(import('@vueuse/core'), { spy: true })

vi.mock(import('@/composables/node/useNodeDragToCanvas'))

vi.mock<unknown>(import('@/services/nodeOrganizationService'), () => ({
  DEFAULT_TAB_ID: 'essentials',
  DEFAULT_SORTING_ID: 'alphabetical',
  nodeOrganizationService: {
    organizeNodesTab: vi.fn(() => []),
    getSortingStrategies: vi.fn(() => [])
  }
}))

vi.mock<unknown>(import('./nodeLibrary/AllNodesPanel.vue'), () => ({
  default: {
    name: 'AllNodesPanel',
    template: '<div data-testid="all-panel"><slot /></div>',
    props: ['sections', 'expandedKeys', 'fillNodeInfo']
  }
}))

vi.mock<unknown>(import('./nodeLibrary/EssentialNodesPanel.vue'), () => ({
  default: {
    name: 'EssentialNodesPanel',
    template: '<div data-testid="essential-panel"><slot /></div>',
    props: ['root', 'expandedKeys', 'flatNodes']
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
    vi.mocked(useLocalStorage).mockImplementation((_key, defaultValue) =>
      ref(defaultValue)
    )
    hoisted.mockSearchNode.mockReturnValue([])
  })

  function renderComponent() {
    return render(NodeLibrarySidebarTabV2, {
      global: {
        plugins: [getActivePinia()!, i18n],
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

    expect(screen.getByRole('combobox')).toBeInTheDocument()
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
      await user.type(screen.getByRole('combobox'), 'gibberish')

      expect(screen.getByText('No nodes match "gibberish"')).toBeInTheDocument()
      expect(screen.queryByTestId('all-panel')).not.toBeInTheDocument()
    })

    it('hides the empty state when the search has matches', async () => {
      const user = userEvent.setup()
      hoisted.mockSearchNode.mockReturnValue([{ name: 'KSampler' }])
      renderComponent()

      await user.type(screen.getByRole('combobox'), 'ksampler')

      expect(screen.queryByText(/No nodes match/)).not.toBeInTheDocument()
      expect(screen.getByTestId('essential-panel')).toBeInTheDocument()
    })

    it('hides the empty state once the query is cleared', async () => {
      const user = userEvent.setup()
      hoisted.mockSearchNode.mockReturnValue([])
      renderComponent()

      const [, allTab] = screen.getAllByRole('tab')
      await user.click(allTab)

      const input = screen.getByRole('combobox')
      await user.type(input, 'gibberish')
      expect(screen.getByText('No nodes match "gibberish"')).toBeInTheDocument()

      await user.clear(input)

      expect(screen.queryByText(/No nodes match/)).not.toBeInTheDocument()
      expect(screen.getByTestId('all-panel')).toBeInTheDocument()
    })
  })
})
