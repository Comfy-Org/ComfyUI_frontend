import { describe, expect, it } from 'vitest'

import {
  LAYER_FX_DEFS,
  LAYER_FX_OPS,
  blurBoxRadii,
  createLayerFx,
  defaultFxParams,
  fxStamp,
  gaussianIsNoop,
  normalizeLayerFx
} from './layerFx'

describe('createLayerFx / defaultFxParams', () => {
  it('creates an enabled effect with every param at its default', () => {
    const fx = createLayerFx('drop-shadow')
    expect(fx.enabled).toBe(true)
    expect(fx.opacity).toBe(1)
    expect(fx.params).toEqual({
      x: 8,
      y: 8,
      stdDev: 6,
      shadowOpacity: 0.6,
      color: 0
    })
  })

  it('every op has param defs and generates unique ids', () => {
    for (const op of LAYER_FX_OPS) {
      expect(LAYER_FX_DEFS[op].length).toBeGreaterThan(0)
      expect(Object.keys(defaultFxParams(op))).toEqual(
        LAYER_FX_DEFS[op].map((d) => d.key)
      )
    }
    expect(createLayerFx('noise').id).not.toBe(createLayerFx('noise').id)
  })
})

describe('normalizeLayerFx', () => {
  it('returns undefined for non-arrays and empty results', () => {
    expect(normalizeLayerFx(undefined)).toBeUndefined()
    expect(normalizeLayerFx('junk')).toBeUndefined()
    expect(normalizeLayerFx([])).toBeUndefined()
    expect(normalizeLayerFx([{ op: 'unknown-op' }])).toBeUndefined()
  })

  it('fills missing params with defaults and keeps valid overrides', () => {
    const [fx] = normalizeLayerFx([
      {
        id: 'fx1',
        op: 'gaussian-blur',
        params: { stdDev: 10, bogus: 5, nan: NaN }
      }
    ])!
    expect(fx).toMatchObject({
      id: 'fx1',
      op: 'gaussian-blur',
      enabled: true,
      opacity: 1
    })
    expect(fx.params).toEqual({ stdDev: 10 })
  })

  it('clamps opacity and respects enabled=false', () => {
    const [fx] = normalizeLayerFx([
      { op: 'noise', enabled: false, opacity: 7 }
    ])!
    expect(fx.enabled).toBe(false)
    expect(fx.opacity).toBe(1)
    const [dim] = normalizeLayerFx([{ op: 'noise', opacity: -2 }])!
    expect(dim.opacity).toBe(0)
  })
})

describe('fxStamp', () => {
  it('is stable across param key order and changes with values', () => {
    const a = fxStamp([
      {
        id: '1',
        op: 'noise',
        params: { a: 1, b: 2 },
        enabled: true,
        opacity: 1
      }
    ])
    const b = fxStamp([
      {
        id: '2',
        op: 'noise',
        params: { b: 2, a: 1 },
        enabled: true,
        opacity: 1
      }
    ])
    expect(a).toBe(b)
    const c = fxStamp([
      {
        id: '1',
        op: 'noise',
        params: { a: 1, b: 3 },
        enabled: true,
        opacity: 1
      }
    ])
    expect(c).not.toBe(a)
  })

  it('encodes enabled state and joins chains', () => {
    const chain = fxStamp([
      { id: '1', op: 'noise', params: {}, enabled: false, opacity: 0.5 },
      { id: '2', op: 'emboss', params: {}, enabled: true, opacity: 1 }
    ])
    expect(chain).toBe('noise:0:0.5:;emboss:1:1:')
  })
})

describe('gaussian box-blur approximation', () => {
  it('tiny sigmas are no-ops', () => {
    expect(gaussianIsNoop(0)).toBe(true)
    expect(gaussianIsNoop(-1)).toBe(true)
    expect(gaussianIsNoop(0.3)).toBe(true)
    expect(gaussianIsNoop(4)).toBe(false)
  })

  it('produces three box radii that grow with sigma', () => {
    const small = blurBoxRadii(2)
    const large = blurBoxRadii(10)
    expect(small.length).toBeGreaterThan(0)
    expect(small.length).toBeLessThanOrEqual(3)
    expect(Math.max(...large)).toBeGreaterThan(Math.max(...small))
  })
})
