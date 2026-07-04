import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { nextTick, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useSidebarTabStore } from '@/stores/workspace/sidebarTabStore'

const {
  mockCommands,
  mockGetSetting,
  mockRegisterCommand,
  mockRegisterCommands,
  mockT,
  mockTe
} = vi.hoisted(() => ({
  mockCommands: [] as Array<{ id: string; function?: () => void }>,
  mockGetSetting: vi.fn(),
  mockRegisterCommand: vi.fn(),
  mockRegisterCommands: vi.fn(),
  mockT: vi.fn((key: string) => `translated:${key}`),
  mockTe: vi.fn((_key: string) => false)
}))

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => ({
    get: mockGetSetting
  })
}))

vi.mock('@/stores/commandStore', () => ({
  useCommandStore: () => ({
    registerCommand: mockRegisterCommand,
    commands: mockCommands
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
    mockCommands.length = 0
    mockGetSetting.mockReset()
    mockT.mockClear()
    mockTe.mockReset()
    mockTe.mockReturnValue(false)
    mockRegisterCommand.mockClear()
    mockRegisterCommands.mockClear()
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

  it('removes the job history tab when QPO V2 is toggled off', async () => {
    const qpoV2Enabled = ref(true)
    mockGetSetting.mockImplementation((key: string) =>
      key === 'Comfy.Queue.QPOV2' ? qpoV2Enabled.value : undefined
    )

    const store = useSidebarTabStore()
    store.registerCoreSidebarTabs()
    expect(store.sidebarTabs[0].id).toBe('job-history')

    qpoV2Enabled.value = false
    await nextTick()

    expect(store.sidebarTabs.map((tab) => tab.id)).not.toContain('job-history')
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

    const command = mockRegisterCommand.mock.calls[0][0]
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

    const command = mockRegisterCommand.mock.calls[0][0]

    expect(command.menubarLabel()).toBe('translated:sideToolbar.assets')
  })

  it('delegates model library command to BrowseModelAssets when asset API is enabled', async () => {
    const browseModelAssets = vi.fn()
    mockCommands.push({
      id: 'Comfy.BrowseModelAssets',
      function: browseModelAssets
    })
    mockGetSetting.mockImplementation((key: string) =>
      key === 'Comfy.Assets.UseAssetAPI' ? true : undefined
    )
    const store = useSidebarTabStore()
    store.registerSidebarTab({
      id: 'model-library',
      title: 'Models',
      type: 'vue',
      component: {}
    })

    const command = mockRegisterCommand.mock.calls[0][0]
    await command.function()

    expect(browseModelAssets).toHaveBeenCalledOnce()
    expect(store.activeSidebarTabId).toBeNull()
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
