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
  mockInstallLiteGraphBridge,
  mockBackfillServerDeprecations
} = vi.hoisted(() => ({
  mockGetSetting: vi.fn(),
  mockRegisterCommand: vi.fn(),
  mockRegisterCommands: vi.fn(),
  mockUnregisterCommand: vi.fn(),
  mockInstallLiteGraphBridge: vi.fn(),
  mockBackfillServerDeprecations: vi.fn().mockResolvedValue(undefined)
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

vi.mock('@/composables/sidebarTabs/useDeprecationWarningsSidebarTab', () => ({
  DEPRECATION_WARNINGS_TAB_ID: 'deprecation-warnings',
  useDeprecationWarningsSidebarTab: () => ({
    id: 'deprecation-warnings',
    title: 'deprecation-warnings',
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

vi.mock('@/platform/dev/installLiteGraphDeprecationBridge', () => ({
  installLiteGraphDeprecationBridge: mockInstallLiteGraphBridge
}))

vi.mock('@/platform/dev/backfillServerDeprecations', () => ({
  backfillServerDeprecations: mockBackfillServerDeprecations
}))

describe('useSidebarTabStore', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    vi.clearAllMocks()
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

  it('registers the deprecation warnings tab when DevMode is enabled at init', () => {
    mockGetSetting.mockImplementation((key: string) =>
      key === 'Comfy.DevMode' ? true : undefined
    )

    const store = useSidebarTabStore()
    store.registerCoreSidebarTabs()

    expect(store.sidebarTabs.map((tab) => tab.id)).toContain(
      'deprecation-warnings'
    )
  })

  it('does not register the deprecation warnings tab when DevMode is disabled', () => {
    mockGetSetting.mockImplementation(() => false)

    const store = useSidebarTabStore()
    store.registerCoreSidebarTabs()

    expect(store.sidebarTabs.map((tab) => tab.id)).not.toContain(
      'deprecation-warnings'
    )
  })

  it('registers and unregisters the deprecation warnings tab when DevMode is toggled', async () => {
    const devMode = ref(false)
    mockGetSetting.mockImplementation((key: string) =>
      key === 'Comfy.DevMode' ? devMode.value : undefined
    )

    const store = useSidebarTabStore()
    store.registerCoreSidebarTabs()

    expect(store.sidebarTabs.map((tab) => tab.id)).not.toContain(
      'deprecation-warnings'
    )

    devMode.value = true
    await nextTick()
    expect(store.sidebarTabs.map((tab) => tab.id)).toContain(
      'deprecation-warnings'
    )

    devMode.value = false
    await nextTick()
    expect(store.sidebarTabs.map((tab) => tab.id)).not.toContain(
      'deprecation-warnings'
    )
  })

  it('unregisters the toggle command when DevMode flips off so re-enabling does not warn', async () => {
    const devMode = ref(false)
    mockGetSetting.mockImplementation((key: string) =>
      key === 'Comfy.DevMode' ? devMode.value : undefined
    )

    const store = useSidebarTabStore()
    store.registerCoreSidebarTabs()

    devMode.value = true
    await nextTick()
    devMode.value = false
    await nextTick()
    devMode.value = true
    await nextTick()

    expect(store.sidebarTabs.map((tab) => tab.id)).toContain(
      'deprecation-warnings'
    )
    expect(mockUnregisterCommand).toHaveBeenCalledWith(
      'Workspace.ToggleSidebarTab.deprecation-warnings'
    )
    const deprecationRegistrations = mockRegisterCommand.mock.calls.filter(
      ([cmd]) => cmd.id === 'Workspace.ToggleSidebarTab.deprecation-warnings'
    )
    expect(deprecationRegistrations).toHaveLength(2)
  })

  it('installs the LiteGraph bridge and backfills server logs at boot regardless of DevMode', () => {
    mockGetSetting.mockImplementation(() => false)

    useSidebarTabStore().registerCoreSidebarTabs()

    expect(mockInstallLiteGraphBridge).toHaveBeenCalledTimes(1)
    expect(mockBackfillServerDeprecations).toHaveBeenCalledTimes(1)
  })

  it('does not re-install the bridge or re-backfill when DevMode flips on later', async () => {
    const devMode = ref(false)
    mockGetSetting.mockImplementation((key: string) =>
      key === 'Comfy.DevMode' ? devMode.value : undefined
    )

    useSidebarTabStore().registerCoreSidebarTabs()
    devMode.value = true
    await nextTick()

    expect(mockInstallLiteGraphBridge).toHaveBeenCalledTimes(1)
    expect(mockBackfillServerDeprecations).toHaveBeenCalledTimes(1)
  })
})
