import { fromPartial } from '@total-typescript/shoehorn'
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import { useLitegraphService } from '@/services/litegraphService'
import { useSettingStore } from '@/platform/settings/settingStore'
import { NodeSearchService } from '@/services/nodeSearchService'
import type { ComfyNodeDefImpl } from '@/stores/nodeDefStore'
import type { TreeExplorerNode, TreeNode } from '@/types/treeExplorerTypes'

import NodeLibrarySidebarTab from './NodeLibrarySidebarTab.vue'

const {
  captureRoot,
  getRoot,
  resetRoot,
  mockSearchNode,
  mockOrganizeNodes,
  mockToggleNodeOnEvent
} = vi.hoisted(() => {
  let capturedRoot: TreeExplorerNode | null = null
  return {
    captureRoot: (root: TreeExplorerNode) => {
      capturedRoot = root
    },
    getRoot: () => capturedRoot as TreeExplorerNode<ComfyNodeDefImpl>,
    resetRoot: () => {
      capturedRoot = null
    },
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

vi.mock(import('@/services/litegraphService'))

vi.mock<unknown>(import('@/services/nodeOrganizationService'), () => ({
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

vi.mock<unknown>(import('@/composables/useTreeExpansion'), () => ({
  useTreeExpansion: () => ({
    expandNode: vi.fn(),
    toggleNodeOnEvent: mockToggleNodeOnEvent
  })
}))

vi.mock<unknown>(import('@/components/common/TreeExplorer.vue'), () => ({
  default: {
    name: 'TreeExplorer',
    template: '<div data-testid="tree-explorer" />',
    props: ['root', 'expandedKeys'],
    setup(props: { root: TreeExplorerNode }) {
      captureRoot(props.root)
    }
  }
}))

vi.mock<unknown>(import('./nodeLibrary/NodeBookmarkTreeExplorer.vue'), () => ({
  default: {
    name: 'NodeBookmarkTreeExplorer',
    template: '<div />',
    props: ['filteredNodeDefs', 'openNodeHelp']
  }
}))

vi.mock<unknown>(import('./SidebarTabTemplate.vue'), () => ({
  default: {
    name: 'SidebarTabTemplate',
    template: '<div><slot name="header" /><slot name="body" /></div>'
  }
}))

vi.mock<unknown>(import('@/components/common/SearchFilterChip.vue'), () => ({
  default: {
    name: 'SearchFilterChip',
    template:
      '<div data-testid="filter-chip"><button data-testid="remove-filter" @click="$emit(\'remove\')">X</button></div>',
    props: ['text', 'badge', 'badgeClass']
  }
}))

vi.mock<unknown>(import('@/components/searchbox/NodeSearchFilter.vue'), () => ({
  default: {
    name: 'NodeSearchFilter',
    template:
      "<div data-testid=\"node-search-filter\" @click=\"$emit('add-filter', { filterDef: { invokeSequence: 'test' }, value: 'test-val' })\" />"
  }
}))

vi.mock<unknown>(import('@/components/ui/popover/PopoverOverlay.vue'), () => ({
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
    resetRoot()
    useSettingStore().$patch({
      settingValues: { 'Comfy.NodeLibrary.Bookmarks.V2': [] }
    })
    vi.spyOn(NodeSearchService.prototype, 'searchNode').mockImplementation(
      mockSearchNode
    )
  })

  function renderComponent() {
    return render(NodeLibrarySidebarTab, {
      global: {
        plugins: [i18n],
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
    expect(useLitegraphService().addNodeOnGraph).toHaveBeenCalledWith(mockNode)
  })

  it('adds and removes filters', async () => {
    const user = userEvent.setup()
    renderComponent()
    await nextTick()

    // Add filter by clicking the mocked search filter
    await user.click(screen.getByRole('button', { name: 'g.filter' }))
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
