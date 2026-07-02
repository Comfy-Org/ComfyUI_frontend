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

  describe('legacy billing in the workspace layout', () => {
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

    it('exposes the legacy plan panel when billing is legacy', () => {
      env.state.billingType = 'legacy'
      const { defaultCategory, navGroups } = useSettingUI('subscription')

      expect(defaultCategory.value.key).toBe('subscription')
      expect(navKeys(navGroups.value)).toContain('subscription')
      expect(navKeys(navGroups.value)).toContain('workspace')
    })

    it('hides the legacy plan panel when billing is workspace', () => {
      env.state.billingType = 'workspace'
      const { navGroups } = useSettingUI()

      expect(navKeys(navGroups.value)).not.toContain('subscription')
      expect(navKeys(navGroups.value)).toContain('workspace')
    })

    it('never renders the plan panel in more than one tab', () => {
      const countSubscription = () => {
        const { navGroups } = useSettingUI()
        return navKeys(navGroups.value).filter((id) => id === 'subscription')
          .length
      }

      for (const teamWorkspacesEnabled of [true, false]) {
        for (const billingType of ['legacy', 'workspace'] as const) {
          for (const isLoggedIn of [true, false]) {
            Object.assign(env.state, {
              teamWorkspacesEnabled,
              billingType,
              isLoggedIn
            })
            expect(countSubscription()).toBeLessThanOrEqual(1)
          }
        }
      }
    })
  })
})
