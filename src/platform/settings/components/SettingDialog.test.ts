import userEvent from '@testing-library/user-event'
import { fireEvent, render, screen } from '@testing-library/vue'
import { beforeEach, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import { createI18n } from 'vue-i18n'
import type { Ref } from 'vue'

import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import type { NavGroupData } from '@/types/navTypes'

import SettingDialog from './SettingDialog.vue'

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

vi.mock<unknown>(
  import('@/platform/settings/composables/useSettingUI'),
  () => ({
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
  })
)

vi.mock<unknown>(
  import('@/platform/settings/composables/useSettingSearch'),
  () => ({
    useSettingSearch: () => ({
      searchQuery: searchMocks.searchQuery,
      inSearch: searchMocks.inSearch,
      searchResultsCategories: searchMocks.searchResultsCategories,
      matchedNavItemKeys: searchMocks.matchedNavItemKeys,
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
  const workspaceStore: ReturnType<typeof useTeamWorkspaceStore> & {
    activeWorkspaceId: string | null
  } = useTeamWorkspaceStore()
  workspaceStore.activeWorkspaceId = 'ws-acme'
  workspaceStore.$patch({
    workspaces: [
      {
        id: 'ws-acme',
        name: 'Acme Team',
        type: 'team',
        role: 'owner',
        created_at: '2026-01-01T00:00:00Z',
        joined_at: '2026-01-01T00:00:00Z',
        isSubscribed: true,
        subscriptionPlan: null,
        subscriptionTier: null,
        members: [],
        pendingInvites: [],
        membersLoaded: true,
        pendingInvitesLoaded: true
      }
    ]
  })
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

function renderDialog() {
  return render(SettingDialog, {
    props: { onClose: vi.fn() },
    global: {
      plugins: [
        createI18n({
          legacy: false,
          locale: 'en',
          messages: { en: {} },
          missingWarn: false,
          fallbackWarn: false
        })
      ],
      stubs: {
        BaseModalLayout: {
          template: `
            <div>
              <slot name="leftPanel" />
              <slot name="header" />
              <div data-testid="panel-scroller">
                <slot name="content" />
              </div>
            </div>`
        },
        NavItem: { template: '<button><slot /></button>' },
        NavTitle: true,
        SearchInput: true,
        WorkspaceProfilePic: { template: '<div data-testid="ws-pic" />' }
      }
    }
  })
}

async function scrollPanelTo(scrollTop: number) {
  const scrollerHost = screen.getByTestId('panel-scroller')
  // eslint-disable-next-line testing-library/no-node-access -- the capture wrapper is an unlabeled layout div; the test plants a nested scroller inside it, which no Testing Library query can address
  const wrapper = scrollerHost.firstElementChild as HTMLElement
  // eslint-disable-next-line testing-library/no-node-access -- same fixture: reuse the planted scroller across calls within a test
  let nested = wrapper.querySelector<HTMLElement>('[data-nested-scroller]')
  if (!nested) {
    nested = document.createElement('div')
    nested.dataset.nestedScroller = ''
    wrapper.appendChild(nested)
  }
  nested.scrollTop = scrollTop
  await fireEvent.scroll(nested)
}

it('falls back when the active navigation item becomes unavailable', async () => {
  renderDialog()
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
  renderDialog()

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

  renderDialog()

  await nextTick()
  expect(screen.queryByTestId('ws-pic')).not.toBeInTheDocument()
  expect(
    screen.queryByRole('heading', { name: 'Acme Team' })
  ).not.toBeInTheDocument()
})

it('collapses the header once the panel scrolls and restores it only at top', async () => {
  renderDialog()
  expect(
    await screen.findByRole('heading', { name: 'Acme Team' })
  ).toBeInTheDocument()

  await scrollPanelTo(40)
  expect(
    screen.queryByRole('heading', { name: 'Acme Team' })
  ).not.toBeInTheDocument()
  expect(screen.queryByTestId('ws-pic')).not.toBeInTheDocument()

  // Between the expand and collapse thresholds the header stays put, so a
  // marginally-scrollable panel cannot flip-flop it.
  await scrollPanelTo(10)
  expect(
    screen.queryByRole('heading', { name: 'Acme Team' })
  ).not.toBeInTheDocument()

  await scrollPanelTo(0)
  expect(
    await screen.findByRole('heading', { name: 'Acme Team' })
  ).toBeInTheDocument()
  expect(screen.getByTestId('ws-pic')).toBeInTheDocument()
})

it('restores the collapsed header when switching sections', async () => {
  renderDialog()
  expect(
    await screen.findByRole('heading', { name: 'Acme Team' })
  ).toBeInTheDocument()

  await scrollPanelTo(40)
  expect(
    screen.queryByRole('heading', { name: 'Acme Team' })
  ).not.toBeInTheDocument()

  await userEvent.click(screen.getByRole('button', { name: 'Workspace' }))

  expect(await screen.findByText('workspace panel')).toBeInTheDocument()
  expect(
    await screen.findByRole('heading', { name: 'Acme Team' })
  ).toBeInTheDocument()
})
