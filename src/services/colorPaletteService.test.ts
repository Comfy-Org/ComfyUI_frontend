import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type * as canvasPatternUtil from '@/utils/canvasPatternUtil'

const mockSettings = vi.hoisted(() => ({
  values: {} as Record<string, unknown>
}))

vi.mock('@/scripts/app', () => ({
  app: {
    canvas: {
      background_image: 'initial',
      clear_background_color: 'initial',
      _pattern: 'initial',
      node_title_color: '',
      default_link_color: '',
      default_connection_color_byType: {},
      setDirty: vi.fn()
    }
  }
}))

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => ({
    get: (key: string) => mockSettings.values[key],
    set: vi.fn()
  })
}))

vi.mock('@/utils/canvasPatternUtil', async (importOriginal) => ({
  ...(await importOriginal<typeof canvasPatternUtil>()),
  generateCanvasPatternImage: vi.fn(
    (pattern: string, color: string) => `tile:${pattern}:${color}`
  )
}))

import { app } from '@/scripts/app'
import { useColorPaletteService } from '@/services/colorPaletteService'

describe('colorPaletteService canvas background', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    mockSettings.values = {
      'Comfy.Canvas.BackgroundImage': '',
      'Comfy.Canvas.BackgroundPattern': 'dots',
      'Comfy.Canvas.BackgroundColor': ''
    }
    app.canvas.background_image = 'initial'
    app.canvas.clear_background_color = 'initial'
    app.canvas._pattern = 'initial' as unknown as undefined
  })

  it('renders the generated pattern over the palette color by default', async () => {
    await useColorPaletteService().loadColorPalette('dark')

    expect(app.canvas.background_image).toBe('tile:dots:#222222')
    expect(app.canvas.clear_background_color).toBe('#222222')
    expect(app.canvas._pattern).toBeUndefined()
  })

  it('uses the user background color when set', async () => {
    mockSettings.values['Comfy.Canvas.BackgroundColor'] = 'aabbcc'
    mockSettings.values['Comfy.Canvas.BackgroundPattern'] = 'grid'

    await useColorPaletteService().loadColorPalette('dark')

    expect(app.canvas.background_image).toBe('tile:grid:#aabbcc')
    expect(app.canvas.clear_background_color).toBe('#aabbcc')
  })

  it('renders a solid tile when the pattern is none', async () => {
    mockSettings.values['Comfy.Canvas.BackgroundPattern'] = 'none'

    await useColorPaletteService().loadColorPalette('dark')

    expect(app.canvas.background_image).toBe('tile:none:#222222')
  })

  it('lets a custom background image take precedence over patterns', async () => {
    mockSettings.values['Comfy.Canvas.BackgroundImage'] = 'https://bg.png'

    await useColorPaletteService().loadColorPalette('dark')

    expect(app.canvas.background_image).toBe('')
    expect(app.canvas.clear_background_color).toBe('transparent')
    expect(app.canvas._pattern).toBeUndefined()
  })
})
