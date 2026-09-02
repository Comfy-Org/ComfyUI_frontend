import { render, screen } from '@testing-library/vue'
import { beforeEach, expect, it, vi } from 'vitest'
import { nextTick, reactive, ref } from 'vue'
import type { Ref } from 'vue'
import { createI18n } from 'vue-i18n'

import type { NavGroupData } from '@/types/navTypes'

import SettingDialog from './SettingDialog.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: {} },
  missingWarn: false,
  fallbackWarn: false
})

const settingUiMocks = vi.hoisted(() => ({
  navGroups: null as unknown as Ref<NavGroupData[]>,
  defaultCategory: null as unknown as Ref<{
    key: string
    label: string
    children: never[]
  }>
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
    defaultCategory: settingUiMocks.defaultCategory,
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

vi.mock('@/platform/workspace/stores/teamWorkspaceStore', () => ({
  useTeamWorkspaceStore: () => reactive({ workspaceName: ref('Acme Team') })
}))

beforeEach(() => {
  settingUiMocks.defaultCategory = ref({
    key: 'workspace-allowlist',
    label: 'Allowlist',
    children: []
  })
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
})

it('falls back when the active navigation item becomes unavailable', async () => {
  render(SettingDialog, {
    props: { onClose: vi.fn() },
    global: {
      plugins: [i18n],
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

it('shows the workspace identity in the dialog header on workspace sections', async () => {
  render(SettingDialog, {
    props: { onClose: vi.fn() },
    global: {
      plugins: [i18n],
      stubs: {
        BaseModalLayout: {
          template: '<div><slot name="header" /><slot name="content" /></div>'
        },
        NavItem: { template: '<button><slot /></button>' },
        NavTitle: true,
        SearchInput: true,
        WorkspaceProfilePic: { template: '<div data-testid="ws-pic" />' }
      }
    }
  })

  expect(
    await screen.findByRole('heading', { name: 'Acme Team' })
  ).toBeInTheDocument()
  expect(screen.getByTestId('ws-pic')).toBeInTheDocument()
})

it('leaves the dialog header empty outside workspace sections', async () => {
  settingUiMocks.defaultCategory.value = {
    key: 'comfy',
    label: 'Comfy',
    children: []
  }
  settingUiMocks.navGroups.value = [
    {
      title: 'Comfy',
      items: [{ id: 'comfy', label: 'Comfy', icon: 'icon-[lucide--cog]' }]
    }
  ]

  render(SettingDialog, {
    props: { onClose: vi.fn() },
    global: {
      plugins: [i18n],
      stubs: {
        BaseModalLayout: {
          template: '<div><slot name="header" /><slot name="content" /></div>'
        },
        NavItem: { template: '<button><slot /></button>' },
        NavTitle: true,
        SearchInput: true,
        WorkspaceProfilePic: { template: '<div data-testid="ws-pic" />' }
      }
    }
  })

  await nextTick()
  expect(screen.queryByTestId('ws-pic')).not.toBeInTheDocument()
})
