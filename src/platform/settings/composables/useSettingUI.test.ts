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
    partnerNodeGovernanceEnabled: false,
    userSecretsEnabled: false,
    workspaceRole: 'owner' as 'owner' | 'member',
    partnerNodeGovernanceStatus: 'inactive' as
      | 'inactive'
      | 'loading'
      | 'unconfigured'
      | 'configured'
      | 'ineligible'
      | 'error',
    partnerNodeGovernanceProviders: [] as { id: string }[]
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

vi.mock('@/composables/useFeatureFlags', () => ({
  useFeatureFlags: () => ({
    flags: {
      get partnerNodeGovernanceEnabled() {
        return env.state.partnerNodeGovernanceEnabled
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

vi.mock('@/platform/workspace/composables/useWorkspaceUI', () => ({
  useWorkspaceUI: () => ({
    workspaceRole: env.fakeRef('workspaceRole')
  })
}))

vi.mock('@/platform/workspace/stores/partnerNodeGovernanceStore', () => ({
  usePartnerNodeGovernanceStore: () => ({
    get status() {
      return env.state.partnerNodeGovernanceStatus
    },
    get providers() {
      return env.state.partnerNodeGovernanceProviders
    }
  })
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

    Object.assign(env.state, {
      isCloud: false,
      isDesktop: false,
      isLoggedIn: false,
      partnerNodeGovernanceEnabled: false,
      userSecretsEnabled: false,
      workspaceRole: 'owner',
      partnerNodeGovernanceStatus: 'inactive',
      partnerNodeGovernanceProviders: []
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

  it.for([false, true])(
    'hides Workspace for logged-out users when isCloud is %s',
    (isCloud) => {
      env.state.isCloud = isCloud

      const { navGroups } = useSettingUI()

      expect(navGroups.value.map(({ title }) => title)).not.toContain(
        'Workspace'
      )
    }
  )

  it('gives defaultPanel precedence over scrollToSettingId', () => {
    const { defaultCategory } = useSettingUI('about', 'Comfy.Locale')
    expect(defaultCategory.value.key).toBe('about')
  })

  describe('workspace panels', () => {
    beforeEach(() => {
      Object.assign(env.state, {
        isLoggedIn: true,
        userSecretsEnabled: true
      })
    })

    it('shows Plan & Credits and Members on cloud', () => {
      env.state.isCloud = true
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

    it('shows only Plan & Credits in the local Workspace group', () => {
      const { findPanelByKey, navGroups } = useSettingUI()
      const workspaceItems = navGroups.value
        .find((group) => group.title === 'Workspace')
        ?.items.map(({ id, label }) => ({ id, label }))

      expect(workspaceItems).toEqual([
        { id: 'workspace', label: 'PlanCredits' }
      ])
      expect(findPanelByKey('workspace-members')).toBeNull()
      expect(findPanelByKey('workspace-allowlist')).toBeNull()
    })

    it.for([false, true])(
      'uses Workspace and General groups when isCloud is %s',
      (isCloud) => {
        env.state.isCloud = isCloud
        const { navGroups } = useSettingUI()

        expect(navGroups.value.map(({ title }) => title)).toEqual([
          'Workspace',
          'General'
        ])
        expect(
          navGroups.value
            .find((group) => group.title === 'General')
            ?.items.map(({ id }) => id)
        ).toEqual([
          'user',
          'root/Comfy',
          'secrets',
          'root/LiteGraph',
          'root/Appearance',
          'keybinding',
          'extension',
          'about'
        ])
      }
    )

    it('keeps the hidden legacy Credits panel reachable by deep link', () => {
      const { defaultCategory, navGroups } = useSettingUI('credits')

      expect(
        navGroups.value.flatMap((group) => group.items.map(({ id }) => id))
      ).not.toContain('credits')
      expect(defaultCategory.value).toMatchObject({
        key: 'credits',
        label: 'Credits'
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
        partnerNodeGovernanceEnabled: true
      })
    })

    it('exposes workspace sections as Plan & Credits, Members, and Allowlist', () => {
      const { navGroups } = useSettingUI()
      const workspaceGroup = navGroups.value.find(
        ({ title }) => title === 'Workspace'
      )

      expect(workspaceGroup?.items).toMatchObject([
        { id: 'workspace', label: 'PlanCredits' },
        { id: 'workspace-members', label: 'Members' },
        { id: 'workspace-allowlist', label: 'Allowlist' }
      ])
    })

    it('hides Allowlist from workspace members', () => {
      env.state.workspaceRole = 'member'

      const { navGroups } = useSettingUI()

      expect(navKeys(navGroups.value)).not.toContain('workspace-allowlist')
    })

    it('hides Allowlist when governance is unavailable', () => {
      env.state.partnerNodeGovernanceEnabled = false

      const { navGroups } = useSettingUI()

      expect(navKeys(navGroups.value)).not.toContain('workspace-allowlist')
    })

    it('shows the crown when ineligible with providers present (policy-restricted)', () => {
      env.state.partnerNodeGovernanceStatus = 'ineligible'
      env.state.partnerNodeGovernanceProviders = [{ id: 'provider-a' }]

      const { navGroups } = useSettingUI()
      const allowlistItem = navGroups.value
        .flatMap((group) => group.items)
        .find((item) => item.id === 'workspace-allowlist')

      expect(allowlistItem?.suffixIcon).toBe('icon-[lucide--crown]')
    })

    it('does not show the crown when ineligible with no providers (catalog 403)', () => {
      env.state.partnerNodeGovernanceStatus = 'ineligible'
      env.state.partnerNodeGovernanceProviders = []

      const { navGroups } = useSettingUI()
      const allowlistItem = navGroups.value
        .flatMap((group) => group.items)
        .find((item) => item.id === 'workspace-allowlist')

      expect(allowlistItem?.suffixIcon).toBeUndefined()
    })

    it('uses Plan & Credits for logged-in local users', () => {
      env.state.isCloud = false
      const { navGroups } = useSettingUI()

      expect(navKeys(navGroups.value)).toContain('workspace')
      expect(navKeys(navGroups.value)).not.toContain('credits')
      expect(navKeys(navGroups.value)).not.toContain('workspace-members')
      expect(navKeys(navGroups.value)).not.toContain('workspace-allowlist')
    })
  })
})
