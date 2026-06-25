import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { nextTick, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useSidebarTabStore } from '@/stores/workspace/sidebarTabStore'

const {
  mockGetSetting,
  mockRegisterCommand,
  mockRegisterCommands,
  mockBrowseModelAssets,
  registeredCommands,
  commandStoreCommands
} = vi.hoisted(() => {
  const registeredCommands: { id: string; function: () => unknown }[] = []
  return {
    mockGetSetting: vi.fn(),
    mockRegisterCommand: vi.fn((command) => registeredCommands.push(command)),
    mockRegisterCommands: vi.fn(),
    mockBrowseModelAssets: vi.fn(),
    registeredCommands,
    commandStoreCommands: [] as { id: string; function: () => unknown }[]
  }
})

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => ({
    get: mockGetSetting
  })
}))

vi.mock('@/stores/commandStore', () => ({
  useCommandStore: () => ({
    registerCommand: mockRegisterCommand,
    commands: commandStoreCommands
  })
}))

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
    mockBrowseModelAssets.mockClear()
    registeredCommands.length = 0
    commandStoreCommands.length = 0
  })

  const toggleModelLibrary = async () => {
    const toggleCommand = registeredCommands.find(
      (command) => command.id === 'Workspace.ToggleSidebarTab.model-library'
    )
    await toggleCommand?.function()
  }

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

  describe('model library view selection', () => {
    it('toggles the sidebar tab when the asset view is disabled', async () => {
      mockGetSetting.mockImplementation((key: string) =>
        key === 'Comfy.ModelLibrary.UseAssetBrowser' ? false : undefined
      )
      commandStoreCommands.push({
        id: 'Comfy.BrowseModelAssets',
        function: mockBrowseModelAssets
      })

      const store = useSidebarTabStore()
      store.registerCoreSidebarTabs()

      await toggleModelLibrary()

      expect(store.activeSidebarTabId).toBe('model-library')
      expect(mockBrowseModelAssets).not.toHaveBeenCalled()
    })

    it('opens the asset browser when the asset view is enabled', async () => {
      mockGetSetting.mockImplementation((key: string) =>
        key === 'Comfy.ModelLibrary.UseAssetBrowser' ? true : undefined
      )
      commandStoreCommands.push({
        id: 'Comfy.BrowseModelAssets',
        function: mockBrowseModelAssets
      })

      const store = useSidebarTabStore()
      store.registerCoreSidebarTabs()

      await toggleModelLibrary()

      expect(mockBrowseModelAssets).toHaveBeenCalledOnce()
      expect(store.activeSidebarTabId).toBeNull()
    })
  })
})
