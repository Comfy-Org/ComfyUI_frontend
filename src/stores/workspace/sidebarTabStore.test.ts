import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { nextTick, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useSidebarTabStore } from '@/stores/workspace/sidebarTabStore'

const {
  mockGetSetting,
  mockRegisterCommand,
  mockRegisterCommands,
  mockUnregisterCommand,
  mockServerSideModelDownloads
} = vi.hoisted(() => ({
  mockGetSetting: vi.fn(),
  mockRegisterCommand: vi.fn(),
  mockRegisterCommands: vi.fn(),
  mockUnregisterCommand: vi.fn(),
  mockServerSideModelDownloads: { value: false }
}))

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => ({
    get: mockGetSetting
  })
}))

vi.mock('@/stores/commandStore', () => ({
  useCommandStore: () => ({
    registerCommand: mockRegisterCommand,
    unregisterCommand: mockUnregisterCommand,
    commands: []
  })
}))

vi.mock('@/composables/useFeatureFlags', async () => {
  const { ref } = await import('vue')
  const serverSideModelDownloadsRef = ref(mockServerSideModelDownloads.value)
  Object.defineProperty(mockServerSideModelDownloads, 'value', {
    get: () => serverSideModelDownloadsRef.value,
    set: (value: boolean) => {
      serverSideModelDownloadsRef.value = value
    }
  })
  return {
    useFeatureFlags: () => ({
      flags: {
        get serverSideModelDownloads() {
          return mockServerSideModelDownloads.value
        }
      }
    })
  }
})

vi.mock(
  '@/platform/modelManager/composables/useModelManagerSidebarTab',
  () => ({
    useModelManagerSidebarTab: () => ({
      id: 'model-manager',
      title: 'model-manager',
      type: 'vue',
      component: {}
    })
  })
)

vi.mock('@/stores/menuItemStore', () => ({
  useMenuItemStore: () => ({
    registerCommands: mockRegisterCommands
  })
}))

vi.mock('@/i18n', () => ({
  t: (key: string) => key,
  te: () => false
}))

vi.mock('@/composables/sidebarTabs/useAssetsSidebarTab', () => ({
  useAssetsSidebarTab: () => ({
    id: 'assets',
    title: 'assets',
    type: 'vue',
    component: {}
  })
}))

vi.mock('@/composables/sidebarTabs/useJobHistorySidebarTab', () => ({
  useJobHistorySidebarTab: () => ({
    id: 'job-history',
    title: 'job-history',
    type: 'vue',
    component: {}
  })
}))

vi.mock('@/composables/sidebarTabs/useNodeLibrarySidebarTab', () => ({
  useNodeLibrarySidebarTab: () => ({
    id: 'node-library',
    title: 'node-library',
    type: 'vue',
    component: {}
  })
}))

vi.mock('@/composables/sidebarTabs/useModelLibrarySidebarTab', () => ({
  useModelLibrarySidebarTab: () => ({
    id: 'model-library',
    title: 'model-library',
    type: 'vue',
    component: {}
  })
}))

vi.mock(
  '@/platform/workflow/management/composables/useWorkflowsSidebarTab',
  () => ({
    useWorkflowsSidebarTab: () => ({
      id: 'workflows',
      title: 'workflows',
      type: 'vue',
      component: {}
    })
  })
)

vi.mock('@/platform/workflow/management/composables/useAppsSidebarTab', () => ({
  useAppsSidebarTab: () => ({
    id: 'apps',
    title: 'apps',
    type: 'vue',
    component: {}
  })
}))

describe('useSidebarTabStore', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    mockGetSetting.mockReset()
    mockRegisterCommand.mockClear()
    mockRegisterCommands.mockClear()
    mockUnregisterCommand.mockClear()
    mockServerSideModelDownloads.value = false
  })

  it('registers the job history tab when QPO V2 is enabled', () => {
    mockGetSetting.mockImplementation((key: string) =>
      key === 'Comfy.Queue.QPOV2' ? true : undefined
    )

    const store = useSidebarTabStore()
    store.registerCoreSidebarTabs()

    expect(store.sidebarTabs.map((tab) => tab.id)).toEqual([
      'job-history',
      'assets',
      'node-library',
      'model-library',
      'workflows',
      'apps'
    ])
    expect(mockRegisterCommand).toHaveBeenCalledTimes(6)
  })

  it('does not register the job history tab when QPO V2 is disabled', () => {
    mockGetSetting.mockImplementation((key: string) =>
      key === 'Comfy.Queue.QPOV2' ? false : undefined
    )

    const store = useSidebarTabStore()
    store.registerCoreSidebarTabs()

    expect(store.sidebarTabs.map((tab) => tab.id)).toEqual([
      'assets',
      'node-library',
      'model-library',
      'workflows',
      'apps'
    ])
    expect(mockRegisterCommand).toHaveBeenCalledTimes(5)
  })

  it('prepends the job history tab when QPO V2 is toggled on', async () => {
    const qpoV2Enabled = ref(false)
    mockGetSetting.mockImplementation((key: string) =>
      key === 'Comfy.Queue.QPOV2' ? qpoV2Enabled.value : undefined
    )

    const store = useSidebarTabStore()
    store.registerCoreSidebarTabs()

    qpoV2Enabled.value = true
    await nextTick()

    expect(store.sidebarTabs.map((tab) => tab.id)).toEqual([
      'job-history',
      'assets',
      'node-library',
      'model-library',
      'workflows',
      'apps'
    ])
    expect(mockRegisterCommand).toHaveBeenCalledTimes(6)
  })

  it('registers the model-manager tab when the feature flag starts enabled', () => {
    mockServerSideModelDownloads.value = true

    const store = useSidebarTabStore()
    store.registerCoreSidebarTabs()

    expect(store.sidebarTabs.map((tab) => tab.id)).toContain('model-manager')
  })

  it('does not register the model-manager tab when the feature flag is disabled', () => {
    const store = useSidebarTabStore()
    store.registerCoreSidebarTabs()

    expect(store.sidebarTabs.map((tab) => tab.id)).not.toContain(
      'model-manager'
    )
  })

  it('registers the model-manager tab when the feature flag turns on later', async () => {
    const store = useSidebarTabStore()
    store.registerCoreSidebarTabs()
    expect(store.sidebarTabs.map((tab) => tab.id)).not.toContain(
      'model-manager'
    )

    mockServerSideModelDownloads.value = true
    await nextTick()

    expect(store.sidebarTabs.map((tab) => tab.id)).toContain('model-manager')
    expect(mockRegisterCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'Workspace.ToggleSidebarTab.model-manager'
      })
    )
  })

  it('unregisters the model-manager tab and its command when the flag turns off', async () => {
    mockServerSideModelDownloads.value = true
    const store = useSidebarTabStore()
    store.registerCoreSidebarTabs()
    expect(store.sidebarTabs.map((tab) => tab.id)).toContain('model-manager')

    mockServerSideModelDownloads.value = false
    await nextTick()

    expect(store.sidebarTabs.map((tab) => tab.id)).not.toContain(
      'model-manager'
    )
    expect(mockUnregisterCommand).toHaveBeenCalledWith(
      'Workspace.ToggleSidebarTab.model-manager'
    )
  })
})
