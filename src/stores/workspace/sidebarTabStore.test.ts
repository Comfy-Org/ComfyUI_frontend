import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { nextTick, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ComfyCommand } from '@/stores/commandStore'
import { useSidebarTabStore } from '@/stores/workspace/sidebarTabStore'

const {
  mockGetSetting,
  mockRegisterCommand,
  mockRegisterCommands,
  mockBrowseModelAssets,
  mockT,
  mockTe,
  registeredCommands,
  commandStoreCommands
} = vi.hoisted(() => {
  const registeredCommands: ComfyCommand[] = []
  return {
    mockGetSetting: vi.fn(),
    mockRegisterCommand: vi.fn(),
    mockRegisterCommands: vi.fn(),
    mockBrowseModelAssets: vi.fn(),
    mockT: vi.fn(),
    mockTe: vi.fn(),
    registeredCommands,
    commandStoreCommands: [] as ComfyCommand[]
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
  t: mockT,
  te: mockTe
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
    registeredCommands.length = 0
    commandStoreCommands.length = 0
    mockRegisterCommand.mockImplementation((command) =>
      registeredCommands.push(command)
    )
    mockT.mockImplementation((key: string) => `translated:${key}`)
    mockTe.mockReturnValue(false)
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

    it('opens the asset browser when the browser and asset API are enabled', async () => {
      mockGetSetting.mockImplementation((key: string) =>
        key === 'Comfy.ModelLibrary.UseAssetBrowser' ||
        key === 'Comfy.Assets.UseAssetAPI'
          ? true
          : undefined
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

    it('falls back to the sidebar tree when the asset API is disabled', async () => {
      mockGetSetting.mockImplementation((key: string) =>
        key === 'Comfy.ModelLibrary.UseAssetBrowser' ? true : false
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
  })

  it('registers command metadata and toggles a custom sidebar tab', async () => {
    mockTe.mockImplementation((key: string) => key === 'custom.title')
    const store = useSidebarTabStore()
    store.registerSidebarTab({
      id: 'custom',
      title: 'custom.title',
      tooltip: 'custom.tooltip',
      icon: { render: () => null },
      type: 'vue',
      component: {}
    })

    const command = registeredCommands[0]
    if (
      typeof command.label !== 'function' ||
      typeof command.menubarLabel !== 'function' ||
      !command.active
    ) {
      throw new Error('expected dynamic command metadata')
    }
    expect(command.icon).toBeUndefined()
    expect(command.label()).toBe('Toggle translated:custom.title Sidebar')
    expect(command.tooltip).toBe('custom.tooltip')
    expect(command.menubarLabel()).toBe('custom.title')

    await command.function()
    expect(store.activeSidebarTabId).toBe('custom')
    expect(command.active()).toBe(true)

    await command.function()
    expect(store.activeSidebarTabId).toBeNull()
  })

  it('uses translated menubar labels for known core tabs', () => {
    mockTe.mockImplementation((key: string) => key === 'sideToolbar.assets')
    const store = useSidebarTabStore()
    store.registerSidebarTab({
      id: 'assets',
      title: 'assets',
      type: 'vue',
      component: {}
    })

    const { menubarLabel } = registeredCommands[0]
    if (typeof menubarLabel !== 'function') {
      throw new Error('expected a dynamic menubar label')
    }
    expect(menubarLabel()).toBe('translated:sideToolbar.assets')
  })

  it('destroys custom tabs and clears active state on unregister', () => {
    const destroy = vi.fn()
    const store = useSidebarTabStore()
    store.registerSidebarTab({
      id: 'custom',
      title: 'Custom',
      type: 'custom',
      render: vi.fn(),
      destroy
    })
    store.toggleSidebarTab('custom')

    store.unregisterSidebarTab('custom')

    expect(destroy).toHaveBeenCalledOnce()
    expect(store.sidebarTabs).toHaveLength(0)
    expect(store.activeSidebarTabId).toBeNull()
  })

  it('ignores unregister requests for missing tabs', () => {
    const store = useSidebarTabStore()

    store.unregisterSidebarTab('missing')

    expect(store.sidebarTabs).toHaveLength(0)
  })
})
