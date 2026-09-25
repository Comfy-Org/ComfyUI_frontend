import { describe, expect, it } from 'vitest'
import { defaultCreativeSettings } from './creative'
import { applyCreativePresetPart } from './creative-presets'

describe('separate creative presets', () => {
  it('loads only palette colors/main priority or lights without changing the other creative choices', () => {
    const current = {
      ...defaultCreativeSettings(),
      genre: 'noir' as const,
      palette: ['#ffffff'],
      paletteMain: 0,
      lights: [
        {
          position: 'front' as const,
          color: '#ffffff',
          brightness: 60,
          diffusion: 60
        }
      ]
    }
    const saved = {
      ...defaultCreativeSettings(),
      palette: ['#ff0000', '#0000ff'],
      paletteMain: 1,
      lights: [
        {
          position: 'back' as const,
          color: '#ff0000',
          brightness: 80,
          diffusion: 40
        }
      ]
    }
    const palette = applyCreativePresetPart(current, saved, 'palette')
    expect(palette).toEqual({
      ...current,
      palette: saved.palette,
      paletteMain: 1
    })
    const lighting = applyCreativePresetPart(current, saved, 'lighting')
    expect(lighting).toEqual({ ...current, lights: saved.lights })
    palette.palette[0] = '#000000'
    lighting.lights[0].brightness = 10
    expect(saved.palette[0]).toBe('#ff0000')
    expect(saved.lights[0].brightness).toBe(80)
    expect(current.lights[0].brightness).toBe(60)
  })
})
