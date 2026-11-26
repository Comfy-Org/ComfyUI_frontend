import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'

import { DEFAULT_THEME_PRESET } from '@comfyorg/theme-core/builtInThemePresets'
import type { Settings } from '@comfyorg/settings-core/types'

import { CORE_SETTINGS } from '@/platform/settings/constants/coreSettings'
import { useSettingStore } from '@/platform/settings/settingStore'
import { api } from '@/scripts/api'
import type { ComfyApp } from '@/scripts/app'

import { useThemeService } from './themeService'
import { useThemeStore } from './themeStore'

vi.mock(import('@/scripts/app'), async () => {
  const { fromPartial } = await import('@total-typescript/shoehorn')
  return {
    app: fromPartial<ComfyApp>({
      canvas: { default_connection_color_byType: {}, setDirty: vi.fn() }
    })
  }
})

describe('saved legacy theme migration', () => {
  beforeEach(() => {
    vi.spyOn(api, 'getSettings')
    vi.spyOn(api, 'storeSettings').mockResolvedValue(new Response())
    vi.spyOn(api, 'storeSetting').mockResolvedValue(new Response())
  })

  it('keeps an imported preset selectable and restores it after reload', async () => {
    vi.mocked(api.getSettings).mockResolvedValue(fromPartial<Settings>({}))
    const settings = useSettingStore()
    await settings.load()
    CORE_SETTINGS.forEach(settings.addSetting)
    const service = useThemeService()
    const custom = { ...DEFAULT_THEME_PRESET, id: 'spooky', name: 'My theme' }

    await service.addCustomThemePreset(custom)
    await settings.set('Comfy.ColorPalette', 'spooky')

    expect(settings.get('Comfy.ColorPalette')).toBe('spooky')
    vi.mocked(api.getSettings).mockResolvedValue(
      fromPartial<Settings>({
        'Comfy.CustomColorPalettes': { spooky: custom },
        'Comfy.ColorPalette': settings.get('Comfy.ColorPalette')
      })
    )
    await settings.load()
    await service.loadCustomThemePresets()

    expect(settings.get('Comfy.ColorPalette')).toBe('spooky')
    expect(useThemeStore().presetsLookup.spooky).toEqual(custom)
  })

  it('keeps a saved selection absent from the preset registry for an extension that registers later', async () => {
    vi.mocked(api.getSettings).mockResolvedValue(
      fromPartial<Settings>({ 'Comfy.ColorPalette': 'missing-theme' })
    )
    const settings = useSettingStore()
    await settings.load()
    CORE_SETTINGS.forEach(settings.addSetting)

    await useThemeService().loadCustomThemePresets()

    expect(settings.get('Comfy.ColorPalette')).toBe('missing-theme')
    expect(api.storeSettings).not.toHaveBeenCalled()
  })

  it.for(['custom_dark', 'dark', undefined])(
    'preserves built-ins and authored colors with selection %s',
    async (activeId) => {
      const custom = {
        ...DEFAULT_THEME_PRESET,
        name: 'My dark theme',
        colors: {
          ...DEFAULT_THEME_PRESET.colors,
          node_slot: { IMAGE: '#123456' }
        }
      }
      vi.mocked(api.getSettings).mockResolvedValue(
        fromPartial<Settings>({
          'Comfy.CustomColorPalettes': { dark: custom },
          'Comfy.ColorPalette': activeId
        })
      )
      const settings = useSettingStore()
      await settings.load()
      CORE_SETTINGS.forEach(settings.addSetting)

      await useThemeService().loadCustomThemePresets()

      expect(useThemeStore().presetsLookup.dark).toEqual(DEFAULT_THEME_PRESET)
      expect(settings.get('Comfy.ColorPalette')).toBe('dark-custom')
      expect(api.storeSettings).toHaveBeenCalledWith({
        'Comfy.CustomColorPalettes': {
          'dark-custom': { ...custom, id: 'dark-custom' }
        },
        'Comfy.ColorPalette': 'dark-custom'
      })
      expect(custom.id).toBe('dark')
    }
  )

  it('avoids occupied IDs and does not migrate again on reload', async () => {
    const custom = { ...DEFAULT_THEME_PRESET, name: 'Legacy dark' }
    const occupied = { ...custom, id: 'dark-custom', name: 'Another theme' }
    vi.mocked(api.getSettings).mockResolvedValue(
      fromPartial<Settings>({
        'Comfy.CustomColorPalettes': { dark: custom, 'dark-custom': occupied },
        'Comfy.ColorPalette': 'light'
      })
    )
    const settings = useSettingStore()
    await settings.load()
    CORE_SETTINGS.forEach(settings.addSetting)
    const service = useThemeService()

    await service.loadCustomThemePresets()

    expect(useThemeStore().customPresets).toEqual({
      'dark-custom': occupied,
      'dark-custom-2': { ...custom, id: 'dark-custom-2' }
    })
    expect(settings.get('Comfy.ColorPalette')).toBe('light')
    await service.loadCustomThemePresets()
    expect(api.storeSettings).toHaveBeenCalledTimes(1)
  })

  it.for([undefined, { blue: { ...DEFAULT_THEME_PRESET, id: 'blue' } }])(
    'restores non-conflicting presets without writing settings (%j)',
    async (presets) => {
      vi.mocked(api.getSettings).mockResolvedValue(
        fromPartial<Settings>({ 'Comfy.CustomColorPalettes': presets })
      )
      const settings = useSettingStore()
      await settings.load()
      CORE_SETTINGS.forEach(settings.addSetting)

      await useThemeService().loadCustomThemePresets()

      expect(useThemeStore().customPresets).toEqual(presets ?? {})
      expect(api.storeSettings).not.toHaveBeenCalled()
    }
  )

  it('keeps built-in and custom themes available when persistence fails', async () => {
    vi.mocked(api.getSettings).mockResolvedValue(
      fromPartial<Settings>({
        'Comfy.CustomColorPalettes': { dark: DEFAULT_THEME_PRESET },
        'Comfy.ColorPalette': 'dark'
      })
    )
    vi.mocked(api.storeSettings).mockRejectedValue(new Error('Offline'))
    const settings = useSettingStore()
    await settings.load()
    CORE_SETTINGS.forEach(settings.addSetting)

    await useThemeService().loadCustomThemePresets()

    expect(useThemeStore().presetsLookup.dark).toEqual(DEFAULT_THEME_PRESET)
    expect(useThemeStore().presetsLookup['dark-custom']).toEqual({
      ...DEFAULT_THEME_PRESET,
      id: 'dark-custom'
    })
    expect(settings.get('Comfy.ColorPalette')).toBe('dark-custom')
  })

  it('applies a provided theme that replaces the active saved palette with the same id', async () => {
    const saved = {
      ...DEFAULT_THEME_PRESET,
      id: 'chalk',
      colors: {
        ...DEFAULT_THEME_PRESET.colors,
        theme: { background: '#111111' }
      }
    }
    vi.mocked(api.getSettings).mockResolvedValue(
      fromPartial<Settings>({
        'Comfy.CustomColorPalettes': { chalk: saved },
        'Comfy.ColorPalette': 'chalk'
      })
    )
    const settings = useSettingStore()
    await settings.load()
    CORE_SETTINGS.forEach(settings.addSetting)
    const service = useThemeService()
    await service.loadCustomThemePresets()
    await service.setActiveTheme('chalk')

    await service.registerProvidedThemes('Chalk.Extension', [
      {
        preset: {
          ...saved,
          colors: { ...saved.colors, theme: { background: '#222222' } }
        }
      }
    ])

    expect(
      document.documentElement.style.getPropertyValue('--background')
    ).toBe('#222222')
  })

  it('claims every provided id before waiting for the selected theme stylesheet', async () => {
    vi.mocked(api.getSettings).mockResolvedValue(
      fromPartial<Settings>({ 'Comfy.ColorPalette': 'first-a' })
    )
    const settings = useSettingStore()
    await settings.load()
    CORE_SETTINGS.forEach(settings.addSetting)
    const service = useThemeService()
    const preset = (id: string, name: string) => ({
      preset: { ...DEFAULT_THEME_PRESET, id, name },
      stylesheetUrl: '/never-loads.css'
    })

    const first = service.registerProvidedThemes('First.Extension', [
      preset('first-a', 'First A'),
      preset('shared', 'First shared')
    ])
    onTestFinished(async () => {
      await service.setActiveTheme('dark')
      await first
    })
    await service.registerProvidedThemes('Second.Extension', [
      preset('shared', 'Second shared')
    ])

    expect(useThemeStore().presetsLookup.shared?.name).toBe('First shared')
  })
})
