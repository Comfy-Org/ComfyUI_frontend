import { describe, expect, it } from 'vitest'

import {
  getComboSpecComboOptions,
  getInputSpecType,
  isComboInputSpec,
  isComboInputSpecV1,
  isComboInputSpecV2,
  isFloatInputSpec,
  isIntInputSpec,
  isMediaUploadComboInput
} from './nodeDefSchema'
import type {
  ComboInputSpec,
  ComboInputSpecV2,
  InputSpec
} from './nodeDefSchema'

describe('node definition schema helpers', () => {
  it('identifies input spec variants', () => {
    const intSpec: InputSpec = ['INT', {}]
    const floatSpec: InputSpec = ['FLOAT', {}]
    const comboV1: ComboInputSpec = [['a', 'b'], {}]
    const comboV2: ComboInputSpecV2 = ['COMBO', { options: ['a', 'b'] }]

    expect(isIntInputSpec(intSpec)).toBe(true)
    expect(isFloatInputSpec(floatSpec)).toBe(true)
    expect(isComboInputSpecV1(comboV1)).toBe(true)
    expect(isComboInputSpecV2(comboV2)).toBe(true)
    expect(isComboInputSpec(comboV1)).toBe(true)
    expect(isComboInputSpec(comboV2)).toBe(true)
    expect(getInputSpecType(comboV1)).toBe('COMBO')
    expect(getInputSpecType(intSpec)).toBe('INT')
  })

  it('reads combo options from legacy and v2 combo specs', () => {
    expect(getComboSpecComboOptions([['a', 1], {}])).toEqual(['a', 1])
    expect(
      getComboSpecComboOptions(['COMBO', { options: ['x', 'y'] }])
    ).toEqual(['x', 'y'])
    expect(getComboSpecComboOptions(['COMBO', {}])).toEqual([])
  })

  it('detects media upload combo inputs', () => {
    expect(isMediaUploadComboInput([['a'], { image_upload: true }])).toBe(true)
    expect(
      isMediaUploadComboInput(['COMBO', { animated_image_upload: true }])
    ).toBe(true)
    expect(isMediaUploadComboInput(['COMBO', { video_upload: true }])).toBe(
      true
    )
    expect(isMediaUploadComboInput(['STRING', { image_upload: true }])).toBe(
      false
    )
    expect(isMediaUploadComboInput(['COMBO'])).toBe(false)
  })
})
