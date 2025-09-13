import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useMinimapSettings } from '@/renderer/extensions/minimap/composables/useMinimapSettings'
import { useSettingStore } from '@/stores/settingStore'
import { useColorPaletteStore } from '@/stores/workspace/colorPaletteStore'

vi.mock('@/stores/settingStore')
vi.mock('@/stores/workspace/colorPaletteStore')

describe('useMinimapSettings', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('should return all minimap settings as computed refs', () => {
    const mockSettingStore = {
      get: vi.fn((key: string) => {
        const settings: Record<string, any> = {
          'Comfy.Minimap.NodeColors': true,
          'Comfy.Minimap.ShowLinks': false,
          'Comfy.Minimap.ShowGroups': true,
          'Comfy.Minimap.RenderBypassState': false,
          'Comfy.Minimap.RenderErrorState': true
        }
        return settings[key]
      })
    }

    vi.mocked(useSettingStore).mockReturnValue(mockSettingStore as any)
    vi.mocked(useColorPaletteStore).mockReturnValue({
      completedActivePalette: { light_theme: false }
    } as any)

    const settings = useMinimapSettings()

    expect(settings.nodeColors.value).toBe(true)
    expect(settings.showLinks.value).toBe(false)
    expect(settings.showGroups.value).toBe(true)
    expect(settings.renderBypass.value).toBe(false)
    expect(settings.renderError.value).toBe(true)
  })

  it('should generate container styles based on theme', () => {
    const mockColorPaletteStore = {
      completedActivePalette: { light_theme: false }
    }

    vi.mocked(useSettingStore).mockReturnValue({ get: vi.fn() } as any)
    vi.mocked(useColorPaletteStore).mockReturnValue(
      mockColorPaletteStore as any
    )

    const settings = useMinimapSettings()
    const styles = settings.containerStyles.value

    expect(styles.width).toBe('250px')
    expect(styles.height).toBe('200px')
    expect(styles.backgroundColor).toBe('#15161C') // dark theme color
    expect(styles.border).toBe('1px solid #333')
  })

  it('should generate light theme container styles', () => {
    const mockColorPaletteStore = {
      completedActivePalette: { light_theme: true }
    }

    vi.mocked(useSettingStore).mockReturnValue({ get: vi.fn() } as any)
    vi.mocked(useColorPaletteStore).mockReturnValue(
      mockColorPaletteStore as any
    )

    const settings = useMinimapSettings()
    const styles = settings.containerStyles.value

    expect(styles.backgroundColor).toBe('#FAF9F5') // light theme color
    expect(styles.border).toBe('1px solid #ccc')
  })

  it('should generate panel styles based on theme', () => {
    const mockColorPaletteStore = {
      completedActivePalette: { light_theme: false }
    }

    vi.mocked(useSettingStore).mockReturnValue({ get: vi.fn() } as any)
    vi.mocked(useColorPaletteStore).mockReturnValue(
      mockColorPaletteStore as any
    )

    const settings = useMinimapSettings()
    const styles = settings.panelStyles.value

    expect(styles.backgroundColor).toBe('#15161C')
    expect(styles.border).toBe('1px solid #333')
    expect(styles.borderRadius).toBe('8px')
  })

  it('should create computed properties that call the store getter', () => {
    const mockGet = vi.fn((key: string) => {
      if (key === 'Comfy.Minimap.NodeColors') return true
      if (key === 'Comfy.Minimap.ShowLinks') return false
      return true
    })
    const mockSettingStore = { get: mockGet }

    vi.mocked(useSettingStore).mockReturnValue(mockSettingStore as any)
    vi.mocked(useColorPaletteStore).mockReturnValue({
      completedActivePalette: { light_theme: false }
    } as any)

    const settings = useMinimapSettings()

    // Access the computed properties
    expect(settings.nodeColors.value).toBe(true)
    expect(settings.showLinks.value).toBe(false)

    // Verify the store getter was called with the correct keys
    expect(mockGet).toHaveBeenCalledWith('Comfy.Minimap.NodeColors')
    expect(mockGet).toHaveBeenCalledWith('Comfy.Minimap.ShowLinks')
  })
})
