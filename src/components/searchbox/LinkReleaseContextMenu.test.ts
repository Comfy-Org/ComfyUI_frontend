import { createTestingPinia } from '@pinia/testing'
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import type { ComfyNodeDefImpl } from '@/stores/nodeDefStore'

import LinkReleaseContextMenu from './LinkReleaseContextMenu.vue'
import type {
  LinkReleaseNodeCategory,
  LinkReleaseSearchResultGroup
} from './linkReleaseMenuModel'

const { groups } = vi.hoisted(() => ({
  groups: {
    suggestions: [] as ComfyNodeDefImpl[],
    categories: [] as LinkReleaseNodeCategory[],
    searchResultGroups: [] as LinkReleaseSearchResultGroup[]
  }
}))

vi.mock('./linkReleaseMenuModel', () => ({
  getLinkReleaseHeaderLabel: () => '',
  getLinkReleaseSuggestions: () => groups.suggestions,
  buildLinkReleaseNodeCategories: () => groups.categories,
  groupLinkReleaseSearchResults: () => groups.searchResultGroups,
  searchLinkReleaseNodes: () =>
    groups.searchResultGroups.flatMap((group) =>
      group.nodes.map((node) => ({ category: group.category, node }))
    ),
  filterNodesByName: () => []
}))

const i18n = createI18n({ legacy: false, locale: 'en', messages: { en: {} } })

const stubs = {
  DropdownMenuRoot: { template: '<div><slot /></div>' },
  DropdownMenuTrigger: { template: '<div><slot /></div>' },
  DropdownMenuPortal: { template: '<div><slot /></div>' },
  DropdownMenuContent: { template: '<div role="menu"><slot /></div>' },
  DropdownMenuLabel: { template: '<div><slot /></div>' },
  DropdownMenuItem: {
    emits: ['select'],
    template:
      '<div role="menuitem" tabindex="-1" @click="$emit(\'select\')"><slot /></div>'
  },
  DropdownMenuSeparator: { template: '<hr data-testid="menu-separator" />' },
  LinkReleaseNodeSubmenu: { template: '<div data-testid="submenu" />' },
  MiddleTruncate: { template: '<span>{{ text }}</span>', props: ['text'] }
}

function suggestion(name: string): ComfyNodeDefImpl {
  return { name, display_name: name } as ComfyNodeDefImpl
}

function nodeCategory(
  key: 'comfy' | 'extensions' | 'partner',
  labelKey: string = key
): LinkReleaseNodeCategory {
  return { key, labelKey, icon: '', nodes: [suggestion('Node')] }
}

function renderMenu() {
  return render(LinkReleaseContextMenu, {
    props: { context: null },
    global: { plugins: [i18n, createTestingPinia()], stubs }
  })
}

describe('LinkReleaseContextMenu group divider', () => {
  beforeEach(() => {
    groups.suggestions = []
    groups.categories = []
    groups.searchResultGroups = []
  })

  it('renders a divider between the suggestions and categories groups', () => {
    groups.suggestions = [suggestion('KSampler')]
    groups.categories = [nodeCategory('comfy')]
    renderMenu()

    expect(screen.getAllByTestId('menu-separator')).toHaveLength(3)
  })

  it('omits the group divider when only one group is present', () => {
    groups.suggestions = []
    groups.categories = [nodeCategory('comfy')]
    renderMenu()

    expect(screen.getAllByTestId('menu-separator')).toHaveLength(2)
  })

  it('renders a divider between search result groups', async () => {
    groups.suggestions = []
    groups.categories = []
    groups.searchResultGroups = [
      {
        category: nodeCategory('extensions', 'contextMenu.Extensions'),
        nodes: [suggestion('Ext Node')]
      },
      {
        category: nodeCategory('partner', 'contextMenu.Partner Nodes'),
        nodes: [suggestion('Partner Node')]
      }
    ]
    renderMenu()

    await userEvent.type(screen.getByRole('textbox'), 'na')

    expect(screen.getAllByTestId('menu-separator')).toHaveLength(2)
  })
})

describe('LinkReleaseContextMenu selection', () => {
  beforeEach(() => {
    groups.suggestions = []
    groups.categories = []
    groups.searchResultGroups = []
  })

  function renderMenuWith(handlers: Record<string, unknown>) {
    return render(LinkReleaseContextMenu, {
      props: { context: null, ...handlers },
      global: { plugins: [i18n, createTestingPinia()], stubs }
    })
  }

  it('emits selectNode when a suggestion is chosen', async () => {
    groups.suggestions = [suggestion('KSampler')]
    const onSelectNode = vi.fn()
    renderMenuWith({ onSelectNode })

    await userEvent.click(screen.getByText('KSampler'))

    expect(onSelectNode).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'KSampler' })
    )
  })

  it('emits addReroute when the reroute item is chosen', async () => {
    groups.suggestions = [suggestion('KSampler')]
    const onAddReroute = vi.fn()
    renderMenuWith({ onAddReroute })

    await userEvent.click(screen.getByText('contextMenu.Add Reroute'))

    expect(onAddReroute).toHaveBeenCalled()
  })

  it('selects the first search result on Enter in the search field', async () => {
    groups.searchResultGroups = [
      {
        category: nodeCategory('comfy', 'contextMenu.Comfy Nodes'),
        nodes: [suggestion('Found Node')]
      }
    ]
    const onSelectNode = vi.fn()
    renderMenuWith({ onSelectNode })

    const search = screen.getByRole('textbox')
    await userEvent.type(search, 'fo')
    await userEvent.keyboard('{Enter}')

    expect(onSelectNode).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Found Node' })
    )
  })

  it('moves focus to the first item on ArrowDown from the search', async () => {
    groups.suggestions = [suggestion('KSampler')]
    renderMenu()

    const search = screen.getByRole('textbox')
    search.focus()
    await userEvent.keyboard('{ArrowDown}')

    expect(screen.getAllByRole('menuitem')[0]).toHaveFocus()
  })
})
