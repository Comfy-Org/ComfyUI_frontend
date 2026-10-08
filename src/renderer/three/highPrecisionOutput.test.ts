import * as THREE from 'three'
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader'
import { describe, expect, it } from 'vitest'

import {
  createHighPrecisionTarget,
  createRegionFxaaFragmentShader,
  ensureTargetSize
} from './highPrecisionOutput'

describe('createRegionFxaaFragmentShader', () => {
  it('clamps every FXAA sample to the view region of the shared target', () => {
    const shader = createRegionFxaaFragmentShader()

    expect(shader).toContain('uniform vec2 uvScale;')
    expect(shader).toContain(
      'texture( tex2D, clamp( uv, 0.5 * resolution, uvScale - 0.5 * resolution ) )'
    )
    expect(shader).not.toContain('return texture( tex2D, uv );')
    expect(shader).not.toBe(FXAAShader.fragmentShader)
  })
})

describe('createHighPrecisionTarget', () => {
  it('stores half floats and is treated as a final output by three and Spark', () => {
    const target = createHighPrecisionTarget(64, 32)

    expect(target.texture.type).toBe(THREE.HalfFloatType)
    expect([target.width, target.height]).toEqual([64, 32])
    expect(target.samples).toBe(0)
    expect(target).toHaveProperty('isXRRenderTarget', true)
  })
})

describe('ensureTargetSize', () => {
  it('grows each axis independently and never shrinks', () => {
    const target = createHighPrecisionTarget(300, 300)

    ensureTargetSize(target, 500, 200)
    expect([target.width, target.height]).toEqual([500, 300])

    ensureTargetSize(target, 400, 250)
    expect([target.width, target.height]).toEqual([500, 300])
  })
})
