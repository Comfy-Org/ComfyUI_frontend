import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import {
  getSettingInfo,
  useSettingStore
} from '@/platform/settings/settingStore'
import type { SettingTreeNode } from '@/platform/settings/settingStore'

import { useSettingUI } from './useSettingUI'

const env = vi.hoisted(() => {
  const state = {
    isCloud: false,
    isDesktop: false,
    isLoggedIn: false,
    teamWorkspacesEnabled: false,
    billingControlEnabled: false,
    authenticatedConfigLoaded: false,
    userSecretsEnabled: false,
    isActiveSubscription: false,
    billingType: 'legacy' as 'legacy' | 'workspace'
  }
  const fakeRef = <K extends keyof typeof state>(key: K) => ({
    get value() {
      return state[key]
    }
  })
  return { state, fakeRef }
})

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (_: string, fallback: string) => fallback })
}))

vi.mock('@/composables/auth/useCurrentUser', () => ({
  useCurrentUser: () => ({ isLoggedIn: env.fakeRef('isLoggedIn') })
}))

vi.mock('@/composables/billing/useBillingContext', () => ({
  useBillingContext: () => ({
    isActiveSubscription: env.fakeRef('isActiveSubscription'),
    type: env.fakeRef('billingType')
  })
}))

vi.mock('@/composables/useFeatureFlags', () => ({
  useFeatureFlags: () => ({
    flags: {
      get teamWorkspacesEnabled() {
        return env.state.teamWorkspacesEnabled
      },
      get billingControlEnabled() {
        return env.state.billingControlEnabled
      },
      get userSecretsEnabled() {
        return env.state.userSecretsEnabled
      }
    }
  })
}))

vi.mock('@/composables/useVueFeatureFlags', () => ({
  useVueFeatureFlags: () => ({ shouldRenderVueNodes: ref(false) })
}))

vi.mock('@/platform/distribution/types', () => ({
  get isCloud() {
    return env.state.isCloud
  },
  get isDesktop() {
    return env.state.isDesktop
  }
}))

vi.mock('@/platform/remoteConfig/remoteConfig', () => ({
  isAuthenticatedConfigLoaded: env.fakeRef('authenticatedConfigLoaded')
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

  beforeEach(() => {
    setActivePinia(createTestingPinia())
    vi.clearAllMocks()

    Object.assign(env.state, {
      isCloud: false,
      isDesktop: false,
      isLoggedIn: false,
      teamWorkspacesEnabled: false,
      billingControlEnabled: false,
      authenticatedConfigLoaded: false,
      userSecretsEnabled: false,
      isActiveSubscription: false,
      billingType: 'legacy'
    })

    vi.mocked(useSettingStore).mockReturnValue({
      settingsById: mockSettings
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
    const comfyCategory = findCategory(settingCategories.value, 'Comfy')
    expect(comfyCategory).toBeDefined()
    expect(defaultCategory.value).toBe(comfyCategory)
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
    expect(appearanceCategory).toBeDefined()
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

  describe('billing-controlled workspace panels', () => {
    beforeEach(() => {
      Object.assign(env.state, {
        isCloud: true,
        isLoggedIn: true,
        teamWorkspacesEnabled: true,
        authenticatedConfigLoaded: true,
        isActiveSubscription: true,
        billingType: 'workspace'
      })
      window.__CONFIG__ = {
        subscription_required: false
      } as typeof window.__CONFIG__
    })

    it('keeps the legacy Workspace panel and standalone Credits when disabled', () => {
      const { defaultCategory, findPanelByKey, navGroups } =
        useSettingUI('workspace')
      const workspaceItems = navGroups.value
        .find((group) => group.title === 'Workspace')
        ?.items.map(({ id, label }) => ({ id, label }))

      expect(workspaceItems).toEqual([
        { id: 'workspace', label: 'Workspace' },
        { id: 'credits', label: 'Credits' }
      ])
      expect(findPanelByKey('workspace')?.node.label).toBe('Workspace')
      expect(findPanelByKey('workspace-members')).toBeNull()
      expect(defaultCategory.value).toMatchObject({
        key: 'workspace',
        label: 'Workspace'
      })
    })

    it('keeps the legacy Workspace panel until authenticated config loads', () => {
      env.state.authenticatedConfigLoaded = false
      env.state.billingControlEnabled = true

      const { findPanelByKey, navGroups } = useSettingUI('workspace')
      const workspaceItems = navGroups.value
        .find((group) => group.title === 'Workspace')
        ?.items.map(({ id, label }) => ({ id, label }))

      expect(workspaceItems).toEqual([
        { id: 'workspace', label: 'Workspace' },
        { id: 'credits', label: 'Credits' }
      ])
      expect(findPanelByKey('workspace')?.node.label).toBe('Workspace')
      expect(findPanelByKey('workspace-members')).toBeNull()
    })

    it('uses the split workspace shell and hides standalone Credits when enabled', () => {
      env.state.billingControlEnabled = true
      const { defaultCategory, findPanelByKey, navGroups } =
        useSettingUI('workspace')
      const workspaceItems = navGroups.value
        .find((group) => group.title === 'Workspace')
        ?.items.map(({ id, label }) => ({ id, label }))
      const planCreditsPanel = findPanelByKey('workspace')
      const membersPanel = findPanelByKey('workspace-members')

      expect(workspaceItems).toEqual([
        { id: 'workspace', label: 'PlanCredits' },
        { id: 'workspace-members', label: 'Members' }
      ])
      expect(planCreditsPanel?.component).toBe(membersPanel?.component)
      expect(planCreditsPanel?.props).toEqual({ section: 'planCredits' })
      expect(membersPanel?.props).toEqual({ section: 'members' })
      expect(defaultCategory.value).toMatchObject({
        key: 'workspace',
        label: 'PlanCredits'
      })
    })
  })

  describe('plan and credits navigation', () => {
    const navKeys = (groups: { items: { id: string }[] }[]) =>
      groups.flatMap((group) => group.items.map((item) => item.id))

    beforeEach(() => {
      Object.assign(env.state, {
        isCloud: true,
        isLoggedIn: true,
        teamWorkspacesEnabled: true,
        isActiveSubscription: true
      })
      window.__CONFIG__ = {
        subscription_required: true
      } as typeof window.__CONFIG__
    })

    it.for(['legacy', 'workspace'] as const)(
      'uses only the Workspace panel for %s billing in the workspace layout',
      (billingType) => {
        env.state.billingType = billingType
        const { navGroups } = useSettingUI()

        expect(navKeys(navGroups.value)).not.toContain('subscription')
        expect(navKeys(navGroups.value)).toContain('workspace')
      }
    )

    it('keeps the legacy plan panel in the legacy layout', () => {
      env.state.teamWorkspacesEnabled = false
      const { navGroups } = useSettingUI()

      expect(navKeys(navGroups.value)).toContain('subscription')
      expect(navKeys(navGroups.value)).not.toContain('workspace')
    })
  })
})
