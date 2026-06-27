import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  getSettingInfo,
  useSettingStore
} from '@/platform/settings/settingStore'
import type { SettingTreeNode } from '@/platform/settings/settingStore'

import { useSettingUI } from './useSettingUI'

const { auth, billing, dist, featureFlags, vueFlags } = vi.hoisted(() => ({
  auth: { isLoggedIn: { value: false } },
  billing: { isActiveSubscription: { value: false } },
  dist: { isCloud: false, isDesktop: false },
  featureFlags: { teamWorkspacesEnabled: false, userSecretsEnabled: false },
  vueFlags: { shouldRenderVueNodes: { value: false } }
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (_: string, fallback: string) => fallback })
}))

vi.mock('@/composables/auth/useCurrentUser', () => ({
  useCurrentUser: () => ({ isLoggedIn: auth.isLoggedIn })
}))

vi.mock('@/composables/billing/useBillingContext', () => ({
  useBillingContext: () => ({
    isActiveSubscription: billing.isActiveSubscription
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

interface MockSettingParams {
  id: string
  name: string
  type: string
  defaultValue: unknown
  category?: string[]
  hideInVueNodes?: boolean
}

describe('useSettingUI', () => {
  const mockSettings: Record<string, MockSettingParams> = {
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
  let settingsById: Record<string, MockSettingParams>

  beforeEach(() => {
    setActivePinia(createTestingPinia())
    vi.clearAllMocks()
    auth.isLoggedIn.value = false
    billing.isActiveSubscription.value = false
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
    const { defaultCategory, settingCategories } = useSettingUI()
    expect(defaultCategory.value).toBe(settingCategories.value[0])
  })

  it('resolves category from scrollToSettingId', () => {
    const { defaultCategory, settingCategories } = useSettingUI(
      undefined,
      'Comfy.Locale'
    )
    expect(defaultCategory.value).toBe(
      findCategory(settingCategories.value, 'Comfy')
    )
  })

  it('resolves different category from scrollToSettingId', () => {
    const { defaultCategory, settingCategories } = useSettingUI(
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
    const { defaultCategory, settingCategories } = useSettingUI(
      undefined,
      'NonExistent.Setting'
    )
    expect(defaultCategory.value).toBe(settingCategories.value[0])
  })

  it('gives defaultPanel precedence over scrollToSettingId', () => {
    const { defaultCategory } = useSettingUI('about', 'Comfy.Locale')
    expect(defaultCategory.value.key).toBe('about')
  })

  it('falls back when defaultPanel is not in the menu', () => {
    const missingPanel = 'missing' as unknown as Parameters<
      typeof useSettingUI
    >[0]
    const { defaultCategory, settingCategories } = useSettingUI(missingPanel)
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

    const { settingCategories } = useSettingUI()

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
      useSettingUI()

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
})
