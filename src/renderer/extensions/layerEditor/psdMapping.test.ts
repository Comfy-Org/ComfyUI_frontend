import { describe, expect, it } from 'vitest'

import { LAYER_MODES } from './engine/mode'
import type { BlendFn } from './engine/mode'
import { rectPath } from './engine/vector'
import {
  PSD_BLEND_MODES,
  adjustmentFromPsd,
  adjustmentToPsd,
  alignFromPsd,
  alignToPsd,
  bezierPathsToPath,
  blendFromPsd,
  curveStringToPsd,
  fillToVectorContent,
  hexToPsdColor,
  pathToBezierPaths,
  psdColorToHex,
  psdCurveToString,
  vectorContentToFill
} from './psdMapping'

describe('blend mode mapping', () => {
  it('maps every engine blend mode to a psd mode', () => {
    for (const blend of Object.keys(LAYER_MODES) as BlendFn[]) {
      expect(PSD_BLEND_MODES[blend]).toBeTruthy()
    }
  })

  it('round-trips all engine modes that exist in PSD', () => {
    const noPsdEquivalent = new Set<BlendFn>(['grain-extract', 'grain-merge'])
    for (const blend of Object.keys(LAYER_MODES) as BlendFn[]) {
      if (noPsdEquivalent.has(blend)) continue
      expect(blendFromPsd(PSD_BLEND_MODES[blend])).toBe(blend)
    }
  })

  it('falls back for psd-only modes', () => {
    expect(blendFromPsd('dissolve')).toBe('normal')
    expect(blendFromPsd('darker color')).toBe('darken')
    expect(blendFromPsd('linear light')).toBe('linear-light')
    expect(blendFromPsd('subtraction')).toBe('subtract')
    expect(blendFromPsd(undefined)).toBe('normal')
    expect(blendFromPsd('bogus')).toBe('normal')
  })
})

describe('colors', () => {
  it('round-trips hex colors', () => {
    expect(psdColorToHex(hexToPsdColor('#3b82f6'))).toBe('#3b82f6')
    expect(hexToPsdColor('#fff')).toEqual({ r: 255, g: 255, b: 255 })
    expect(psdColorToHex(undefined)).toBe('#000000')
  })
})

describe('curves', () => {
  it('converts curve strings to psd points and back', () => {
    const psd = curveStringToPsd('[[0,0],[0.5,0.25],[1,1]]')
    expect(psd).toEqual([
      { input: 0, output: 0 },
      { input: 128, output: 64 },
      { input: 255, output: 255 }
    ])
    const str = psdCurveToString(psd)
    const again = curveStringToPsd(str)
    expect(again).toEqual(psd)
  })

  it('rejects junk', () => {
    expect(curveStringToPsd('')).toBeUndefined()
    expect(curveStringToPsd('not json')).toBeUndefined()
    expect(curveStringToPsd('[[0,0]]')).toBeUndefined()
    expect(psdCurveToString(undefined)).toBe('')
  })
})

describe('adjustment mapping', () => {
  it('round-trips brightness-contrast', () => {
    const psd = adjustmentToPsd({
      op: 'brightness-contrast',
      params: { brightness: 0.5, contrast: -0.4 }
    })!
    expect(psd).toMatchObject({
      type: 'brightness/contrast',
      brightness: 75,
      contrast: -20
    })
    const back = adjustmentFromPsd(psd)!
    expect(back.op).toBe('brightness-contrast')
    expect(back.params.brightness).toBeCloseTo(0.5, 2)
    expect(back.params.contrast).toBeCloseTo(-0.4, 2)
  })

  it('round-trips hue-saturation', () => {
    const psd = adjustmentToPsd({
      op: 'hue-saturation',
      params: { hue: 90, saturation: -0.5, lightness: 0.2 }
    })!
    const back = adjustmentFromPsd(psd)!
    expect(back.params).toMatchObject({
      hue: 90,
      saturation: -0.5,
      lightness: 0.2
    })
  })

  it('round-trips levels', () => {
    const psd = adjustmentToPsd({
      op: 'levels',
      params: {
        inBlack: 0.1,
        inWhite: 0.9,
        gamma: 2.2,
        outBlack: 0.05,
        outWhite: 0.95
      }
    })!
    const back = adjustmentFromPsd(psd)!
    expect(back.params.inBlack).toBeCloseTo(0.1, 2)
    expect(back.params.inWhite).toBeCloseTo(0.9, 2)
    expect(back.params.gamma).toBeCloseTo(2.2, 2)
    expect(back.params.outBlack).toBeCloseTo(0.05, 2)
    expect(back.params.outWhite).toBeCloseTo(0.95, 2)
  })

  it('round-trips curves via channel strings', () => {
    const psd = adjustmentToPsd({
      op: 'curves',
      params: {},
      curves: { master: '[[0,0],[1,1]]', red: '[[0,0.1],[1,0.9]]' }
    })!
    const back = adjustmentFromPsd(psd)!
    expect(back.op).toBe('curves')
    expect(curveStringToPsd(back.curves!.master)).toEqual(
      curveStringToPsd('[[0,0],[1,1]]')
    )
    expect(curveStringToPsd(back.curves!.red)).toEqual(
      curveStringToPsd('[[0,0.1],[1,0.9]]')
    )
  })

  it('round-trips exposure, color-balance, vibrance, posterize, threshold, invert', () => {
    for (const [op, params] of [
      ['exposure', { exposure: 1.5, black: 0.05 }],
      ['color-balance', { shadowsR: 0.3, midtonesG: -0.2, highlightsB: 1 }],
      ['vibrance', { amount: 1 }],
      ['posterize', { levels: 6 }],
      ['threshold', { level: 0.25 }],
      ['invert', {}]
    ] as const) {
      const psd = adjustmentToPsd({ op, params: { ...params } })!
      expect(psd).toBeTruthy()
      const back = adjustmentFromPsd(psd)!
      expect(back.op).toBe(op)
      for (const [k, v] of Object.entries(params)) {
        expect(back.params[k]).toBeCloseTo(v, 1)
      }
    }
  })

  it('maps temperature to photo filter and back approximately', () => {
    const warm = adjustmentToPsd({
      op: 'temperature',
      params: { temperature: 4000, mix: 1 }
    })!
    expect(warm).toMatchObject({ type: 'photo filter' })
    const backWarm = adjustmentFromPsd(warm)!
    expect(backWarm.op).toBe('temperature')
    expect(backWarm.params.temperature).toBeLessThan(6500)

    const cool = adjustmentToPsd({
      op: 'temperature',
      params: { temperature: 9000, mix: 1 }
    })!
    const backCool = adjustmentFromPsd(cool)!
    expect(backCool.params.temperature).toBeGreaterThan(6500)
  })

  it('returns null for unsupported psd adjustments', () => {
    expect(adjustmentFromPsd({ type: 'black & white' })).toBeNull()
    expect(
      adjustmentToPsd({ op: 'bogus' as never, params: {} })
    ).toBeUndefined()
  })
})

describe('fill mapping', () => {
  it('round-trips solid fills', () => {
    const content = fillToVectorContent({ type: 'solid', color: '#ff8800' })
    expect(content).toEqual({ type: 'color', color: { r: 255, g: 136, b: 0 } })
    expect(vectorContentToFill(content)).toEqual({
      type: 'solid',
      color: '#ff8800'
    })
  })

  it('round-trips linear gradients', () => {
    const spec = {
      type: 'linear' as const,
      angle: 45,
      stops: [
        { offset: 0, color: '#000000' },
        { offset: 1, color: '#ffffff', alpha: 0.5 }
      ]
    }
    const content = fillToVectorContent(spec)
    expect(content).toMatchObject({
      type: 'solid',
      style: 'linear',
      angle: -45
    })
    const back = vectorContentToFill(content)!
    expect(back.type).toBe('linear')
    if (back.type === 'linear') {
      expect(back.angle).toBe(45)
      expect(back.stops[0]).toMatchObject({ offset: 0, color: '#000000' })
      expect(back.stops[1]).toMatchObject({
        offset: 1,
        color: '#ffffff',
        alpha: 0.5
      })
    }
  })

  it('round-trips radial gradients', () => {
    const spec = {
      type: 'radial' as const,
      cx: 0.25,
      cy: 0.75,
      radius: 1.5,
      stops: [
        { offset: 0, color: '#112233' },
        { offset: 1, color: '#445566' }
      ]
    }
    const back = vectorContentToFill(fillToVectorContent(spec))!
    expect(back.type).toBe('radial')
    if (back.type === 'radial') {
      expect(back.cx).toBeCloseTo(0.25, 4)
      expect(back.cy).toBeCloseTo(0.75, 4)
      expect(back.radius).toBeCloseTo(1.5, 4)
    }
  })

  it('rejects unsupported content', () => {
    expect(vectorContentToFill(undefined)).toBeNull()
    expect(
      vectorContentToFill({
        type: 'noise',
        name: 'n',
        roughness: 1,
        min: [],
        max: []
      } as never)
    ).toBeNull()
  })
})

describe('path mapping', () => {
  it('round-trips a rect path', () => {
    const path = rectPath(10, 20, 100, 50)
    const psd = pathToBezierPaths(path, 'non-zero')
    expect(psd).toHaveLength(1)
    expect(psd[0].open).toBe(false)
    expect(psd[0].knots).toHaveLength(4)
    expect(psd[0].knots[0].points).toEqual([10, 20, 10, 20, 10, 20])

    const back = bezierPathsToPath(psd)
    expect(back.strokes).toHaveLength(1)
    expect(back.strokes[0].closed).toBe(true)
    expect(back.strokes[0].anchors.map((a) => a.pos)).toEqual(
      path.strokes[0].anchors.map((a) => a.pos)
    )
    expect(back.strokes[0].anchors.map((a) => a.type)).toEqual(
      path.strokes[0].anchors.map((a) => a.type)
    )
  })

  it('applies point mappers on export', () => {
    const path = rectPath(0, 0, 10, 10)
    const psd = pathToBezierPaths(path, 'even-odd', (pt) => ({
      x: pt.x + 5,
      y: pt.y + 7
    }))
    expect(psd[0].fillRule).toBe('even-odd')
    expect(psd[0].knots[0].points).toEqual([5, 7, 5, 7, 5, 7])
  })

  it('skips malformed knots on import', () => {
    const back = bezierPathsToPath([
      {
        open: true,
        knots: [{ linked: true, points: [1, 2] }],
        fillRule: 'non-zero'
      }
    ])
    expect(back.strokes).toHaveLength(0)
  })
})

describe('alignment', () => {
  it('maps both directions', () => {
    expect(alignToPsd('center')).toBe('center')
    expect(alignFromPsd('justify-right')).toBe('right')
    expect(alignFromPsd(undefined)).toBe('left')
  })
})
