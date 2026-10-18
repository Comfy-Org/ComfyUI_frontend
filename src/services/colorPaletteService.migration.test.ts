import { fromPartial } from '@total-typescript/shoehorn'
import { getActivePinia } from 'pinia'
import { assert, expect, it, vi } from 'vitest'

import { DEFAULT_COLOR_PALETTE } from '@/constants/coreColorPalettes'
import { useSettingStore } from '@/platform/settings/settingStore'
import type { Settings } from '@/platform/settings/types'
import { api } from '@/scripts/api'
import type { ComfyApp } from '@/scripts/app'
import { useColorPaletteService } from '@/services/colorPaletteService'
import { useColorPaletteStore } from '@/stores/workspace/colorPaletteStore'

vi.mock(import('@/scripts/api'))
vi.mock(import('@/platform/telemetry'))
vi.mock(import('@/scripts/app'), async () => {
  const { fromPartial } = await import('@total-typescript/shoehorn')
  return {
    app: fromPartial<ComfyApp>({
      canvas: { default_connection_color_byType: {}, setDirty: vi.fn() }
    })
  }
})

it.for(['custom_dark', 'dark', undefined])(
  'keeps built-in and legacy custom palettes available with selection %s',
  async (activeId) => {
    const customPalette = {
      ...DEFAULT_COLOR_PALETTE,
      name: 'My dark palette',
      colors: {
        ...DEFAULT_COLOR_PALETTE.colors,
        node_slot: { IMAGE: '#123456' }
      }
    }
    vi.mocked(api.getSettings).mockResolvedValue(
      fromPartial<Settings>({
        'Comfy.CustomColorPalettes': { dark: customPalette },
        'Comfy.ColorPalette': activeId
      })
    )
    const settings = useSettingStore()

    await settings.load()
    await useColorPaletteService().loadCustomColorPalettes()

    const palettes = settings.settingValues['Comfy.CustomColorPalettes']
    assert.exists(palettes)
    const store = useColorPaletteStore()
    expect(store.palettesLookup.dark).toEqual(DEFAULT_COLOR_PALETTE)
    expect(store.palettesLookup['dark-custom']).toEqual({
      ...customPalette,
      id: 'dark-custom'
    })
    expect(settings.settingValues['Comfy.ColorPalette']).toBe('dark-custom')
    expect(api.storeSettings).toHaveBeenCalledWith({
      'Comfy.CustomColorPalettes': {
        'dark-custom': { ...customPalette, id: 'dark-custom' }
      },
      'Comfy.ColorPalette': 'dark-custom'
    })
    expect(customPalette.id).toBe('dark')
  }
)

it('preserves existing custom ids and does not migrate them again after reload', async () => {
  const customPalette = { ...DEFAULT_COLOR_PALETTE, name: 'Legacy dark' }
  const otherPalette = {
    ...DEFAULT_COLOR_PALETTE,
    id: 'dark-custom',
    name: 'Another palette'
  }
  vi.mocked(api.getSettings).mockResolvedValue(
    fromPartial<Settings>({
      'Comfy.CustomColorPalettes': {
        dark: customPalette,
        'dark-custom': otherPalette
      },
      'Comfy.ColorPalette': 'dark-custom'
    })
  )
  const settings = useSettingStore()

  await settings.load()
  await useColorPaletteService().loadCustomColorPalettes()

  expect(settings.settingValues['Comfy.CustomColorPalettes']).toEqual({
    'dark-custom': otherPalette,
    'dark-custom-2': { ...customPalette, id: 'dark-custom-2' }
  })
  expect(settings.settingValues['Comfy.ColorPalette']).toBe('dark-custom')
  expect(api.storeSettings).toHaveBeenCalledWith({
    'Comfy.CustomColorPalettes':
      settings.settingValues['Comfy.CustomColorPalettes']
  })

  const persisted = fromPartial<Settings>(settings.settingValues)
  vi.mocked(api.getSettings).mockResolvedValue(persisted)
  const pinia = getActivePinia()
  assert.exists(pinia)
  settings.$dispose()
  delete pinia.state.value[settings.$id]
  const reloadedSettings = useSettingStore()

  await reloadedSettings.load()
  await useColorPaletteService().loadCustomColorPalettes()

  expect(reloadedSettings.settingValues).toEqual(persisted)
  expect(api.storeSettings).toHaveBeenCalledTimes(1)
})

it.for([undefined, { blue: { ...DEFAULT_COLOR_PALETTE, id: 'blue' } }])(
  'leaves non-conflicting palettes and settings unchanged (%j)',
  async (palettes) => {
    const stored = fromPartial<Settings>({
      'Comfy.CustomColorPalettes': palettes,
      'Comfy.ColorPalette': 'light'
    })
    vi.mocked(api.getSettings).mockResolvedValue(stored)
    const settings = useSettingStore()

    await settings.load()
    await useColorPaletteService().loadCustomColorPalettes()

    expect(settings.settingValues).toEqual(stored)
    expect(api.storeSettings).not.toHaveBeenCalled()
  }
)

it('keeps both palettes usable when migration persistence fails', async () => {
  vi.mocked(api.getSettings).mockResolvedValue(
    fromPartial<Settings>({
      'Comfy.CustomColorPalettes': {
        dark: { ...DEFAULT_COLOR_PALETTE, name: 'Legacy dark' }
      },
      'Comfy.ColorPalette': 'dark'
    })
  )
  const failure = new Error('Settings unavailable')
  vi.mocked(api.storeSettings).mockRejectedValue(failure)
  const settings = useSettingStore()

  await settings.load()
  await useColorPaletteService().loadCustomColorPalettes()

  expect(settings.isReady).toBe(true)
  expect(settings.error).toBeUndefined()
  expect(settings.settingValues['Comfy.ColorPalette']).toBe('dark-custom')
  expect(settings.settingValues['Comfy.CustomColorPalettes']).toEqual({
    'dark-custom': {
      ...DEFAULT_COLOR_PALETTE,
      id: 'dark-custom',
      name: 'Legacy dark'
    }
  })
  expect(console.error).toHaveBeenCalledWith(failure)
})

it('keeps unsaved palette edits separate from loaded settings', async () => {
  const palette = { ...DEFAULT_COLOR_PALETTE, id: 'blue', name: 'Saved blue' }
  vi.mocked(api.getSettings).mockResolvedValue(
    fromPartial<Settings>({ 'Comfy.CustomColorPalettes': { blue: palette } })
  )
  const settings = useSettingStore()
  await settings.load()
  await useColorPaletteService().loadCustomColorPalettes()

  useColorPaletteStore().customPalettes.blue.name = 'Unsaved edit'

  expect(settings.settingValues['Comfy.CustomColorPalettes']).toEqual({
    blue: palette
  })
  expect(palette.name).toBe('Saved blue')
  expect(api.storeSettings).not.toHaveBeenCalled()
})
