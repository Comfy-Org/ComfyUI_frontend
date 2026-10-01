import { describe, expect, it } from 'vitest'

import { DEFAULT_SCENE, newLight } from './lights'
import { previewGlows, previewShade } from './preview'

describe('previewGlows', () => {
  it('draws a glow for each visible light at its place, in its color', () => {
    const shown = { ...newLight('a', 'A', 0), color: 'warm' as const }
    const hidden = { ...newLight('b', 'B', 1), visible: false }

    const glows = previewGlows([shown, hidden])

    expect(glows.map(({ id }) => id)).toEqual(['a'])
    expect(glows[0].style.backgroundImage).toContain('at 50% 20%')
    expect(glows[0].style.backgroundImage).toContain('#ffb35c')
    expect(glows[0].style.opacity).toBeCloseTo(shown.brightness / 100)
  })

  it('spreads a softer light further', () => {
    const light = newLight('a', 'A', 0)
    const reach = (softness: number) =>
      previewGlows([{ ...light, softness }])[0].style.backgroundImage
    expect(reach(0)).toContain('ellipse 22% 22%')
    expect(reach(100)).toContain('ellipse 72% 72%')
  })
})

describe('previewShade', () => {
  it.for([
    {
      name: 'darkens as the original lighting is removed',
      scene: { removeOriginal: 100, ambient: 0 },
      shade: 0.67
    },
    {
      name: 'lifts with ambient light',
      scene: { removeOriginal: 0, ambient: 100 },
      shade: 0
    },
    {
      name: 'lightens when shadows are off',
      scene: { removeOriginal: 100, ambient: 0, shadows: false },
      shade: 0.55
    }
  ])('$name', ({ scene, shade }) => {
    expect(previewShade({ ...DEFAULT_SCENE, ...scene })).toBeCloseTo(shade)
  })
})
