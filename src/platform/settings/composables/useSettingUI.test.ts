import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { render } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import { createI18n } from 'vue-i18n'

import {
  getSettingInfo,
  useSettingStore
} from '@/platform/settings/settingStore'
import type { SettingTreeNode } from '@/platform/settings/settingStore'
import type { SettingParams } from '@/platform/settings/types'

import { useSettingUI } from './useSettingUI'

const testI18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: {} }
})

function runSettingUI(...args: Parameters<typeof useSettingUI>) {
  let result!: ReturnType<typeof useSettingUI>
  render(
    defineComponent({
      setup() {
        result = useSettingUI(...args)
        return {}
      },
      template: '<div />'
    }),
    { global: { plugins: [testI18n] } }
  )
  return result
}

const { auth, billing, dist, featureFlags, vueFlags } = vi.hoisted(() => ({
  auth: { isLoggedIn: { value: false } },
  billing: {
    isActiveSubscription: { value: false },
    type: { value: 'legacy' as 'legacy' | 'workspace' }
  },
  dist: { isCloud: false, isDesktop: false },
  featureFlags: { teamWorkspacesEnabled: false, userSecretsEnabled: false },
  vueFlags: { shouldRenderVueNodes: { value: false } }
}))

vi.mock('@/composables/auth/useCurrentUser', () => ({
  useCurrentUser: () => ({ isLoggedIn: auth.isLoggedIn })
}))

vi.mock('@/composables/billing/useBillingContext', () => ({
  useBillingContext: () => ({
    isActiveSubscription: billing.isActiveSubscription,
    type: billing.type
  })
}))

vi.mock('@/composables/useFeatureFlags', () => ({
  useFeatureFlags: () => ({
    flags: featureFlags
  })
}))

vi.mock('@/composables/useVueFeatureFlags', () => ({
  useVueFeatureFlags: () => ({
    shouldRenderVueNodes: vueFlags.shouldRenderVueNodes
  })
}))

vi.mock('@/platform/distribution/types', () => ({
  get isCloud() {
    return dist.isCloud
  },
  get isDesktop() {
    return dist.isDesktop
  }
}))

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: vi.fn(),
  getSettingInfo: vi.fn()
}))

type SettingFixture = Omit<SettingParams, 'id'> & { id: string }

describe('useSettingUI', () => {
  const mockSettings: Record<string, SettingFixture> = {
    'Comfy.Locale': {
      id: 'Comfy.Locale',
      name: 'Locale',
      type: 'combo',
      defaultValue: 'en'
    },
    'LiteGraph.Zoom': {
      id: 'LiteGraph.Zoom',
      name: 'Zoom',
      type: 'slider',
      defaultValue: 1
    },
    'Appearance.Theme': {
      id: 'Appearance.Theme',
      name: 'Theme',
      type: 'combo',
      defaultValue: 'dark'
    }
  }
  let settingsById: Record<string, SettingFixture>

  beforeEach(() => {
    setActivePinia(createTestingPinia())
    vi.clearAllMocks()
    auth.isLoggedIn.value = false
    billing.isActiveSubscription.value = false
    billing.type.value = 'legacy'
    dist.isCloud = false
    dist.isDesktop = false
    featureFlags.teamWorkspacesEnabled = false
    featureFlags.userSecretsEnabled = false
    vueFlags.shouldRenderVueNodes.value = false
    Object.assign(window, { __CONFIG__: {} })

    settingsById = mockSettings
    vi.mocked(useSettingStore).mockReturnValue({
      settingsById
    } as ReturnType<typeof useSettingStore>)

    vi.mocked(getSettingInfo).mockImplementation((setting) => {
      const parts = setting.category || setting.id.split('.')
      return {
        category: parts[0] ?? 'Other',
        subCategory: parts[1] ?? 'Other'
      }
    })
  })

  function findCategory(
    categories: SettingTreeNode[],
    label: string
  ): SettingTreeNode | undefined {
    return categories.find((c) => c.label === label)
  }

  it('defaults to first category when no params are given', () => {
    const { defaultCategory, settingCategories } = runSettingUI()
    expect(defaultCategory.value).toBe(settingCategories.value[0])
  })

  it('resolves category from scrollToSettingId', () => {
    const { defaultCategory, settingCategories } = runSettingUI(
      undefined,
      'Comfy.Locale'
    )
    expect(defaultCategory.value).toBe(
      findCategory(settingCategories.value, 'Comfy')
    )
  })

  it('resolves different category from scrollToSettingId', () => {
    const { defaultCategory, settingCategories } = runSettingUI(
      undefined,
      'Appearance.Theme'
    )
    const appearanceCategory = findCategory(
      settingCategories.value,
      'Appearance'
    )
    expect(defaultCategory.value).toBe(appearanceCategory)
  })

  it('falls back to first category for unknown scrollToSettingId', () => {
    const { defaultCategory, settingCategories } = runSettingUI(
      undefined,
      'NonExistent.Setting'
    )
    expect(defaultCategory.value).toBe(settingCategories.value[0])
  })

  it('gives defaultPanel precedence over scrollToSettingId', () => {
    const { defaultCategory } = runSettingUI('about', 'Comfy.Locale')
    expect(defaultCategory.value.key).toBe('about')
  })

  it('falls back when defaultPanel is not in the menu', () => {
    const { defaultCategory, settingCategories } = runSettingUI('subscription')
    expect(defaultCategory.value).toBe(settingCategories.value[0])
  })

  it('moves floating settings into Other and hides Vue-node-only settings', () => {
    settingsById = {
      Floating: {
        id: 'Floating',
        name: 'Floating',
        type: 'boolean',
        defaultValue: false
      },
      'Hidden.Setting': {
        id: 'Hidden.Setting',
        name: 'Hidden',
        type: 'hidden',
        defaultValue: false
      },
      'Vue.Hidden': {
        id: 'Vue.Hidden',
        name: 'Vue Hidden',
        type: 'boolean',
        defaultValue: false,
        hideInVueNodes: true
      }
    }
    vi.mocked(useSettingStore).mockReturnValue({
      settingsById
    } as ReturnType<typeof useSettingStore>)
    vueFlags.shouldRenderVueNodes.value = true

    const { settingCategories } = runSettingUI()

    expect(settingCategories.value.map((category) => category.label)).toEqual([
      'Other'
    ])
    expect(
      settingCategories.value[0].children?.map((node) => node.key)
    ).toEqual(['root/Floating'])
  })

  it('adds gated cloud, desktop, workspace, and secrets panels', () => {
    auth.isLoggedIn.value = true
    billing.isActiveSubscription.value = true
    dist.isCloud = true
    dist.isDesktop = true
    featureFlags.teamWorkspacesEnabled = true
    featureFlags.userSecretsEnabled = true
    Object.assign(window, { __CONFIG__: { subscription_required: true } })

    const { findCategoryByKey, findPanelByKey, navGroups, panels } =
      runSettingUI()

    expect(panels.value.map((panel) => panel.node.key)).toEqual([
      'about',
      'credits',
      'user',
      'workspace',
      'keybinding',
      'extension',
      'server-config',
      'subscription',
      'secrets'
    ])
    expect(navGroups.value.map((group) => group.title)).toEqual([
      'Workspace',
      'General'
    ])
    expect(findCategoryByKey('secrets')?.key).toBe('secrets')
    expect(findCategoryByKey('missing')).toBeNull()
    expect(findPanelByKey('subscription')?.node.key).toBe('subscription')
    expect(findPanelByKey('missing')).toBeNull()
  })

  it('builds the legacy account menu from auth and subscription gates', () => {
    auth.isLoggedIn.value = true
    billing.isActiveSubscription.value = true
    dist.isCloud = true
    featureFlags.userSecretsEnabled = true
    Object.assign(window, { __CONFIG__: { subscription_required: true } })

    const { navGroups, panels } = runSettingUI()

    expect(panels.value.map((panel) => panel.node.key)).toEqual([
      'about',
      'credits',
      'user',
      'keybinding',
      'extension',
      'subscription',
      'secrets'
    ])
    expect(navGroups.value[0]).toEqual({
      title: 'Account',
      items: [
        {
          id: 'user',
          label: 'User',
          icon: 'icon-[lucide--user]'
        },
        {
          id: 'subscription',
          label: 'PlanCredits',
          icon: 'icon-[lucide--credit-card]'
        },
        {
          id: 'secrets',
          label: 'Secrets',
          icon: 'icon-[lucide--key-round]'
        }
      ]
    })
  })

  it('includes credits in legacy account settings when login is not subscription-gated', () => {
    auth.isLoggedIn.value = true
    dist.isCloud = true

    const { navGroups } = runSettingUI()

    expect(navGroups.value[0].items.map((item) => item.id)).toEqual([
      'user',
      'credits'
    ])
  })

  it('builds workspace menus without optional children when gates are closed', () => {
    dist.isCloud = true
    featureFlags.teamWorkspacesEnabled = true

    const { navGroups, panels } = runSettingUI()

    expect(panels.value.map((panel) => panel.node.key)).toEqual([
      'about',
      'credits',
      'user',
      'keybinding',
      'extension'
    ])
    expect(navGroups.value.map((group) => group.title)).toEqual([
      'Workspace',
      'General'
    ])
    expect(navGroups.value[0].items).toEqual([])
  })

  it('uses label and fallback icons for custom categories', () => {
    settingsById = {
      'Acme.Tools.Toggle': {
        id: 'Acme.Tools.Toggle',
        name: 'Toggle',
        type: 'boolean',
        defaultValue: false,
        category: ['Acme Tools', 'Toggles']
      },
      PlanSetting: {
        id: 'PlanSetting',
        name: 'Plan Setting',
        type: 'boolean',
        defaultValue: false,
        category: ['PlanCredits', 'Credits']
      }
    }
    vi.mocked(useSettingStore).mockReturnValue({
      settingsById
    } as ReturnType<typeof useSettingStore>)

    const { navGroups } = runSettingUI()
    const settingsItems = navGroups.value[1].items

    expect(settingsItems).toEqual([
      {
        id: 'root/Acme Tools',
        label: 'Acme Tools',
        icon: 'icon-[lucide--plug]'
      },
      {
        id: 'root/PlanCredits',
        label: 'PlanCredits',
        icon: 'icon-[lucide--credit-card]'
      }
    ])
  })

  describe('legacy billing in the workspace layout', () => {
    const navKeys = (groups: { items: { id: string }[] }[]) =>
      groups.flatMap((group) => group.items.map((item) => item.id))

    beforeEach(() => {
      auth.isLoggedIn.value = true
      billing.isActiveSubscription.value = true
      dist.isCloud = true
      featureFlags.teamWorkspacesEnabled = true
      Object.assign(window, { __CONFIG__: { subscription_required: true } })
    })

    it('exposes the legacy plan panel when billing is legacy', () => {
      billing.type.value = 'legacy'
      const { defaultCategory, navGroups } = runSettingUI('subscription')

      expect(defaultCategory.value.key).toBe('subscription')
      expect(navKeys(navGroups.value)).toContain('subscription')
      expect(navKeys(navGroups.value)).toContain('workspace')
    })

    it('hides the legacy plan panel when billing is workspace', () => {
      billing.type.value = 'workspace'
      const { navGroups } = runSettingUI()

      expect(navKeys(navGroups.value)).not.toContain('subscription')
      expect(navKeys(navGroups.value)).toContain('workspace')
    })

    it('never renders the plan panel in more than one tab', () => {
      const countSubscription = () => {
        const { navGroups } = runSettingUI()
        return navKeys(navGroups.value).filter((id) => id === 'subscription')
          .length
      }

      for (const teamWorkspacesEnabled of [true, false]) {
        for (const billingType of ['legacy', 'workspace'] as const) {
          for (const isLoggedIn of [true, false]) {
            featureFlags.teamWorkspacesEnabled = teamWorkspacesEnabled
            billing.type.value = billingType
            auth.isLoggedIn.value = isLoggedIn
            expect(countSubscription()).toBeLessThanOrEqual(1)
          }
        }
      }
    })
  })
})
