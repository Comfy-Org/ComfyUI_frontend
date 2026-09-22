import { describe, expect, it, vi } from 'vitest'

import { useColorPaletteService } from '@/services/colorPaletteService'

vi.mock<unknown>(import('@/scripts/app'), () => ({
  app: { canvas: { default_connection_color_byType: {}, setDirty: vi.fn() } }
}))

describe('useColorPaletteService', () => {
  it.for([
    {
      paletteId: 'dark',
      expected: 'var(--palette-interface-floating-panel-shadow)'
    },
    { paletteId: 'light', expected: '0 2px 16px 0 rgba(0, 0, 0, 0.2)' }
  ])(
    'resolves the floating panel shadow through the palette contract ($paletteId)',
    async ({ paletteId, expected }) => {
      await useColorPaletteService().loadColorPalette(paletteId)

      expect(
        document.documentElement.style.getPropertyValue(
          '--interface-floating-panel-shadow'
        )
      ).toBe(expected)
    }
  )
})
