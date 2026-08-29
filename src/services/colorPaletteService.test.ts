import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { downloadBlob } from '@/base/common/downloadUtil'
import { app } from '@/scripts/app'
import { useColorPaletteService } from '@/services/colorPaletteService'
import { useColorPaletteStore } from '@/stores/workspace/colorPaletteStore'

vi.mock('@/base/common/downloadUtil', () => ({ downloadBlob: vi.fn() }))

vi.mock('@/scripts/app', () => ({
  app: {
    canvas: {
      default_connection_color_byType: {},
      setDirty: vi.fn()
    }
  }
}))

describe('color palette missing-palette contracts', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  it('does not apply a missing palette', async () => {
    const store = useColorPaletteStore()
    const initialPaletteId = store.activePaletteId

    await expect(
      useColorPaletteService().loadColorPalette('missing')
    ).resolves.toBe(false)

    expect(store.activePaletteId).toBe(initialPaletteId)
    expect(app.canvas.setDirty).not.toHaveBeenCalled()
    expect(console.warn).toHaveBeenCalledWith('Color palette missing not found')
  })

  it('does not download a missing palette', () => {
    const exported = useColorPaletteService().exportColorPalette('missing')

    expect(exported).toBe(false)
    expect(downloadBlob).not.toHaveBeenCalled()
    expect(console.warn).toHaveBeenCalledWith('Color palette missing not found')
  })

  it('applies an existing palette', async () => {
    const store = useColorPaletteStore()
    const paletteId = store.palettes[0].id

    await expect(
      useColorPaletteService().loadColorPalette(paletteId)
    ).resolves.toBe(true)

    expect(store.activePaletteId).toBe(paletteId)
    expect(app.canvas.setDirty).toHaveBeenCalledWith(true, true)
  })

  it('downloads an existing palette', () => {
    const store = useColorPaletteStore()
    const paletteId = store.palettes[0].id

    expect(useColorPaletteService().exportColorPalette(paletteId)).toBe(true)
    expect(downloadBlob).toHaveBeenCalledWith(
      `${paletteId}.json`,
      expect.any(Blob)
    )
  })
})
