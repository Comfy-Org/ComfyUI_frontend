import { createTestingPinia } from '@pinia/testing'
import { fromPartial } from '@total-typescript/shoehorn'
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import type { TreeExplorerNode, TreeNode } from '@/types/treeExplorerTypes'
import type { ComfyNodeDefImpl } from '@/stores/nodeDefStore'

import NodeLibrarySidebarTab from './NodeLibrarySidebarTab.vue'

const {
  captureRoot,
  getRoot,
  resetRoot,
  mockAddNodeOnGraph,
  mockSearchNode,
  mockOrganizeNodes,
  mockToggleNodeOnEvent
} = vi.hoisted(() => {
  let capturedRoot: TreeExplorerNode<unknown> | null = null
  return {
    captureRoot: (root: TreeExplorerNode<unknown>) => {
      capturedRoot = root
    },
    getRoot: () => capturedRoot as TreeExplorerNode<ComfyNodeDefImpl>,
    resetRoot: () => {
      capturedRoot = null
    },
    mockAddNodeOnGraph: vi.fn(),
    mockSearchNode: vi.fn(() => []),
    mockOrganizeNodes: vi.fn(
      (): TreeNode => ({
        key: 'root',
        label: 'Root',
        children: []
      })
    ),
    mockToggleNodeOnEvent: vi.fn()
  }
})

vi.mock('@/services/litegraphService', () => ({
  useLitegraphService: () => ({ addNodeOnGraph: mockAddNodeOnGraph })
}))

vi.mock('@/services/nodeOrganizationService', () => ({
  DEFAULT_GROUPING_ID: 'group',
  DEFAULT_SORTING_ID: 'sort',
  nodeOrganizationService: {
    getGroupingStrategies: vi.fn(() => []),
    getSortingStrategies: vi.fn(() => []),
    getGroupingIcon: vi.fn(() => 'pi pi-folder'),
    getSortingIcon: vi.fn(() => 'pi pi-sort'),
    organizeNodes: mockOrganizeNodes
  }
}))

vi.mock('@/stores/nodeDefStore', () => ({
  useNodeDefStore: () => ({
    visibleNodeDefs: [],
    nodeSearchService: { searchNode: mockSearchNode }
  })
}))

vi.mock('@/stores/nodeBookmarkStore', () => ({
  useNodeBookmarkStore: () => ({
    bookmarks: []
  })
}))

vi.mock('@/stores/workspace/nodeHelpStore', () => ({
  useNodeHelpStore: () => ({
    currentHelpNode: ref(null),
    isHelpOpen: ref(false),
    openHelp: vi.fn(),
    closeHelp: vi.fn()
  })
}))

vi.mock('@/stores/commandStore', () => ({
  useCommandStore: () => ({
    execute: vi.fn()
  })
}))

vi.mock('@/composables/useTreeExpansion', () => ({
  useTreeExpansion: () => ({
    expandNode: vi.fn(),
    toggleNodeOnEvent: mockToggleNodeOnEvent
  })
}))

vi.mock('@/components/common/TreeExplorer.vue', () => ({
  default: {
    name: 'TreeExplorer',
    template: '<div data-testid="tree-explorer" />',
    props: ['root', 'expandedKeys'],
    setup(props: { root: TreeExplorerNode<unknown> }) {
      captureRoot(props.root)
    }
  }
}))

vi.mock('@/components/ui/search-input/SearchInput.vue', () => ({
  default: {
    name: 'SearchInput',
    template: '<input data-testid="search-input" />',
    props: ['modelValue', 'placeholder'],
    setup() {
      return { focus: vi.fn() }
    },
    expose: ['focus']
  }
}))

vi.mock('./nodeLibrary/NodeBookmarkTreeExplorer.vue', () => ({
  default: {
    name: 'NodeBookmarkTreeExplorer',
    template: '<div />',
    props: ['filteredNodeDefs', 'openNodeHelp']
  }
}))

vi.mock('./SidebarTabTemplate.vue', () => ({
  default: {
    name: 'SidebarTabTemplate',
    template: '<div><slot name="header" /><slot name="body" /></div>'
  }
}))

vi.mock('@/components/common/SearchFilterChip.vue', () => ({
  default: {
    name: 'SearchFilterChip',
    template:
      '<div data-testid="filter-chip"><button data-testid="remove-filter" @click="$emit(\'remove\')">X</button></div>',
    props: ['text', 'badge', 'badgeClass']
  }
}))

vi.mock('@/components/searchbox/NodeSearchFilter.vue', () => ({
  default: {
    name: 'NodeSearchFilter',
    template:
      "<div data-testid=\"node-search-filter\" @click=\"$emit('add-filter', { filterDef: { invokeSequence: 'test' }, value: 'test-val' })\" />"
  }
}))

vi.mock('primevue/divider', () => ({
  default: { name: 'Divider', template: '<div />' }
}))
vi.mock('primevue/popover', () => ({
  default: {
    name: 'Popover',
    template: '<div><slot /></div>',
    methods: { toggle: vi.fn(), hide: vi.fn() }
  }
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: {} }
})

const mockNode = fromPartial<ComfyNodeDefImpl>({
  name: 'CLIPTextEncode',
  display_name: 'CLIP Text Encode'
})

describe('NodeLibrarySidebarTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetRoot()
  })

  function renderComponent() {
    return render(NodeLibrarySidebarTab, {
      global: {
        plugins: [createTestingPinia({ stubActions: false }), i18n],
        stubs: { teleport: true }
      }
    })
  }

  it('handles node click and adds node to graph', async () => {
    mockOrganizeNodes.mockReturnValue({
      key: 'root',
      label: 'Root',
      children: [{ key: 'leaf', label: 'Leaf', leaf: true, data: mockNode }]
    })

    renderComponent()
    await nextTick()

    const root = getRoot()
    const leaf = root.children?.[0]
    expect(leaf?.leaf).toBe(true)

    await leaf?.handleClick?.(new MouseEvent('click'))
    expect(mockAddNodeOnGraph).toHaveBeenCalledWith(mockNode)
  })

  it('adds and removes filters', async () => {
    const user = userEvent.setup()
    renderComponent()
    await nextTick()

    // Add filter by clicking the mocked search filter
    const searchFilter = screen.getByTestId('node-search-filter')
    await user.click(searchFilter)
    await nextTick()

    expect(screen.getByTestId('filter-chip')).toBeInTheDocument()
    expect(mockSearchNode).toHaveBeenCalled()

    // Remove filter
    const removeButton = screen.getByTestId('remove-filter')
    await user.click(removeButton)
    await nextTick()

    expect(screen.queryByTestId('filter-chip')).not.toBeInTheDocument()
    expect(mockSearchNode).toHaveBeenCalledTimes(1)
  })
})
