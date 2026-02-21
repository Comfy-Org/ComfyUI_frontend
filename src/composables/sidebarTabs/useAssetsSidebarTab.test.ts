import { describe, expect, it, vi } from 'vitest'

import { useAssetsSidebarTab } from '@/composables/sidebarTabs/useAssetsSidebarTab'

const { mockGetSetting, mockActiveJobsCount } = vi.hoisted(() => ({
  mockGetSetting: vi.fn(),
  mockActiveJobsCount: { value: 0 }
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
    activeJobsCount: mockActiveJobsCount.value
  })
}))

describe('useAssetsSidebarTab', () => {
  it('hides icon badge when QPO V2 is disabled', () => {
    mockGetSetting.mockReturnValue(false)
    mockActiveJobsCount.value = 3

    const sidebarTab = useAssetsSidebarTab()

    expect(typeof sidebarTab.iconBadge).toBe('function')
    expect((sidebarTab.iconBadge as () => string | null)()).toBeNull()
  })

  it('shows active job count when QPO V2 is enabled', () => {
    mockGetSetting.mockReturnValue(true)
    mockActiveJobsCount.value = 3

    const sidebarTab = useAssetsSidebarTab()

    expect(typeof sidebarTab.iconBadge).toBe('function')
    expect((sidebarTab.iconBadge as () => string | null)()).toBe('3')
  })

  it('hides badge when no active jobs', () => {
    mockGetSetting.mockReturnValue(true)
    mockActiveJobsCount.value = 0

    const sidebarTab = useAssetsSidebarTab()

    expect((sidebarTab.iconBadge as () => string | null)()).toBeNull()
  })
})
