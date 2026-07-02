import { fromAny } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { DEFAULT_DARK_COLOR_PALETTE } from '@/constants/coreColorPalettes'
import {
  LGraphCanvas,
  LiteGraph,
  RenderShape
} from '@/lib/litegraph/src/litegraph'
import type { CompletedPalette, Palette } from '@/schemas/colorPaletteSchema'

const mockCanvas = vi.hoisted(() => ({
  default_connection_color_byType: {} as Record<string, string>,
  node_title_color: '',
  default_link_color: '',
  background_image: '',
  clear_background_color: '',
  _pattern: 'pattern' as string | undefined,
  setDirty: vi.fn()
}))

const mockColorPaletteStore = vi.hoisted(() => ({
  customPalettes: {} as Record<string, unknown>,
  palettesLookup: {} as Record<string, unknown>,
  completedActivePalette: undefined as unknown,
  activePaletteId: 'dark',
  addCustomPalette: vi.fn(),
  deleteCustomPalette: vi.fn(),
  completePalette: vi.fn()
}))

const mockSettingStore = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn()
}))

const mockNodeDefStore = vi.hoisted(() => ({
  nodeDataTypes: new Set(['IMAGE', 'MISSING'])
}))

const mockDownloadBlob = vi.hoisted(() => vi.fn())
const mockUploadFile = vi.hoisted(() => vi.fn())

vi.mock('@/scripts/app', () => ({
  app: { canvas: mockCanvas }
}))

vi.mock('@/stores/workspace/colorPaletteStore', () => ({
  useColorPaletteStore: () => mockColorPaletteStore
}))

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => mockSettingStore
}))

vi.mock('@/stores/nodeDefStore', () => ({
  useNodeDefStore: () => mockNodeDefStore
}))

vi.mock('@/base/common/downloadUtil', () => ({
  downloadBlob: mockDownloadBlob
}))

vi.mock('@/scripts/utils', () => ({
  uploadFile: mockUploadFile
}))

vi.mock('@/composables/useErrorHandling', () => ({
  useErrorHandling: () => ({
    wrapWithErrorHandling: <T>(action: T) => action,
    wrapWithErrorHandlingAsync: <T>(action: T) => action
  })
}))

import { useColorPaletteService } from './colorPaletteService'

const validCustomPalette = {
  id: 'custom',
  name: 'Custom',
  colors: {
    node_slot: {},
    litegraph_base: {},
    comfy_base: {}
  }
} satisfies Palette

function makeCompletedPalette(id = 'custom'): CompletedPalette {
  const palette = structuredClone(
    DEFAULT_DARK_COLOR_PALETTE
  ) as CompletedPalette
  palette.id = id
  palette.name = 'Custom'
  palette.colors.node_slot.IMAGE = '#123456'
  palette.colors.litegraph_base.NODE_TITLE_COLOR = '#abcdef'
  palette.colors.litegraph_base.LINK_COLOR = '#fedcba'
  palette.colors.litegraph_base.BACKGROUND_IMAGE = 'grid.png'
  palette.colors.litegraph_base.CLEAR_BACKGROUND_COLOR = '#010203'
  palette.colors.litegraph_base.NODE_DEFAULT_SHAPE = 'legacy'
  palette.colors.comfy_base['fg-color'] = '#111111'
  palette.colors.comfy_base['bg-color'] = '#222222'
  delete palette.colors.comfy_base['contrast-mix-color']
  return palette
}

describe('useColorPaletteService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCanvas.default_connection_color_byType = {}
    mockCanvas.node_title_color = ''
    mockCanvas.default_link_color = ''
    mockCanvas.background_image = ''
    mockCanvas.clear_background_color = ''
    mockCanvas._pattern = 'pattern'
    LGraphCanvas.link_type_colors = {}
    mockSettingStore.get.mockReturnValue('')
    mockSettingStore.set.mockResolvedValue(undefined)
    mockColorPaletteStore.customPalettes = { custom: validCustomPalette }
    mockColorPaletteStore.palettesLookup = { custom: validCustomPalette }
    mockColorPaletteStore.completedActivePalette = makeCompletedPalette()
    mockColorPaletteStore.activePaletteId = 'dark'
    mockColorPaletteStore.completePalette.mockReturnValue(
      makeCompletedPalette()
    )
    document.documentElement.style.cssText = ''
    document.documentElement.style.setProperty(
      '--color-datatype-MISSING',
      '#ffffff'
    )
  })

  it('adds valid custom palettes and persists the custom palette map', async () => {
    const service = useColorPaletteService()

    await service.addCustomColorPalette(validCustomPalette)

    expect(mockColorPaletteStore.addCustomPalette).toHaveBeenCalledWith(
      validCustomPalette
    )
    expect(mockSettingStore.set).toHaveBeenCalledWith(
      'Comfy.CustomColorPalettes',
      mockColorPaletteStore.customPalettes
    )
  })

  it('rejects invalid custom palettes before mutating the store', async () => {
    const service = useColorPaletteService()

    await expect(service.addCustomColorPalette({} as Palette)).rejects.toThrow(
      'Invalid color palette against zod schema'
    )
    expect(mockColorPaletteStore.addCustomPalette).not.toHaveBeenCalled()
  })

  it('deletes custom palettes and persists the custom palette map', async () => {
    const service = useColorPaletteService()

    await service.deleteCustomColorPalette('custom')

    expect(mockColorPaletteStore.deleteCustomPalette).toHaveBeenCalledWith(
      'custom'
    )
    expect(mockSettingStore.set).toHaveBeenCalledWith(
      'Comfy.CustomColorPalettes',
      mockColorPaletteStore.customPalettes
    )
  })

  it('loads palette colors into litegraph, Vue CSS variables, and canvas state', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const service = useColorPaletteService()

    await service.loadColorPalette('custom')

    expect(mockCanvas.default_connection_color_byType.IMAGE).toBe('#123456')
    expect(LGraphCanvas.link_type_colors.IMAGE).toBe('#123456')
    expect(
      document.documentElement.style.getPropertyValue('--color-datatype-IMAGE')
    ).toBe('#123456')
    expect(
      document.documentElement.style.getPropertyValue(
        '--color-datatype-MISSING'
      )
    ).toBe('')
    expect(mockCanvas.node_title_color).toBe('#abcdef')
    expect(mockCanvas.default_link_color).toBe('#fedcba')
    expect(mockCanvas.background_image).toBe('grid.png')
    expect(mockCanvas.clear_background_color).toBe('#010203')
    expect(mockCanvas._pattern).toBeUndefined()
    expect(LiteGraph.NODE_DEFAULT_SHAPE).toBe(RenderShape.ROUND)
    expect(warn).toHaveBeenCalledWith(
      `litegraph_base.NODE_DEFAULT_SHAPE only accepts [${[
        RenderShape.BOX,
        RenderShape.ROUND,
        RenderShape.CARD
      ].join(', ')}] but got legacy`
    )
    expect(document.documentElement.style.getPropertyValue('--fg-color')).toBe(
      '#111111'
    )
    expect(
      document.documentElement.style.getPropertyValue('--contrast-mix-color')
    ).toBe('var(--palette-contrast-mix-color)')
    expect(mockCanvas.setDirty).toHaveBeenCalledWith(true, true)
    expect(mockColorPaletteStore.activePaletteId).toBe('custom')
  })

  it('skips absent palette sections while still activating the palette', async () => {
    const completedPalette = makeCompletedPalette()
    mockColorPaletteStore.completePalette.mockReturnValue(
      fromAny<CompletedPalette, unknown>({
        ...completedPalette,
        colors: {
          node_slot: undefined,
          litegraph_base: completedPalette.colors.litegraph_base,
          comfy_base: undefined
        }
      })
    )
    const service = useColorPaletteService()

    await service.loadColorPalette('custom')

    expect(mockCanvas.node_title_color).toBe('#abcdef')
    expect(mockCanvas.setDirty).toHaveBeenCalledWith(true, true)
    expect(mockColorPaletteStore.activePaletteId).toBe('custom')
  })

  it('removes Vue node theme overrides for built-in palettes', async () => {
    mockColorPaletteStore.palettesLookup = { dark: validCustomPalette }
    mockColorPaletteStore.completePalette.mockReturnValue(
      makeCompletedPalette('dark')
    )
    document.documentElement.style.setProperty(
      '--component-node-border',
      '#ffffff'
    )
    const service = useColorPaletteService()

    await service.loadColorPalette('dark')

    expect(
      document.documentElement.style.getPropertyValue('--component-node-border')
    ).toBe('')
  })

  it('removes Vue node theme variables when completed palette values are absent', async () => {
    const completedPalette = makeCompletedPalette()
    delete completedPalette.colors.litegraph_base.NODE_BOX_OUTLINE_COLOR
    mockColorPaletteStore.completePalette.mockReturnValue(completedPalette)
    document.documentElement.style.setProperty(
      '--component-node-border',
      '#ffffff'
    )
    const service = useColorPaletteService()

    await service.loadColorPalette('custom')

    expect(
      document.documentElement.style.getPropertyValue('--component-node-border')
    ).toBe('')
  })

  it('preserves numeric LiteGraph node shapes without warning', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const completedPalette = makeCompletedPalette()
    completedPalette.colors.litegraph_base.NODE_DEFAULT_SHAPE = RenderShape.CARD
    mockColorPaletteStore.completePalette.mockReturnValue(completedPalette)
    const service = useColorPaletteService()

    await service.loadColorPalette('custom')

    expect(LiteGraph.NODE_DEFAULT_SHAPE).toBe(RenderShape.CARD)
    expect(warn).not.toHaveBeenCalled()
  })

  it('uses explicit optional comfy color values when present', async () => {
    const completedPalette = makeCompletedPalette()
    completedPalette.colors.comfy_base['contrast-mix-color'] = '#333333'
    mockColorPaletteStore.completePalette.mockReturnValue(completedPalette)
    const service = useColorPaletteService()

    await service.loadColorPalette('custom')

    expect(
      document.documentElement.style.getPropertyValue('--contrast-mix-color')
    ).toBe('#333333')
  })

  it('uses a white splash background for light themes', async () => {
    const completedPalette = makeCompletedPalette()
    completedPalette.light_theme = true
    mockColorPaletteStore.completePalette.mockReturnValue(completedPalette)
    const service = useColorPaletteService()

    await service.loadColorPalette('custom')

    expect(localStorage.getItem('comfy-splash-bg')).toBe('#FFFFFF')
    expect(localStorage.getItem('comfy-splash-fg')).toBe('#111111')
  })

  it('uses transparent canvas background and bg image CSS when a background image setting exists', async () => {
    mockSettingStore.get.mockReturnValue('/custom/background.png')
    const service = useColorPaletteService()

    await service.loadColorPalette('custom')

    expect(mockCanvas.clear_background_color).toBe('transparent')
    expect(document.documentElement.style.getPropertyValue('--bg-img')).toBe(
      "url('/custom/background.png')"
    )
  })

  it('throws when loading or exporting an unknown palette', async () => {
    mockColorPaletteStore.palettesLookup = {}
    const service = useColorPaletteService()

    await expect(service.loadColorPalette('missing')).rejects.toThrow(
      'Color palette missing not found'
    )
    expect(() => service.exportColorPalette('missing')).toThrow(
      'Color palette missing not found'
    )
  })

  it('exports palette JSON by id', async () => {
    const service = useColorPaletteService()

    service.exportColorPalette('custom')

    expect(mockDownloadBlob).toHaveBeenCalledOnce()
    const [filename, blob] = mockDownloadBlob.mock.calls[0] as [string, Blob]
    expect(filename).toBe('custom.json')
    await expect(blob.text()).resolves.toContain('"id": "custom"')
  })

  it('imports palette JSON through the custom palette path', async () => {
    mockUploadFile.mockResolvedValue({
      text: () => Promise.resolve(JSON.stringify(validCustomPalette))
    })
    const service = useColorPaletteService()

    const palette = await service.importColorPalette()

    expect(mockUploadFile).toHaveBeenCalledWith('application/json')
    expect(palette).toEqual(validCustomPalette)
    expect(mockColorPaletteStore.addCustomPalette).toHaveBeenCalledWith(
      validCustomPalette
    )
  })

  it('returns the completed active palette from the store', () => {
    const service = useColorPaletteService()

    expect(service.getActiveColorPalette()).toBe(
      mockColorPaletteStore.completedActivePalette
    )
  })
})
