import { render, screen } from '@testing-library/vue'
import { beforeEach, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import type { Ref } from 'vue'

import type { NavGroupData } from '@/types/navTypes'

import SettingDialog from './SettingDialog.vue'

const settingUiMocks = vi.hoisted(() => ({
  navGroups: null as unknown as Ref<NavGroupData[]>
}))
const searchMocks = vi.hoisted(() => ({
  inSearch: null as unknown as Ref<boolean>,
  matchedNavItemKeys: null as unknown as Ref<Set<string>>,
  searchQuery: null as unknown as Ref<string>,
  searchResultsCategories: null as unknown as Ref<Set<string>>
}))
const mockFetchBalance = vi.hoisted(() => vi.fn())

vi.mock('@/platform/settings/composables/useSettingUI', () => ({
  useSettingUI: () => ({
    defaultCategory: {
      value: {
        key: 'workspace-allowlist',
        label: 'Allowlist',
        children: []
      }
    },
    settingCategories: { value: [] },
    navGroups: settingUiMocks.navGroups,
    findCategoryByKey: (key: string) =>
      settingUiMocks.navGroups.value
        .flatMap(({ items }) => items)
        .find(({ id }) => id === key) ?? null,
    findPanelByKey: (key: string) => {
      const item = settingUiMocks.navGroups.value
        .flatMap(({ items }) => items)
        .find(({ id }) => id === key)
      return item
        ? {
            node: { key: item.id, label: item.label, children: [] },
            component: { template: `<div>${key} panel</div>` }
          }
        : null
    }
  })
}))

vi.mock('@/platform/settings/composables/useSettingSearch', () => ({
  useSettingSearch: () => ({
    searchQuery: searchMocks.searchQuery,
    inSearch: searchMocks.inSearch,
    searchResultsCategories: searchMocks.searchResultsCategories,
    matchedNavItemKeys: searchMocks.matchedNavItemKeys,
    handleSearch: vi.fn(),
    getSearchResults: () => []
  })
}))

vi.mock('@/composables/billing/useBillingContext', () => ({
  useBillingContext: () => ({ fetchBalance: mockFetchBalance })
}))

vi.mock('@/platform/telemetry/searchQuery/useSearchQueryTracking', () => ({
  useSearchQueryTracking: vi.fn()
}))

beforeEach(() => {
  settingUiMocks.navGroups = ref([
    {
      title: 'Workspace',
      items: [
        {
          id: 'workspace',
          label: 'Workspace',
          icon: 'icon-[lucide--building-2]'
        },
        {
          id: 'workspace-allowlist',
          label: 'Allowlist',
          icon: 'icon-[lucide--list-checks]'
        }
      ]
    }
  ])
  searchMocks.inSearch = ref(false)
  searchMocks.matchedNavItemKeys = ref(new Set<string>())
  searchMocks.searchQuery = ref('')
  searchMocks.searchResultsCategories = ref(new Set<string>())
  mockFetchBalance.mockReset()
})

it('falls back when the active navigation item becomes unavailable', async () => {
  render(SettingDialog, {
    props: { onClose: vi.fn() },
    global: {
      mocks: { $t: (key: string) => key },
      stubs: {
        BaseModalLayout: {
          template:
            '<div><slot name="leftPanel" /><slot name="content" /></div>'
        },
        NavItem: { template: '<button><slot /></button>' },
        NavTitle: true,
        SearchInput: true
      }
    }
  })
  expect(
    await screen.findByText('workspace-allowlist panel')
  ).toBeInTheDocument()

  settingUiMocks.navGroups.value = [
    {
      title: 'Workspace',
      items: [
        {
          id: 'workspace',
          label: 'Workspace',
          icon: 'icon-[lucide--building-2]'
        }
      ]
    }
  ]
  await nextTick()

  expect(await screen.findByText('workspace panel')).toBeInTheDocument()
  expect(
    screen.queryByText('workspace-allowlist panel')
  ).not.toBeInTheDocument()
})
