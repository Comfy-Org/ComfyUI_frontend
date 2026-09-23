import {
  assert,
  beforeEach,
  describe,
  expect,
  it,
  onTestFinished,
  vi
} from 'vitest'

import { downloadBlob } from '@/base/common/downloadUtil'
import { useToastStore } from '@/platform/updates/common/toastStore'
import type { ComfyApp } from '@/scripts/app'
import { app } from '@/scripts/app'
import { useColorPaletteService } from '@/services/colorPaletteService'
import { useColorPaletteStore } from '@/stores/workspace/colorPaletteStore'

vi.mock(import('@/base/common/downloadUtil'))
vi.mock(import('@/scripts/app'), async () => {
  const { fromPartial } = await import('@total-typescript/shoehorn')
  return {
    app: fromPartial<ComfyApp>({
      canvas: { default_connection_color_byType: {}, setDirty: vi.fn() }
    })
  }
})

describe('color palette missing-palette contracts', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('does not apply a missing palette', async () => {
    const store = useColorPaletteStore()
    const initialPaletteId = store.activePaletteId

    await useColorPaletteService().loadColorPalette('missing')

    expect(store.activePaletteId).toBe(initialPaletteId)
    expect(app.canvas.setDirty).not.toHaveBeenCalled()
    expect(useToastStore().messagesToAdd).toContainEqual(
      expect.objectContaining({
        severity: 'error',
        detail: 'Color palette missing not found'
      })
    )
    expect(console.error).toHaveBeenCalledWith(
      new Error('Color palette missing not found')
    )
  })

  it('distinguishes an infrastructure failure from a missing palette', async () => {
    const store = useColorPaletteStore()
    const initialPaletteId = store.activePaletteId
    const paletteId = store.palettes[0].id
    const error = new Error('Failed to complete palette')
    vi.spyOn(store, 'completePalette').mockImplementation(() => {
      throw error
    })

    await expect(
      useColorPaletteService().loadColorPalette(paletteId)
    ).resolves.toBeUndefined()

    expect(store.activePaletteId).toBe(initialPaletteId)
    expect(app.canvas.setDirty).not.toHaveBeenCalled()
    expect(useToastStore().messagesToAdd).toContainEqual(
      expect.objectContaining({
        severity: 'error',
        detail: error.message
      })
    )
    expect(console.error).toHaveBeenCalledWith(error)
  })

  it('does not download a missing palette', () => {
    useColorPaletteService().exportColorPalette('missing')

    expect(downloadBlob).not.toHaveBeenCalled()
    expect(useToastStore().messagesToAdd).toContainEqual(
      expect.objectContaining({
        severity: 'error',
        detail: 'Color palette missing not found'
      })
    )
    expect(console.error).toHaveBeenCalledWith(
      new Error('Color palette missing not found')
    )
  })

  it('applies an existing palette', async () => {
    const store = useColorPaletteStore()
    const paletteId = store.palettes[0].id

    await useColorPaletteService().loadColorPalette(paletteId)

    expect(store.activePaletteId).toBe(paletteId)
    expect(app.canvas.setDirty).toHaveBeenCalledWith(true, true)
  })

  it('downloads an existing palette', () => {
    const store = useColorPaletteStore()
    const paletteId = store.palettes[0].id

    useColorPaletteService().exportColorPalette(paletteId)
    expect(downloadBlob).toHaveBeenCalledWith(
      `${paletteId}.json`,
      expect.any(Blob)
    )
  })
})

const SHADOW_PROPERTY = '--interface-floating-panel-shadow'
const SHADOW_FALLBACK = 'var(--palette-interface-floating-panel-shadow)'

function readRootShadow() {
  return document.documentElement.style.getPropertyValue(SHADOW_PROPERTY)
}

function restoreRootShadowAfterTest() {
  const previous = readRootShadow()
  onTestFinished(() => {
    document.documentElement.style.setProperty(SHADOW_PROPERTY, previous)
  })
}

describe('useColorPaletteService', () => {
  it.for([
    { paletteId: 'dark', expected: SHADOW_FALLBACK },
    { paletteId: 'light', expected: '0 2px 16px 0 rgba(0, 0, 0, 0.2)' }
  ])(
    'resolves the floating panel shadow through the palette contract ($paletteId)',
    async ({ paletteId, expected }) => {
      restoreRootShadowAfterTest()

      await useColorPaletteService().loadColorPalette(paletteId)

      expect(readRootShadow()).toBe(expected)
    }
  )

  it('lets a custom palette own the floating panel shadow and falls back once the next palette omits it', async () => {
    restoreRootShadowAfterTest()
    const store = useColorPaletteStore()
    const dark = store.palettesLookup.dark
    assert.exists(dark)
    const customShadow = '0 0 0 9px rgb(1 2 3)'
    store.addCustomPalette({
      ...dark,
      id: 'custom-shadow',
      colors: {
        ...dark.colors,
        comfy_base: {
          ...dark.colors.comfy_base,
          'interface-floating-panel-shadow': customShadow
        }
      }
    })
    const service = useColorPaletteService()

    await service.loadColorPalette('custom-shadow')
    expect(readRootShadow()).toBe(customShadow)

    await service.loadColorPalette('dark')
    expect(readRootShadow()).toBe(SHADOW_FALLBACK)
  })
})
