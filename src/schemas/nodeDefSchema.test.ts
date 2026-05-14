import { describe, expect, it } from 'vitest'

import type {
  ComboInputSpec,
  ComboInputSpecV2,
  InputSpec
} from './nodeDefSchema'
import {
  getComboSpecComboOptions,
  getInputSpecType,
  isComboInputSpec,
  isComboInputSpecV1,
  isComboInputSpecV2,
  isFloatInputSpec,
  isIntInputSpec,
  isMediaUploadComboInput,
  validateComfyNodeDef
} from './nodeDefSchema'

describe('nodeDefSchema', () => {
  describe('isComboInputSpecV1', () => {
    it('returns true for legacy combo spec with array', () => {
      const spec: InputSpec = [['option1', 'option2'], {}]
      expect(isComboInputSpecV1(spec)).toBe(true)
    })

    it('returns false for v2 combo spec', () => {
      const spec: InputSpec = ['COMBO', { options: ['a', 'b'] }]
      expect(isComboInputSpecV1(spec)).toBe(false)
    })

    it('returns false for INT spec', () => {
      const spec: InputSpec = ['INT', {}]
      expect(isComboInputSpecV1(spec)).toBe(false)
    })
  })

  describe('isIntInputSpec', () => {
    it('returns true for INT spec', () => {
      const spec: InputSpec = ['INT', { min: 0, max: 100 }]
      expect(isIntInputSpec(spec)).toBe(true)
    })

    it('returns false for FLOAT spec', () => {
      const spec: InputSpec = ['FLOAT', {}]
      expect(isIntInputSpec(spec)).toBe(false)
    })
  })

  describe('isFloatInputSpec', () => {
    it('returns true for FLOAT spec', () => {
      const spec: InputSpec = ['FLOAT', { min: 0.0, max: 1.0 }]
      expect(isFloatInputSpec(spec)).toBe(true)
    })

    it('returns false for INT spec', () => {
      const spec: InputSpec = ['INT', {}]
      expect(isFloatInputSpec(spec)).toBe(false)
    })
  })

  describe('isComboInputSpecV2', () => {
    it('returns true for COMBO spec', () => {
      const spec: InputSpec = ['COMBO', { options: ['a', 'b'] }]
      expect(isComboInputSpecV2(spec)).toBe(true)
    })

    it('returns false for legacy combo spec', () => {
      const spec: InputSpec = [['a', 'b'], {}]
      expect(isComboInputSpecV2(spec)).toBe(false)
    })
  })

  describe('isComboInputSpec', () => {
    it('returns true for v1 combo spec', () => {
      const spec: InputSpec = [['option1', 'option2'], {}]
      expect(isComboInputSpec(spec)).toBe(true)
    })

    it('returns true for v2 combo spec', () => {
      const spec: InputSpec = ['COMBO', { options: ['a', 'b'] }]
      expect(isComboInputSpec(spec)).toBe(true)
    })

    it('returns false for INT spec', () => {
      const spec: InputSpec = ['INT', {}]
      expect(isComboInputSpec(spec)).toBe(false)
    })
  })

  describe('isMediaUploadComboInput', () => {
    it('returns true for image_upload combo v1', () => {
      const spec: InputSpec = [['img1.png', 'img2.png'], { image_upload: true }]
      expect(isMediaUploadComboInput(spec)).toBe(true)
    })

    it('returns true for video_upload combo v2', () => {
      const spec: InputSpec = ['COMBO', { video_upload: true }]
      expect(isMediaUploadComboInput(spec)).toBe(true)
    })

    it('returns true for animated_image_upload combo', () => {
      const spec: InputSpec = [['gif1.gif'], { animated_image_upload: true }]
      expect(isMediaUploadComboInput(spec)).toBe(true)
    })

    it('returns false when options is undefined', () => {
      const spec: InputSpec = ['COMBO', undefined]
      expect(isMediaUploadComboInput(spec)).toBe(false)
    })

    it('returns false for non-upload combo', () => {
      const spec: InputSpec = ['COMBO', { options: ['a', 'b'] }]
      expect(isMediaUploadComboInput(spec)).toBe(false)
    })

    it('returns false for INT with upload flag', () => {
      const spec: InputSpec = ['INT', { image_upload: true } as never]
      expect(isMediaUploadComboInput(spec)).toBe(false)
    })
  })

  describe('getInputSpecType', () => {
    it('returns COMBO for v1 combo spec', () => {
      const spec: InputSpec = [['a', 'b'], {}]
      expect(getInputSpecType(spec)).toBe('COMBO')
    })

    it('returns COMBO for v2 combo spec', () => {
      const spec: InputSpec = ['COMBO', {}]
      expect(getInputSpecType(spec)).toBe('COMBO')
    })

    it('returns INT for INT spec', () => {
      const spec: InputSpec = ['INT', {}]
      expect(getInputSpecType(spec)).toBe('INT')
    })

    it('returns FLOAT for FLOAT spec', () => {
      const spec: InputSpec = ['FLOAT', {}]
      expect(getInputSpecType(spec)).toBe('FLOAT')
    })

    it('returns custom type for custom spec', () => {
      const spec: InputSpec = ['CUSTOM_TYPE', {}]
      expect(getInputSpecType(spec)).toBe('CUSTOM_TYPE')
    })
  })

  describe('getComboSpecComboOptions', () => {
    it('returns options from v1 combo spec', () => {
      const spec: ComboInputSpec = [['opt1', 'opt2', 123], {}]
      expect(getComboSpecComboOptions(spec)).toEqual(['opt1', 'opt2', 123])
    })

    it('returns options from v2 combo spec', () => {
      const spec: ComboInputSpecV2 = ['COMBO', { options: ['a', 'b', 'c'] }]
      expect(getComboSpecComboOptions(spec)).toEqual(['a', 'b', 'c'])
    })

    it('returns empty array when v2 has no options', () => {
      const spec: ComboInputSpecV2 = ['COMBO', {}]
      expect(getComboSpecComboOptions(spec)).toEqual([])
    })

    it('returns empty array when v2 options is undefined', () => {
      const spec: ComboInputSpecV2 = ['COMBO', undefined]
      expect(getComboSpecComboOptions(spec)).toEqual([])
    })
  })

  describe('validateComfyNodeDef', () => {
    const validNodeDef = {
      name: 'TestNode',
      display_name: 'Test Node',
      description: 'A test node',
      category: 'test',
      output_node: false,
      python_module: 'test_module'
    }

    it('returns validated node def for valid input', () => {
      const result = validateComfyNodeDef(validNodeDef)
      expect(result).toEqual(validNodeDef)
    })

    it('returns node def with optional fields', () => {
      const nodeWithOptional = {
        ...validNodeDef,
        deprecated: true,
        experimental: true,
        api_node: true,
        help: 'Some help text'
      }
      const result = validateComfyNodeDef(nodeWithOptional)
      expect(result).toEqual(nodeWithOptional)
    })

    it('returns null and calls onError for invalid input', () => {
      const onError = vi.fn()
      const invalidDef = { name: 'Test' }
      const result = validateComfyNodeDef(invalidDef, onError)
      expect(result).toBeNull()
      expect(onError).toHaveBeenCalled()
    })

    it('uses console.warn as default error handler', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const invalidDef = { name: 'Test' }
      validateComfyNodeDef(invalidDef)
      expect(warnSpy).toHaveBeenCalled()
      warnSpy.mockRestore()
    })

    it('validates input specs correctly', () => {
      const nodeWithInputs = {
        ...validNodeDef,
        input: {
          required: {
            seed: ['INT', { min: 0, max: 1000 }],
            prompt: ['STRING', { multiline: true }]
          },
          optional: {
            model: ['COMBO', { options: ['model1', 'model2'] }]
          }
        }
      }
      const result = validateComfyNodeDef(nodeWithInputs)
      expect(result).not.toBeNull()
      expect(result?.input?.required?.seed).toEqual([
        'INT',
        { min: 0, max: 1000 }
      ])
    })

    it('validates output specs correctly', () => {
      const nodeWithOutputs = {
        ...validNodeDef,
        output: ['IMAGE', 'MASK'],
        output_name: ['image', 'mask'],
        output_is_list: [false, false]
      }
      const result = validateComfyNodeDef(nodeWithOutputs)
      expect(result).not.toBeNull()
      expect(result?.output).toEqual(['IMAGE', 'MASK'])
    })

    it('validates price_badge correctly', () => {
      const nodeWithPriceBadge = {
        ...validNodeDef,
        api_node: true,
        price_badge: {
          engine: 'jsonata',
          depends_on: {
            widgets: [{ name: 'width', type: 'INT' }],
            inputs: ['image']
          },
          expr: '$round(w.width * 0.001, 4)'
        }
      }
      const result = validateComfyNodeDef(nodeWithPriceBadge)
      expect(result).not.toBeNull()
      expect(result?.price_badge?.expr).toBe('$round(w.width * 0.001, 4)')
    })
  })
})
