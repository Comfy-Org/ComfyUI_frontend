import { describe, expect, it } from 'vitest'

import { LAYER_MODES, defaultMode, resolveMode } from '../mode'
import {
  BLEND_CODE,
  COMPOSITE_CODE,
  SPACE_CODE,
  modeUniforms
} from './modeCodes'

describe('mode codes', () => {
  it('assigns a code to every blend mode in the table', () => {
    for (const blend of Object.keys(LAYER_MODES)) {
      expect(BLEND_CODE[blend as keyof typeof BLEND_CODE]).toBeTypeOf('number')
    }
  })

  it('blend codes are unique', () => {
    const codes = Object.values(BLEND_CODE)
    expect(new Set(codes).size).toBe(codes.length)
  })

  it('composite and space codes are unique', () => {
    expect(new Set(Object.values(COMPOSITE_CODE)).size).toBe(
      Object.keys(COMPOSITE_CODE).length
    )
    expect(new Set(Object.values(SPACE_CODE)).size).toBe(
      Object.keys(SPACE_CODE).length
    )
  })

  it('modeUniforms encodes an effective mode as shader codes', () => {
    expect(modeUniforms(resolveMode(defaultMode('multiply')))).toEqual({
      blend: BLEND_CODE.multiply,
      composite: COMPOSITE_CODE['clip-to-backdrop'],
      blendSpace: SPACE_CODE.linear,
      compositeSpace: SPACE_CODE.linear,
      legacy: false
    })
    expect(
      modeUniforms(resolveMode({ ...defaultMode('screen'), legacy: true }))
    ).toMatchObject({
      blend: BLEND_CODE.screen,
      blendSpace: SPACE_CODE.perceptual,
      compositeSpace: SPACE_CODE.perceptual,
      legacy: true
    })
  })
})
