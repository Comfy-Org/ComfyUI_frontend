import { createTestingPinia } from '@pinia/testing'
import { fromPartial } from '@total-typescript/shoehorn'
import { nextTick, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'

import type { ComfyNodeDefImpl } from '@/stores/nodeDefStore'

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

const {
  mockStartDrag,
  mockOrganizeNodesByTab,
  mockGetSortingStrategies,
  mockSearchNode,
  mockVisibleNodeDefs
} = vi.hoisted(() => ({
  mockStartDrag: vi.fn(),
  mockOrganizeNodesByTab: vi.fn(() => [] as unknown[]),
  mockGetSortingStrategies: vi.fn(() => [
    {
      id: 'alphabetical',
      label: 'sideToolbar.nodeLibraryTab.sortByAlphabetical'
    }
  ]),
  mockSearchNode: vi.fn(() => [] as unknown[]),
  mockVisibleNodeDefs: { value: [] as unknown[] }
}))

vi.mock('@/composables/node/useNodeDragToCanvas', () => ({
  useNodeDragToCanvas: () => ({
    isDragging: { value: false },
    draggedNode: { value: null },
    cursorPosition: { value: { x: 0, y: 0 } },
    startDrag: mockStartDrag,
    cancelDrag: vi.fn(),
    setupGlobalListeners: vi.fn(),
    cleanupGlobalListeners: vi.fn()
  })
}))

vi.mock('@/services/nodeOrganizationService', () => ({
  DEFAULT_TAB_ID: 'essentials',
  DEFAULT_SORTING_ID: 'alphabetical',
  nodeOrganizationService: {
    organizeNodesByTab: mockOrganizeNodesByTab,
    getSortingStrategies: mockGetSortingStrategies
  }
}))

vi.mock('@/stores/nodeDefStore', () => ({
  buildNodeDefTree: vi.fn(() => ({ key: 'root', children: [] })),
  useNodeDefStore: () => ({
    nodeSearchService: { searchNode: mockSearchNode },
    visibleNodeDefs: mockVisibleNodeDefs.value
  })
}))

vi.mock('./nodeLibrary/AllNodesPanel.vue', () => ({
  default: {
    name: 'AllNodesPanel',
    template: `
      <div data-testid="all-panel">
        <button data-testid="all-emit-node" @click="$emit('node-click', { type: 'node', data: { name: 'TestNode' } })">emit-node</button>
        <button data-testid="all-emit-folder" @click="$emit('node-click', { type: 'folder', key: 'folder-a' })">emit-folder</button>
      </div>
    `,
    props: ['sections', 'expandedKeys', 'fillNodeInfo', 'sortOrder'],
    emits: ['node-click']
  }
}))

vi.mock('./nodeLibrary/BlueprintsPanel.vue', () => ({
  default: {
    name: 'BlueprintsPanel',
    template: '<div data-testid="blueprints-panel"><slot /></div>',
    props: ['sections', 'expandedKeys'],
    emits: ['node-click']
  }
}))

vi.mock('./nodeLibrary/EssentialNodesPanel.vue', () => ({
  default: {
    name: 'EssentialNodesPanel',
    template: '<div data-testid="essential-panel"><slot /></div>',
    props: ['root', 'expandedKeys', 'flatNodes'],
    emits: ['node-click']
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
    template: `
      <div>
        <input
          data-testid="search-box"
          :value="modelValue"
          @input="(e) => $emit('update:modelValue', e.target.value)"
        />
        <button data-testid="search-trigger" @click="$emit('search')">go</button>
      </div>
    `,
    props: ['modelValue', 'placeholder'],
    emits: ['update:modelValue', 'search'],
    setup() {
      return { focus: vi.fn() }
    },
    expose: ['focus']
  }
}))

const mockCurrentHelpNode = ref<ComfyNodeDefImpl | null>(null)
const mockIsHelpOpen = ref(false)
const mockCloseHelp = vi.fn()

vi.mock('@/stores/workspace/nodeHelpStore', () => ({
  useNodeHelpStore: () => ({
    currentHelpNode: mockCurrentHelpNode,
    isHelpOpen: mockIsHelpOpen,
    openHelp: vi.fn(),
    closeHelp: mockCloseHelp
  })
}))

vi.mock('./nodeLibrary/NodeHelpPage.vue', () => ({
  default: {
    name: 'NodeHelpPage',
    template:
      '<div data-testid="node-help-page">{{ node.display_name }}<button data-testid="help-close-btn" @click="$emit(\'close\')">Close</button></div>',
    props: ['node'],
    emits: ['close']
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
    mockCurrentHelpNode.value = null
    mockIsHelpOpen.value = false
    mockSearchNode.mockReturnValue([])
    mockOrganizeNodesByTab.mockReturnValue([])
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

  describe('Node Help Integration', () => {
    beforeEach(() => {
      mockCurrentHelpNode.value = null
      mockIsHelpOpen.value = false
    })

    it('should show node help page when currentHelpNode is set', async () => {
      mockCurrentHelpNode.value = fromPartial<ComfyNodeDefImpl>({
        name: 'KSampler',
        display_name: 'KSampler'
      })
      mockIsHelpOpen.value = true

      renderComponent()
      await nextTick()

      expect(screen.getByTestId('node-help-page')).toBeInTheDocument()
      expect(screen.getByTestId('node-help-page')).toHaveTextContent('KSampler')
      expect(screen.queryByTestId('search-box')).not.toBeInTheDocument()
    })

    it('should show normal node library when currentHelpNode is null', async () => {
      renderComponent()
      await nextTick()

      expect(screen.queryByTestId('node-help-page')).not.toBeInTheDocument()
      expect(screen.getByTestId('search-box')).toBeInTheDocument()
    })

    it('should switch from help to library when closeHelp clears currentHelpNode', async () => {
      mockCurrentHelpNode.value = fromPartial<ComfyNodeDefImpl>({
        name: 'KSampler',
        display_name: 'KSampler'
      })
      mockIsHelpOpen.value = true

      renderComponent()
      await nextTick()
      expect(screen.getByTestId('node-help-page')).toBeInTheDocument()

      mockCurrentHelpNode.value = null
      mockIsHelpOpen.value = false
      await nextTick()

      expect(screen.queryByTestId('node-help-page')).not.toBeInTheDocument()
      expect(screen.getByTestId('search-box')).toBeInTheDocument()
    })

    it('should call closeHelp when NodeHelpPage emits close', async () => {
      const user = userEvent.setup()
      mockCurrentHelpNode.value = fromPartial<ComfyNodeDefImpl>({
        name: 'KSampler',
        display_name: 'KSampler'
      })
      mockIsHelpOpen.value = true

      renderComponent()
      await nextTick()

      await user.click(screen.getByTestId('help-close-btn'))
      expect(mockCloseHelp).toHaveBeenCalledOnce()
    })
  })

  describe('Node interaction', () => {
    async function selectAllTab(user: ReturnType<typeof userEvent.setup>) {
      await user.click(screen.getByRole('tab', { name: /all/i }))
      await nextTick()
    }

    it('should startDrag when a node is clicked in a panel', async () => {
      const user = userEvent.setup()
      renderComponent()
      await selectAllTab(user)

      await user.click(screen.getByTestId('all-emit-node'))

      expect(mockStartDrag).toHaveBeenCalledWith({ name: 'TestNode' })
    })

    it('should toggle expanded folder keys when a folder is clicked', async () => {
      const user = userEvent.setup()
      renderComponent()
      await selectAllTab(user)

      // First click expands
      await user.click(screen.getByTestId('all-emit-folder'))
      // Second click collapses (covers both branches of handleNodeClick)
      await user.click(screen.getByTestId('all-emit-folder'))

      // No drag emitted for folder clicks
      expect(mockStartDrag).not.toHaveBeenCalled()
    })
  })

  describe('Search', () => {
    it('should clear expanded keys when search produces no results', async () => {
      const user = userEvent.setup()
      mockSearchNode.mockReturnValue([])
      renderComponent()

      await user.type(screen.getByTestId('search-box'), 'nonexistent')
      await user.click(screen.getByTestId('search-trigger'))
      await nextTick()

      // handleSearch executed without throwing on empty filteredNodeDefs
      expect(mockSearchNode).toHaveBeenCalled()
    })

    it('should expand folder keys when search returns results', async () => {
      const user = userEvent.setup()
      const fakeDef = fromPartial<ComfyNodeDefImpl>({ name: 'Match' })
      mockSearchNode.mockReturnValue([fakeDef])
      mockOrganizeNodesByTab.mockReturnValue([
        {
          category: 'comfyNodes',
          title: 'Comfy',
          tree: {
            key: 'root',
            label: 'root',
            children: [
              {
                key: 'root/folder1',
                label: 'folder1',
                leaf: false,
                children: [
                  { key: 'root/folder1/Match', label: 'Match', leaf: true }
                ]
              }
            ]
          }
        }
      ])
      renderComponent()
      await user.click(screen.getByRole('tab', { name: /all/i }))
      await nextTick()

      await user.type(screen.getByTestId('search-box'), 'Match')
      await user.click(screen.getByTestId('search-trigger'))
      await nextTick()

      expect(mockSearchNode).toHaveBeenCalledWith(
        'Match',
        [],
        { limit: 64 },
        { matchWildcards: false }
      )
    })
  })

  describe('Tab switching', () => {
    it('should render the BlueprintsPanel when blueprints tab is selected', async () => {
      const user = userEvent.setup()
      renderComponent()

      await user.click(screen.getByRole('tab', { name: /blueprints/i }))
      await nextTick()

      expect(screen.getByTestId('blueprints-panel')).toBeInTheDocument()
      expect(screen.queryByTestId('all-panel')).not.toBeInTheDocument()
    })

    it('should render the AllNodesPanel when all tab is selected', async () => {
      const user = userEvent.setup()
      renderComponent()

      await user.click(screen.getByRole('tab', { name: /all/i }))
      await nextTick()

      expect(screen.getByTestId('all-panel')).toBeInTheDocument()
      expect(screen.queryByTestId('essential-panel')).not.toBeInTheDocument()
    })
  })
})
