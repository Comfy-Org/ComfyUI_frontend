import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'

import { useSettingStore } from '@/platform/settings/settingStore'

import { useBootstrapStore } from './bootstrapStore'

vi.mock('@/scripts/api', () => ({
  api: {
    init: vi.fn().mockResolvedValue(undefined),
    getNodeDefs: vi.fn().mockResolvedValue({ TestNode: { name: 'TestNode' } }),
    getCustomNodesI18n: vi.fn().mockResolvedValue({}),
    getUserConfig: vi.fn().mockResolvedValue({})
  }
}))

vi.mock('@/i18n', () => ({
  mergeCustomNodesI18n: vi.fn()
}))

const mockIsSettingsReady = ref(false)

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: vi.fn(() => ({
    load: vi.fn(() => {
      mockIsSettingsReady.value = true
    }),
    get isReady() {
      return mockIsSettingsReady.value
    },
    isLoading: ref(false),
    error: ref(undefined)
  }))
}))

vi.mock('@/platform/workflow/management/stores/workflowStore', () => ({
  useWorkflowStore: vi.fn(() => ({
    loadWorkflows: vi.fn(),
    syncWorkflows: vi.fn().mockResolvedValue(undefined)
  }))
}))

const mockNeedsLogin = ref(false)
vi.mock('@/stores/userStore', () => ({
  useUserStore: vi.fn(() => ({
    initialize: vi.fn().mockResolvedValue(undefined),
    needsLogin: mockNeedsLogin
  }))
}))

const mockIsAuthInitialized = ref(false)
const mockIsAuthAuthenticated = ref(false)
vi.mock('@/stores/authStore', () => ({
  useAuthStore: vi.fn(() => ({
    isInitialized: mockIsAuthInitialized,
    isAuthenticated: mockIsAuthAuthenticated
  }))
}))

const mockDistributionTypes = vi.hoisted(() => ({
  isCloud: false
}))
vi.mock('@/platform/distribution/types', () => mockDistributionTypes)

describe('bootstrapStore', () => {
  beforeEach(() => {
    mockIsSettingsReady.value = false
    mockIsAuthInitialized.value = false
    mockIsAuthAuthenticated.value = false
    mockNeedsLogin.value = false
    mockDistributionTypes.isCloud = false
    setActivePinia(createTestingPinia({ stubActions: false }))
    vi.clearAllMocks()
  })

  it('initializes with all flags false', () => {
    const store = useBootstrapStore()
    const settingStore = useSettingStore()
    expect(settingStore.isReady).toBe(false)
    expect(store.isI18nReady).toBe(false)
  })

  it('starts store bootstrap (settings, i18n)', async () => {
    const store = useBootstrapStore()
    const settingStore = useSettingStore()
    void store.startStoreBootstrap()

    await vi.waitFor(() => {
      expect(settingStore.isReady).toBe(true)
      expect(store.isI18nReady).toBe(true)
    })
  })

  describe('cloud mode', () => {
    beforeEach(() => {
      mockDistributionTypes.isCloud = true
    })

    it('waits for Firebase auth before loading stores', async () => {
      const store = useBootstrapStore()
      const settingStore = useSettingStore()
      const bootstrapPromise = store.startStoreBootstrap()

      expect(store.isI18nReady).toBe(false)
      expect(settingStore.isReady).toBe(false)

      // Firebase initialized but user not yet authenticated
      mockIsAuthInitialized.value = true
      await nextTick()

      expect(store.isI18nReady).toBe(false)
      expect(settingStore.isReady).toBe(false)

      // User authenticates (e.g. signs in on login page)
      mockIsAuthAuthenticated.value = true
      await bootstrapPromise

      await vi.waitFor(() => {
        expect(store.isI18nReady).toBe(true)
        expect(settingStore.isReady).toBe(true)
      })
    })
  })
})
