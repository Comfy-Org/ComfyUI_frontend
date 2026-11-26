import { describe, expect, it, vi } from 'vitest'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useAssetsSidebarBadgeStore } from '@/platform/assets/stores/assetsSidebarBadgeStore'

import { useAssetsSidebarTab } from '@/platform/assets/integration/useAssetsSidebarTab'

vi.mock<unknown>(
  import('@/platform/assets/components/sidebar/AssetsSidebarTab.vue'),
  () => ({
    default: {}
  })
)

describe('useAssetsSidebarTab', () => {
  it('hides icon badge when QPO V2 is disabled', () => {
    useSettingStore().settingValues['Comfy.Queue.QPOV2'] = false
    Object.assign(useAssetsSidebarBadgeStore(), { unseenAddedAssetsCount: 3 })

    const sidebarTab = useAssetsSidebarTab()

    expect(typeof sidebarTab.iconBadge).toBe('function')
    expect((sidebarTab.iconBadge as () => string | null)()).toBeNull()
  })

  it('shows unseen added assets count when QPO V2 is enabled', () => {
    useSettingStore().settingValues['Comfy.Queue.QPOV2'] = true
    Object.assign(useAssetsSidebarBadgeStore(), { unseenAddedAssetsCount: 3 })

    const sidebarTab = useAssetsSidebarTab()

    expect(typeof sidebarTab.iconBadge).toBe('function')
    expect((sidebarTab.iconBadge as () => string | null)()).toBe('3')
  })

  it('hides badge when there are no unseen added assets', () => {
    useSettingStore().settingValues['Comfy.Queue.QPOV2'] = true

    const sidebarTab = useAssetsSidebarTab()

    expect((sidebarTab.iconBadge as () => string | null)()).toBeNull()
  })
})
