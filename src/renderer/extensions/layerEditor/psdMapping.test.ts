import { describe, expect, it } from 'vitest'

import { LAYER_MODES } from './engine/mode'
import type { BlendFn } from './engine/mode'
import {
  PSD_BLEND_MODES,
  fillToVectorContent,
  hexToPsdColor
} from './psdMapping'

describe('blend mode mapping', () => {
  it('maps every engine blend mode to a psd mode', () => {
    for (const blend of Object.keys(LAYER_MODES) as BlendFn[]) {
      expect(PSD_BLEND_MODES[blend]).toBeTruthy()
    }
  })
})

describe('colors', () => {
  it('converts hex colors including shorthand', () => {
    expect(hexToPsdColor('#3b82f6')).toEqual({ r: 59, g: 130, b: 246 })
    expect(hexToPsdColor('#fff')).toEqual({ r: 255, g: 255, b: 255 })
    expect(hexToPsdColor('#12')).toEqual({ r: 18, g: 0, b: 0 })
  })
})

describe('fill mapping', () => {
  it('maps solid fills to color content', () => {
    expect(fillToVectorContent({ type: 'solid', color: '#ff8800' })).toEqual({
      type: 'color',
      color: { r: 255, g: 136, b: 0 }
    })
  })

  it('maps linear gradients with mirrored angle and stops', () => {
    const content = fillToVectorContent({
      type: 'linear',
      angle: 45,
      stops: [
        { offset: 0, color: '#000000' },
        { offset: 1, color: '#ffffff', alpha: 0.5 }
      ]
    })
    expect(content).toMatchObject({
      type: 'solid',
      style: 'linear',
      angle: -45,
      colorStops: [
        { color: { r: 0, g: 0, b: 0 }, location: 0 },
        { color: { r: 255, g: 255, b: 255 }, location: 1 }
      ],
      opacityStops: [
        { opacity: 1, location: 0 },
        { opacity: 0.5, location: 1 }
      ]
    })
  })

  it('maps radial gradients with center offset and scale', () => {
    const content = fillToVectorContent({
      type: 'radial',
      cx: 0.25,
      cy: 0.75,
      radius: 1.5,
      stops: [
        { offset: 0, color: '#112233' },
        { offset: 1, color: '#445566' }
      ]
    })
    expect(content).toMatchObject({
      type: 'solid',
      style: 'radial',
      scale: 150,
      offset: { x: -0.25, y: 0.25 }
    })
  })
})
