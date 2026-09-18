import { render, screen } from '@testing-library/vue'
import { beforeEach, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import type { Ref } from 'vue'

import { i18n } from '@/i18n'
import type { NavGroupData } from '@/types/navTypes'

import SettingDialog from './SettingDialog.vue'

const settingUiMocks = vi.hoisted(
  (): { navGroups: Ref<NavGroupData[]> | null } => ({ navGroups: null })
)
const searchMocks = vi.hoisted(
  (): {
    inSearch: Ref<boolean> | null
    matchedNavItemKeys: Ref<Set<string>> | null
    searchQuery: Ref<string> | null
    searchResultsCategories: Ref<Set<string>> | null
  } => ({
    inSearch: null,
    matchedNavItemKeys: null,
    searchQuery: null,
    searchResultsCategories: null
  })
)

vi.mock<unknown>(
  import('@/platform/settings/composables/useSettingUI'),
  () => ({
    useSettingUI: () => ({
      defaultCategory: {
        value: {
          key: 'workspace-allowlist',
          label: 'Allowlist',
          children: []
        }
      },
      settingCategories: { value: [] },
      navGroups: settingUiMocks.navGroups!,
      findCategoryByKey: (key: string) =>
        settingUiMocks
          .navGroups!.value.flatMap(({ items }) => items)
          .find(({ id }) => id === key) ?? null,
      findPanelByKey: (key: string) => {
        const item = settingUiMocks
          .navGroups!.value.flatMap(({ items }) => items)
          .find(({ id }) => id === key)
        return item
          ? {
              node: { key: item.id, label: item.label, children: [] },
              component: { template: `<div>${key} panel</div>` }
            }
          : null
      }
    })
  })
)

vi.mock<unknown>(
  import('@/platform/settings/composables/useSettingSearch'),
  () => ({
    useSettingSearch: () => ({
      searchQuery: searchMocks.searchQuery!,
      inSearch: searchMocks.inSearch!,
      searchResultsCategories: searchMocks.searchResultsCategories!,
      matchedNavItemKeys: searchMocks.matchedNavItemKeys!,
      handleSearch: vi.fn(),
      getSearchResults: () => []
    })
  })
)

vi.mock(import('@/composables/billing/useBillingContext'))

vi.mock(
  import('@/platform/telemetry/searchQuery/useSearchQueryTracking'),
  () => ({
    useSearchQueryTracking: vi.fn()
  })
)

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
        NavTitle: true
      }
    }
  })
  expect(
    await screen.findByText('workspace-allowlist panel')
  ).toBeInTheDocument()

  settingUiMocks.navGroups!.value = [
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
