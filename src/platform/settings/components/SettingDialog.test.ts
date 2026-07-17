import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import SettingDialog from './SettingDialog.vue'

const controls = vi.hoisted(() => ({
  setBillingControlEnabled(value: boolean) {
    void value
  }
}))

vi.mock('@/platform/settings/composables/useSettingUI', async () => {
  const { computed, defineComponent, ref } = await import('vue')
  const billingControlEnabled = ref(true)

  controls.setBillingControlEnabled = (value) => {
    billingControlEnabled.value = value
  }

  const legacyWorkspacePanel = {
    node: { key: 'workspace', label: 'Workspace', children: [] },
    component: defineComponent({ template: '<div>Legacy Workspace</div>' })
  }
  const planCreditsPanel = {
    node: { key: 'workspace', label: 'PlanCredits', children: [] },
    component: defineComponent({ template: '<div>New Plan & Credits</div>' })
  }
  const membersPanel = {
    node: { key: 'workspace-members', label: 'Members', children: [] },
    component: defineComponent({ template: '<div>New Members</div>' })
  }

  return {
    useSettingUI: (defaultPanel?: string) => {
      const panels = computed(() =>
        billingControlEnabled.value
          ? [planCreditsPanel, membersPanel]
          : [legacyWorkspacePanel]
      )
      const nodes = computed(() => panels.value.map((panel) => panel.node))
      const defaultCategory = computed(
        () =>
          nodes.value.find((node) => node.key === defaultPanel) ??
          nodes.value[0]
      )
      const navGroups = computed(() => [
        {
          title: 'Workspace',
          items: nodes.value.map((node) => ({
            id: node.key,
            label: node.label,
            icon: ''
          }))
        }
      ])

      return {
        defaultCategory,
        settingCategories: ref([]),
        navGroups,
        findCategoryByKey: (key: string) =>
          nodes.value.find((node) => node.key === key) ?? null,
        findPanelByKey: (key: string) =>
          panels.value.find((panel) => panel.node.key === key) ?? null
      }
    }
  }
})

vi.mock('@/platform/settings/composables/useSettingSearch', async () => {
  const { ref } = await import('vue')
  return {
    useSettingSearch: () => ({
      searchQuery: ref(''),
      inSearch: ref(false),
      searchResultsCategories: ref(new Set<string>()),
      matchedNavItemKeys: ref(new Set<string>()),
      handleSearch: vi.fn(),
      getSearchResults: () => []
    })
  }
})

vi.mock('@/platform/settings/composables/useSettingsNavigation', async () => {
  const { ref } = await import('vue')
  return {
    useSettingsNavigation: () => ({
      requestedPanelKey: ref<string | null>(null)
    })
  }
})

vi.mock('@/composables/billing/useBillingContext', () => ({
  useBillingContext: () => ({ fetchBalance: vi.fn() })
}))

vi.mock('@/platform/telemetry/searchQuery/useSearchQueryTracking', () => ({
  useSearchQueryTracking: vi.fn()
}))

describe('SettingDialog workspace fallback', () => {
  beforeEach(() => {
    controls.setBillingControlEnabled(true)
  })

  it('returns to the legacy Workspace panel when billing controls turn off', async () => {
    render(SettingDialog, {
      props: { onClose: vi.fn(), defaultPanel: 'workspace' },
      global: {
        mocks: { $t: (key: string) => key },
        stubs: {
          BaseModalLayout: {
            template:
              '<div><slot name="leftPanel" /><main><slot name="content" /></main></div>'
          },
          SearchInput: true,
          NavTitle: true,
          NavItem: {
            emits: ['click'],
            template:
              '<button type="button" @click="$emit(\'click\')"><slot /></button>'
          }
        }
      }
    })

    expect(screen.getByText('New Plan & Credits')).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: 'Members' }))
    expect(screen.getByText('New Members')).toBeTruthy()

    controls.setBillingControlEnabled(false)

    expect(await screen.findByText('Legacy Workspace')).toBeTruthy()
    expect(screen.queryByText('New Members')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Members' })).toBeNull()
  })
})
