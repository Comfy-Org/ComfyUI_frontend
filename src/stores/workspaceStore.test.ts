import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useWorkspaceStore } from '@/stores/workspaceStore'

const storeMocks = vi.hoisted(() => ({
  apiKeyAuthStore: {
    isAuthenticated: false
  },
  authStore: {
    currentUser: null as null | { uid: string }
  },
  commandStore: {
    commands: [],
    execute: vi.fn()
  },
  executionErrorStore: {
    lastExecutionError: null,
    lastNodeErrors: null
  },
  queueSettingsStore: {},
  settingStore: {
    settingsById: {},
    get: vi.fn(),
    set: vi.fn()
  },
  sidebarTabStore: {
    registerSidebarTab: vi.fn(),
    unregisterSidebarTab: vi.fn(),
    sidebarTabs: []
  },
  toastStore: {},
  workflowStore: {}
}))

vi.mock('@vueuse/core', () => ({
  useMagicKeys: () => ({ shift: false })
}))

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => storeMocks.settingStore
}))

vi.mock('@/platform/updates/common/toastStore', () => ({
  useToastStore: () => storeMocks.toastStore
}))

vi.mock('@/platform/workflow/management/stores/workflowStore', () => ({
  useWorkflowStore: () => storeMocks.workflowStore
}))

vi.mock('@/services/colorPaletteService', () => ({
  useColorPaletteService: () => ({})
}))

vi.mock('@/services/dialogService', () => ({
  useDialogService: () => ({})
}))

vi.mock('@/stores/apiKeyAuthStore', () => ({
  useApiKeyAuthStore: () => storeMocks.apiKeyAuthStore
}))

vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => storeMocks.authStore
}))

vi.mock('@/stores/commandStore', () => ({
  useCommandStore: () => storeMocks.commandStore
}))

vi.mock('@/stores/executionErrorStore', () => ({
  useExecutionErrorStore: () => storeMocks.executionErrorStore
}))

vi.mock('@/stores/queueStore', () => ({
  useQueueSettingsStore: () => storeMocks.queueSettingsStore
}))

vi.mock('@/stores/workspace/bottomPanelStore', () => ({
  useBottomPanelStore: () => ({})
}))

vi.mock('@/stores/workspace/sidebarTabStore', () => ({
  useSidebarTabStore: () => storeMocks.sidebarTabStore
}))

describe('useWorkspaceStore', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    storeMocks.apiKeyAuthStore.isAuthenticated = false
    storeMocks.authStore.currentUser = null
  })

  it('reports logged out when neither auth source is active', () => {
    const store = useWorkspaceStore()

    expect(store.user.isLoggedIn).toBe(false)
  })

  it('reports logged in for API-key auth', () => {
    storeMocks.apiKeyAuthStore.isAuthenticated = true
    const store = useWorkspaceStore()

    expect(store.user.isLoggedIn).toBe(true)
  })

  it('reports logged in for Firebase auth', () => {
    storeMocks.authStore.currentUser = { uid: 'user-1' }
    const store = useWorkspaceStore()

    expect(store.user.isLoggedIn).toBe(true)
  })
})
