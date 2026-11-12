import { nextTick } from 'vue'
import { describe, expect, it, vi } from 'vitest'

import { useSettingStore } from '@/platform/settings/settingStore'
import { useRightSidePanelStore } from '@/renderer/extensions/propertiesPanel/propertiesPanelStore'

vi.mock(import('@/scripts/api'))

function useMenu(mode: 'Top' | 'Disabled') {
  useSettingStore().$patch({
    settingValues: {
      'Comfy.UseNewMenu': mode,
      'Comfy.RightSidePanel.IsOpen': false
    }
  })
}

describe('useRightSidePanelStore', () => {
  it('opens on the requested tab', () => {
    useMenu('Top')
    const store = useRightSidePanelStore()

    store.openPanel('info')

    expect(store.isOpen).toBe(true)
    expect(store.activeTab).toBe('info')
  })

  it('stays closed while the legacy menu is enabled', () => {
    useMenu('Disabled')
    const store = useRightSidePanelStore()

    store.openPanel('info')

    expect(store.isOpen).toBe(false)
    expect(store.activeTab).toBe('parameters')
  })

  it('closes when the user switches to the legacy menu', async () => {
    useMenu('Top')
    const store = useRightSidePanelStore()
    store.openPanel()

    await useSettingStore().set('Comfy.UseNewMenu', 'Disabled')
    await nextTick()

    expect(useSettingStore().get('Comfy.RightSidePanel.IsOpen')).toBe(false)
  })

  it('focuses a section on the parameters tab until it is cleared', () => {
    useMenu('Top')
    const store = useRightSidePanelStore()
    store.openPanel('settings')

    store.focusSection('advanced-inputs')

    expect(store.isOpen).toBe(true)
    expect(store.activeTab).toBe('parameters')
    expect(store.focusedSection).toBe('advanced-inputs')

    store.clearFocusedSection()

    expect(store.focusedSection).toBeNull()
  })

  it('toggles open and closed', () => {
    useMenu('Top')
    const store = useRightSidePanelStore()

    store.togglePanel()
    expect(store.isOpen).toBe(true)

    store.togglePanel()
    expect(store.isOpen).toBe(false)
  })
})
