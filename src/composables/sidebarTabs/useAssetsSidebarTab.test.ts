import { describe, expect, it, vi } from 'vitest'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useAssetsSidebarBadgeStore } from '@/stores/workspace/assetsSidebarBadgeStore'

import { useAssetsSidebarTab } from '@/composables/sidebarTabs/useAssetsSidebarTab'

vi.mock<unknown>(
  import('@/components/sidebar/tabs/AssetsSidebarTab.vue'),
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
