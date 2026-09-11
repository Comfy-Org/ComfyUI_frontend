import { useColorPaletteStore } from '@/stores/workspace/colorPaletteStore'
import { beforeEach, describe, expect, it } from 'vitest'

import { useSettingStore } from '@/platform/settings/settingStore'
import { useMinimapSettings } from '@/renderer/extensions/minimap/composables/useMinimapSettings'

beforeEach(() => {
  useSettingStore().settingValues = {
    'Comfy.Minimap.NodeColors': true,
    'Comfy.Minimap.ShowLinks': false,
    'Comfy.Minimap.ShowGroups': true,
    'Comfy.Minimap.RenderBypassState': false,
    'Comfy.Minimap.RenderErrorState': true
  }
})

describe('useMinimapSettings', () => {
  it('should return all minimap settings as computed refs', () => {
    Object.assign(useColorPaletteStore(), {
      completedActivePalette: {
        id: 'test',
        name: 'Test Palette',
        colors: {},
        light_theme: false
      }
    })

    const settings = useMinimapSettings()

    expect(settings.nodeColors.value).toBe(true)
    expect(settings.showLinks.value).toBe(false)
    expect(settings.showGroups.value).toBe(true)
    expect(settings.renderBypass.value).toBe(false)
    expect(settings.renderError.value).toBe(true)
  })

  it('should generate container styles based on theme', () => {
    const mockColorPaletteStore = {
      completedActivePalette: {
        id: 'test',
        name: 'Test Palette',
        colors: {},
        light_theme: false
      }
    }

    Object.assign(useColorPaletteStore(), mockColorPaletteStore)

    const settings = useMinimapSettings()
    const styles = settings.containerStyles.value

    expect(styles.width).toBe('253px')
    expect(styles.height).toBe('200px')
    expect(styles.border).toBe('1px solid var(--interface-stroke)')
    expect(styles.borderRadius).toBe('8px')
  })

  it('should generate light theme container styles', () => {
    const mockColorPaletteStore = {
      completedActivePalette: {
        id: 'test',
        name: 'Test Palette',
        colors: {},
        light_theme: true
      }
    }

    Object.assign(useColorPaletteStore(), mockColorPaletteStore)

    const settings = useMinimapSettings()
    const styles = settings.containerStyles.value

    expect(styles.width).toBe('253px')
    expect(styles.height).toBe('200px')
    expect(styles.border).toBe('1px solid var(--interface-stroke)')
    expect(styles.borderRadius).toBe('8px')
  })

  it('should generate panel styles based on theme', () => {
    const mockColorPaletteStore = {
      completedActivePalette: {
        id: 'test',
        name: 'Test Palette',
        colors: {},
        light_theme: false
      }
    }

    Object.assign(useColorPaletteStore(), mockColorPaletteStore)

    const settings = useMinimapSettings()
    const styles = settings.panelStyles.value

    expect(styles.width).toBe('210px')
    expect(styles.height).toBe('200px')
    expect(styles.border).toBe('1px solid var(--interface-stroke)')
    expect(styles.borderRadius).toBe('8px')
  })

  it('should create computed properties that call the store getter', () => {
    Object.assign(useColorPaletteStore(), {
      completedActivePalette: {
        id: 'test',
        name: 'Test Palette',
        colors: {},
        light_theme: false
      }
    })

    const settings = useMinimapSettings()

    // Access the computed properties
    expect(settings.nodeColors.value).toBe(true)
    expect(settings.showLinks.value).toBe(false)

    // Verify the store getter was called with the correct keys
    expect(useSettingStore().get).toHaveBeenCalledWith(
      'Comfy.Minimap.NodeColors'
    )
    expect(useSettingStore().get).toHaveBeenCalledWith(
      'Comfy.Minimap.ShowLinks'
    )
  })
})
