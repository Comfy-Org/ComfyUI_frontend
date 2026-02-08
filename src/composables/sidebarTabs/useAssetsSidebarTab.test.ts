import { describe, expect, it, vi } from 'vitest'

import { useAssetsSidebarTab } from '@/composables/sidebarTabs/useAssetsSidebarTab'

const { mockGetSetting, mockPendingTasks } = vi.hoisted(() => ({
  mockGetSetting: vi.fn(),
  mockPendingTasks: [] as unknown[]
}))

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => ({
    get: mockGetSetting
  })
}))

vi.mock('@/components/sidebar/tabs/AssetsSidebarTab.vue', () => ({
  default: {}
}))

vi.mock('@/stores/queueStore', () => ({
  useQueueStore: () => ({
    pendingTasks: mockPendingTasks
  })
}))

describe('useAssetsSidebarTab', () => {
  it('hides icon badge when QPO V2 is disabled', () => {
    mockGetSetting.mockReturnValue(false)
    mockPendingTasks.splice(0, mockPendingTasks.length, {}, {})

    const sidebarTab = useAssetsSidebarTab()

    expect(typeof sidebarTab.iconBadge).toBe('function')
    expect((sidebarTab.iconBadge as () => string | null)()).toBeNull()
  })

  it('shows pending task count when QPO V2 is enabled', () => {
    mockGetSetting.mockReturnValue(true)
    mockPendingTasks.splice(0, mockPendingTasks.length, {}, {}, {})

    const sidebarTab = useAssetsSidebarTab()

    expect(typeof sidebarTab.iconBadge).toBe('function')
    expect((sidebarTab.iconBadge as () => string | null)()).toBe('3')
  })
})
