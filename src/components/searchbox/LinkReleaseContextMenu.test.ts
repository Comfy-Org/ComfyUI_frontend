import { createTestingPinia } from '@pinia/testing'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import type { ComfyNodeDefImpl } from '@/stores/nodeDefStore'

import LinkReleaseContextMenu from './LinkReleaseContextMenu.vue'
import type { LinkReleaseNodeCategory } from './linkReleaseMenuModel'

const { groups } = vi.hoisted(() => ({
  groups: {
    suggestions: [] as ComfyNodeDefImpl[],
    categories: [] as LinkReleaseNodeCategory[]
  }
}))

vi.mock('./linkReleaseMenuModel', () => ({
  getLinkReleaseHeaderLabel: () => '',
  getLinkReleaseSuggestions: () => groups.suggestions,
  buildLinkReleaseNodeCategories: () => groups.categories,
  searchLinkReleaseNodes: () => [],
  filterNodesByName: () => []
}))

const i18n = createI18n({ legacy: false, locale: 'en', messages: { en: {} } })

const stubs = {
  DropdownMenuRoot: { template: '<div><slot /></div>' },
  DropdownMenuTrigger: { template: '<div><slot /></div>' },
  DropdownMenuPortal: { template: '<div><slot /></div>' },
  DropdownMenuContent: { template: '<div><slot /></div>' },
  DropdownMenuLabel: { template: '<div><slot /></div>' },
  DropdownMenuItem: { template: '<div role="menuitem"><slot /></div>' },
  DropdownMenuSeparator: { template: '<hr data-testid="menu-separator" />' },
  LinkReleaseNodeSubmenu: { template: '<div data-testid="submenu" />' },
  MiddleTruncate: { template: '<span>{{ text }}</span>', props: ['text'] }
}

function suggestion(name: string): ComfyNodeDefImpl {
  return { name, display_name: name } as ComfyNodeDefImpl
}

function nodeCategory(key: 'comfy' | 'extensions'): LinkReleaseNodeCategory {
  return { key, labelKey: key, icon: '', nodes: [suggestion('Node')] }
}

function renderMenu() {
  return render(LinkReleaseContextMenu, {
    props: { context: null },
    global: { plugins: [i18n, createTestingPinia()], stubs }
  })
}

describe('LinkReleaseContextMenu group divider', () => {
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
})
