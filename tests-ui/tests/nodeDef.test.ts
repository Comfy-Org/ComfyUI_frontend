import { plainToClass } from 'class-transformer'
import {
  ComfyInputsSpec,
  IntInputSpec,
  StringInputSpec,
  BooleanInputSpec,
  FloatInputSpec,
  CustomInputSpec,
  ComboInputSpec
} from '@/stores/nodeDefStore' // Adjust the import path as needed

describe('ComfyInputsSpec', () => {
  it('should transform a plain object to ComfyInputsSpec instance', () => {
    const plainObject = {
      required: {
        intInput: ['INT', { min: 0, max: 100, default: 50 }],
        stringInput: ['STRING', { default: 'Hello', multiline: true }]
      },
      optional: {
        booleanInput: [
          'BOOLEAN',
          { default: true, labelOn: 'Yes', labelOff: 'No' }
        ],
        floatInput: ['FLOAT', { min: 0, max: 1, step: 0.1 }]
      },
      hidden: {
        someHiddenValue: 42
      }
    }

    const result = plainToClass(ComfyInputsSpec, plainObject)

    expect(result).toBeInstanceOf(ComfyInputsSpec)
    expect(result.required).toBeDefined()
    expect(result.optional).toBeDefined()
    expect(result.hidden).toBeDefined()
  })

  it('should correctly transform required input specs', () => {
    const plainObject = {
      required: {
        intInput: ['INT', { min: 0, max: 100, default: 50 }],
        stringInput: ['STRING', { default: 'Hello', multiline: true }]
      }
    }

    const result = plainToClass(ComfyInputsSpec, plainObject)

    expect(result.required?.intInput).toBeInstanceOf(IntInputSpec)
    expect(result.required?.stringInput).toBeInstanceOf(StringInputSpec)

    const intInput = result.required?.intInput as IntInputSpec
    const stringInput = result.required?.stringInput as StringInputSpec

    expect(intInput.min).toBe(0)
    expect(intInput.max).toBe(100)
    expect(intInput.default).toBe(50)
    expect(stringInput.default).toBe('Hello')
    expect(stringInput.multiline).toBe(true)
  })

  it('should correctly transform optional input specs', () => {
    const plainObject = {
      optional: {
        booleanInput: [
          'BOOLEAN',
          { default: true, labelOn: 'Yes', labelOff: 'No' }
        ],
        floatInput: ['FLOAT', { min: 0, max: 1, step: 0.1 }]
      }
    }

    const result = plainToClass(ComfyInputsSpec, plainObject)

    expect(result.optional?.booleanInput).toBeInstanceOf(BooleanInputSpec)
    expect(result.optional?.floatInput).toBeInstanceOf(FloatInputSpec)

    const booleanInput = result.optional?.booleanInput as BooleanInputSpec
    const floatInput = result.optional?.floatInput as FloatInputSpec

    expect(booleanInput.default).toBe(true)
    expect(booleanInput.labelOn).toBe('Yes')
    expect(booleanInput.labelOff).toBe('No')
    expect(floatInput.min).toBe(0)
    expect(floatInput.max).toBe(1)
    expect(floatInput.step).toBe(0.1)
  })

  it('should handle custom input specs', () => {
    const plainObject = {
      optional: {
        comboInput: [[1, 2, 3], { default: 2 }]
      }
    }

    const result = plainToClass(ComfyInputsSpec, plainObject)

    expect(result.optional?.comboInput).toBeInstanceOf(ComboInputSpec)
    expect(result.optional?.comboInput.type).toBe('COMBO')
    expect(result.optional?.comboInput.default).toBe(2)
  })

  it('should handle custom input specs', () => {
    const plainObject = {
      optional: {
        customInput: ['CUSTOM_TYPE', { default: 'custom value' }]
      }
    }

    const result = plainToClass(ComfyInputsSpec, plainObject)

    expect(result.optional?.customInput).toBeInstanceOf(CustomInputSpec)
    expect(result.optional?.customInput.type).toBe('CUSTOM_TYPE')
    expect(result.optional?.customInput.default).toBe('custom value')
  })

  it('should not transform hidden fields', () => {
    const plainObject = {
      hidden: {
        someHiddenValue: 42,
        anotherHiddenValue: { nested: 'object' }
      }
    }

    const result = plainToClass(ComfyInputsSpec, plainObject)

    expect(result.hidden).toEqual(plainObject.hidden)
    expect(result.hidden?.someHiddenValue).toBe(42)
    expect(result.hidden?.anotherHiddenValue).toEqual({ nested: 'object' })
  })

  it('should handle empty or undefined fields', () => {
    const plainObject = {}

    const result = plainToClass(ComfyInputsSpec, plainObject)

    expect(result).toBeInstanceOf(ComfyInputsSpec)
    expect(result.required).toBeUndefined()
    expect(result.optional).toBeUndefined()
    expect(result.hidden).toBeUndefined()
  })
})
