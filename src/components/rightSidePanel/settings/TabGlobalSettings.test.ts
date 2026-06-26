import { cleanup, render, fireEvent, screen } from '@testing-library/vue'
import { describe, expect, it, vi, afterEach } from 'vitest'
import { createI18n } from 'vue-i18n'
import PrimeVue from 'primevue/config'
import { createTestingPinia } from '@pinia/testing'
import TabGlobalSettings from '@/components/rightSidePanel/settings/TabGlobalSettings.vue'
import { useRightSidePanelStore } from '@/stores/workspace/rightSidePanelStore'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      rightSidePanel: {
        globalSettings: {
          nodes: 'Nodes',
          showAdvanced: 'Show Advanced Parameters'
        }
      }
    }
  }
})

const mockSettings: Record<string, unknown> = {
  'Comfy.Node.AlwaysShowAdvancedWidgets': false,
  'Comfy.Canvas.SelectionToolbox': false,
  'Comfy.VueNodes.Enabled': false,
  'Comfy.SnapToGrid.GridSize': 10,
  'pysssss.SnapToGrid': false,
  'Comfy.Graph.LinkMarkers': 'None',
  'Comfy.LinkRenderMode': 'Spline'
}

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => ({
    get: vi.fn((key: string) => mockSettings[key]),
    set: vi.fn((key: string, val: unknown) => {
      mockSettings[key] = val
    })
  })
}))

vi.mock('@/platform/settings/composables/useSettingsDialog', () => ({
  useSettingsDialog: () => ({
    show: vi.fn()
  })
}))

describe('TabGlobalSettings', () => {
  afterEach(() => {
    cleanup()
  })

  it('adds and removes highlight class when highlight gets triggered and animation ends', async () => {
    const pinia = createTestingPinia({ stubActions: false })
    render(TabGlobalSettings, {
      global: {
        plugins: [i18n, pinia, PrimeVue]
      }
    })

    const rightSidePanelStore = useRightSidePanelStore()

    // 1. Initially, the switch container does not have the animate-highlight class
    const switchEl = screen.getByTestId('advanced-widgets-switch')
    expect(switchEl).not.toHaveClass('animate-highlight')

    // 2. Trigger highlight in the store
    rightSidePanelStore.highlightGlobalSetting =
      'Comfy.Node.AlwaysShowAdvancedWidgets'

    // Wait for watchers to update DOM
    await new Promise((resolve) => setTimeout(resolve, 0))

    // 3. The switch container should now have the animate-highlight class
    expect(switchEl).toHaveClass('animate-highlight')

    // 4. Trigger animationend event
    await fireEvent.animationEnd(switchEl)

    // 5. The class should be removed
    expect(switchEl).not.toHaveClass('animate-highlight')
  })
})
