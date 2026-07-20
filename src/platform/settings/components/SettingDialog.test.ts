import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import type { SettingTreeNode } from '@/platform/settings/settingStore'
import type { ISettingGroup, SettingParams } from '@/platform/settings/types'

import SettingDialog from './SettingDialog.vue'

const testI18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: {} }
})

type MockSettingData = Omit<SettingParams, 'id' | 'type' | 'defaultValue'> & {
  id: string
}

type MockSettingTreeNode = Omit<SettingTreeNode, 'data' | 'children'> & {
  data?: MockSettingData
  children?: MockSettingTreeNode[]
}

type MockSettingGroup = Omit<ISettingGroup, 'settings'> & {
  settings: MockSettingData[]
}

const mockFetchBalance = vi.hoisted(() => vi.fn())

const mockSettingUI = vi.hoisted(() => ({
  defaultPanel: undefined as string | undefined,
  refs: null as null | {
    settingCategories: {
      value: MockSettingTreeNode[]
    }
    navGroups: {
      value: Array<{
        title: string
        items: Array<{
          id: string
          label: string
          icon?: string
          badge?: string
        }>
      }>
    }
  }
}))

const mockSettingSearch = vi.hoisted(() => ({
  refs: null as null | {
    searchQuery: { value: string }
    inSearch: { value: boolean }
    searchResultsCategories: { value: Set<string> }
    matchedNavItemKeys: { value: Set<string> }
    results: { value: MockSettingGroup[] }
  },
  handleSearch: vi.fn()
}))

vi.mock('@/composables/billing/useBillingContext', () => ({
  useBillingContext: () => ({
    fetchBalance: mockFetchBalance
  })
}))

vi.mock('@/platform/telemetry/searchQuery/useSearchQueryTracking', () => ({
  useSearchQueryTracking: vi.fn()
}))

vi.mock('@/components/widget/layout/BaseModalLayout.vue', () => ({
  default: {
    template: `
      <section data-testid="settings-dialog">
        <header data-testid="left-title"><slot name="leftPanelHeaderTitle" /></header>
        <aside data-testid="left-panel"><slot name="leftPanel" /></aside>
        <div data-testid="header"><slot name="header" /></div>
        <div data-testid="header-actions"><slot name="header-right-area" /></div>
        <main data-testid="content"><slot name="content" /></main>
      </section>
    `
  }
}))

vi.mock('@/components/ui/search-input/SearchInput.vue', () => ({
  default: {
    props: ['modelValue', 'placeholder', 'autofocus'],
    emits: ['update:modelValue', 'search'],
    template: `
      <input
        data-testid="settings-search"
        :value="modelValue"
        :placeholder="placeholder"
        :data-autofocus="String(autofocus)"
        @input="$emit('update:modelValue', $event.target.value)"
        @change="$emit('search', $event.target.value)"
      />
    `
  }
}))

vi.mock('@/components/widget/nav/NavTitle.vue', () => ({
  default: {
    props: ['title'],
    template: '<h3>{{ title }}</h3>'
  }
}))

vi.mock('@/components/widget/nav/NavItem.vue', () => ({
  default: {
    props: ['icon', 'badge', 'active'],
    emits: ['click'],
    template: `
      <button
        type="button"
        :data-nav-id="$attrs['data-nav-id']"
        :data-active="String(active)"
        @click="$emit('click')"
      >
        <slot />
      </button>
    `
  }
}))

vi.mock('@/components/dialog/content/setting/CurrentUserMessage.vue', () => ({
  default: {
    template: '<p data-testid="current-user-message">current user</p>'
  }
}))

vi.mock('@/platform/settings/components/ColorPaletteMessage.vue', () => ({
  default: {
    template: '<p data-testid="color-palette-message">palette</p>'
  }
}))

vi.mock('@/platform/settings/components/SettingsPanel.vue', () => ({
  default: {
    props: ['settingGroups'],
    template: `
      <div data-testid="settings-panel">
        <section v-for="group in settingGroups" :key="group.label">
          <h4>{{ group.label }}</h4>
          <span v-for="setting in group.settings" :key="setting.id">
            {{ setting.id }}
          </span>
        </section>
      </div>
    `
  }
}))

vi.mock('@/platform/settings/composables/useSettingUI', async () => {
  const { computed, defineComponent, h, ref } = await import('vue')

  const settingCategories = ref<MockSettingTreeNode[]>([
    {
      key: 'Comfy',
      label: 'Comfy',
      children: [
        {
          key: 'General',
          label: 'General',
          children: [
            {
              key: 'Comfy.High',
              label: 'High',
              leaf: true,
              data: { id: 'Comfy.High', name: 'High', sortOrder: 30 }
            },
            {
              key: 'Comfy.Low',
              label: 'Low',
              leaf: true,
              data: { id: 'Comfy.Low', name: 'Low', sortOrder: 10 }
            }
          ]
        },
        {
          key: 'Advanced',
          label: 'Advanced',
          children: [
            {
              key: 'Comfy.Advanced',
              label: 'Advanced',
              leaf: true,
              data: { id: 'Comfy.Advanced', name: 'Advanced' }
            }
          ]
        }
      ]
    },
    {
      key: 'Appearance',
      label: 'Appearance',
      children: [
        {
          key: 'Palette',
          label: 'Palette',
          children: [
            {
              key: 'Appearance.Palette',
              label: 'Palette',
              leaf: true,
              data: {
                id: 'Appearance.Palette',
                name: 'Palette',
                sortOrder: 20
              }
            }
          ]
        }
      ]
    }
  ])

  const navGroups = ref([
    {
      title: 'Core',
      items: [
        { id: 'Comfy', label: 'Comfy', icon: 'settings' },
        { id: 'Appearance', label: 'Appearance', icon: 'palette' },
        { id: 'keybinding', label: 'Keybinding', icon: 'keyboard' },
        { id: 'credits', label: 'Credits', icon: 'coins' }
      ]
    }
  ])

  const keybindingPanel = {
    node: { key: 'keybinding', label: 'Keybinding', children: [] },
    component: defineComponent({
      name: 'MockKeybindingPanel',
      setup: () => () => h('div', { 'data-testid': 'keybinding-panel' }, 'keys')
    })
  }

  mockSettingUI.refs = {
    settingCategories,
    navGroups
  }

  return {
    useSettingUI: vi.fn((defaultPanel?: string) => ({
      defaultCategory: computed(
        () =>
          settingCategories.value.find((c) => c.key === defaultPanel) ??
          settingCategories.value[0]
      ),
      settingCategories,
      navGroups,
      findCategoryByKey: (key: string) =>
        settingCategories.value.find((c) => c.key === key) ?? null,
      findPanelByKey: (key: string) =>
        key === 'keybinding' ? keybindingPanel : null
    }))
  }
})

vi.mock('@/platform/settings/composables/useSettingSearch', async () => {
  const { computed, ref } = await import('vue')

  const searchQuery = ref('')
  const inSearch = ref(false)
  const searchResultsCategories = ref(new Set<string>())
  const matchedNavItemKeys = ref(new Set<string>())
  const results = ref<MockSettingGroup[]>([
    {
      label: 'Search Group',
      category: 'Comfy',
      settings: [{ id: 'Comfy.SearchResult', name: 'Search Result' }]
    }
  ])

  mockSettingSearch.refs = {
    searchQuery,
    inSearch,
    searchResultsCategories,
    matchedNavItemKeys,
    results
  }

  mockSettingSearch.handleSearch.mockImplementation(
    (query: string, navItems: Array<{ key: string; label: string }> = []) => {
      searchQuery.value = query
      inSearch.value = query.length > 0
      searchResultsCategories.value = query.includes('appearance')
        ? new Set(['Appearance'])
        : new Set()
      matchedNavItemKeys.value = new Set(
        navItems
          .filter((item) => item.label.toLowerCase().includes(query))
          .map((item) => item.key)
      )
    }
  )

  return {
    useSettingSearch: vi.fn(() => ({
      searchQuery,
      inSearch,
      searchResultsCategories: computed(() => searchResultsCategories.value),
      matchedNavItemKeys: computed(() => matchedNavItemKeys.value),
      handleSearch: mockSettingSearch.handleSearch,
      getSearchResults: vi.fn(() => results.value)
    }))
  }
})

function renderDialog(
  props: Partial<InstanceType<typeof SettingDialog>['$props']> = {}
) {
  return render(SettingDialog, {
    props: {
      onClose: vi.fn(),
      ...props
    },
    global: {
      plugins: [testI18n]
    }
  })
}

describe('SettingDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetchBalance.mockReset()
    if (mockSettingSearch.refs) {
      mockSettingSearch.refs.searchQuery.value = ''
      mockSettingSearch.refs.inSearch.value = false
      mockSettingSearch.refs.searchResultsCategories.value = new Set()
      mockSettingSearch.refs.matchedNavItemKeys.value = new Set()
    }
  })

  it('renders the default category panel with sorted groups and settings', () => {
    renderDialog()

    expect(screen.getByTestId('current-user-message')).toBeInTheDocument()
    expect(screen.getByTestId('settings-panel')).toHaveTextContent('General')
    expect(screen.getByTestId('settings-panel')).toHaveTextContent('Advanced')
    expect(screen.getByTestId('settings-panel').textContent).toMatch(
      /Comfy\.High.*Comfy\.Low/
    )
    expect(screen.getByRole('button', { name: 'Comfy' })).toHaveAttribute(
      'data-active',
      'true'
    )
  })

  it('switches category from the nav and fetches credits balance for credits', async () => {
    const user = userEvent.setup()
    renderDialog()

    await user.click(screen.getByRole('button', { name: 'Appearance' }))
    expect(screen.getByTestId('color-palette-message')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Appearance' })).toHaveAttribute(
      'data-active',
      'true'
    )

    await user.click(screen.getByRole('button', { name: 'Credits' }))
    await nextTick()

    expect(mockFetchBalance).toHaveBeenCalledTimes(1)
  })

  it('renders panel header slots and disables search autofocus for keybindings', async () => {
    const user = userEvent.setup()
    renderDialog()

    await user.click(screen.getByRole('button', { name: 'Keybinding' }))
    await nextTick()

    expect(screen.getByTestId('keybinding-panel')).toBeInTheDocument()
    expect(screen.getByTestId('header')).not.toBeEmptyDOMElement()
    expect(screen.getByTestId('header-actions')).not.toBeEmptyDOMElement()
    expect(screen.getByTestId('settings-search')).toHaveAttribute(
      'data-autofocus',
      'false'
    )
  })

  it('renders search results and activates the first matching nav item', async () => {
    const user = userEvent.setup()
    renderDialog()

    const input = screen.getByTestId('settings-search')
    await user.type(input, 'appearance')
    await user.tab()
    await nextTick()

    expect(mockSettingSearch.handleSearch).toHaveBeenCalledWith(
      'appearance',
      expect.arrayContaining([{ key: 'Appearance', label: 'Appearance' }])
    )
    expect(screen.getByTestId('settings-panel')).toHaveTextContent(
      'Comfy.SearchResult'
    )
    expect(screen.getByRole('button', { name: 'Appearance' })).toHaveAttribute(
      'data-active',
      'true'
    )
  })

  it('keeps search mode active when no nav item or category matches', async () => {
    const user = userEvent.setup()
    renderDialog()

    const input = screen.getByTestId('settings-search')
    await user.type(input, 'unmatched')
    await user.tab()
    await nextTick()

    expect(screen.getByTestId('settings-panel')).toHaveTextContent(
      'Comfy.SearchResult'
    )
    expect(screen.getByRole('button', { name: 'Comfy' })).toHaveAttribute(
      'data-active',
      'false'
    )
  })

  it('restores the default category after clearing search', async () => {
    const user = userEvent.setup()
    renderDialog()

    const input = screen.getByTestId('settings-search')
    await user.type(input, 'unmatched')
    await user.tab()
    await nextTick()
    await user.clear(input)
    await user.tab()
    await nextTick()

    expect(screen.getByTestId('current-user-message')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Comfy' })).toHaveAttribute(
      'data-active',
      'true'
    )
  })

  it('sorts groups by label when group sort order ties', async () => {
    const refs = mockSettingUI.refs
    if (!refs) throw new Error('Expected setting UI refs')

    const originalCategories = refs.settingCategories.value
    const originalNavGroups = refs.navGroups.value
    refs.settingCategories.value = [
      ...originalCategories,
      {
        key: 'Tie',
        label: 'Tie',
        children: [
          {
            key: 'Beta',
            label: 'Beta',
            children: [
              {
                key: 'Tie.Beta',
                label: 'Beta',
                leaf: true,
                data: { id: 'Tie.Beta', name: 'Beta', sortOrder: 5 }
              }
            ]
          },
          {
            key: 'Alpha',
            label: 'Alpha',
            children: [
              {
                key: 'Tie.Alpha',
                label: 'Alpha',
                leaf: true,
                data: { id: 'Tie.Alpha', name: 'Alpha', sortOrder: 5 }
              },
              {
                key: 'Tie.NoSort',
                label: 'NoSort',
                leaf: true,
                data: { id: 'Tie.NoSort', name: 'NoSort' }
              }
            ]
          }
        ]
      }
    ]
    refs.navGroups.value = [
      {
        title: 'Core',
        items: [
          ...originalNavGroups[0].items,
          { id: 'Tie', label: 'Tie', icon: 'settings' }
        ]
      }
    ]

    try {
      renderDialog()
      await userEvent.click(screen.getByRole('button', { name: 'Tie' }))
      await nextTick()

      expect(screen.getByTestId('settings-panel').textContent).toMatch(
        /Alpha.*Beta/
      )
      expect(screen.getByTestId('settings-panel').textContent).toMatch(
        /Tie\.Alpha.*Tie\.NoSort/
      )
    } finally {
      refs.settingCategories.value = originalCategories
      refs.navGroups.value = originalNavGroups
    }
  })

  it('scrolls to a target setting and removes its highlight after animation', async () => {
    const target = document.createElement('div')
    target.dataset.settingId = 'Comfy.Target'
    const scrollIntoView = vi.fn()
    target.scrollIntoView = scrollIntoView
    document.body.appendChild(target)

    try {
      renderDialog({ scrollToSettingId: 'Comfy.Target' })
      await nextTick()
      await nextTick()

      expect(scrollIntoView).toHaveBeenCalledWith({
        behavior: 'smooth',
        block: 'center'
      })
      expect(target.classList.contains('setting-highlight')).toBe(true)

      target.dispatchEvent(new Event('animationend'))

      expect(target.classList.contains('setting-highlight')).toBe(false)
    } finally {
      target.remove()
    }
  })
})
