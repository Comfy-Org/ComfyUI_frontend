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
})
