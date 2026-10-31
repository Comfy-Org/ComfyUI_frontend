import { describe, expect, it } from 'vitest'

import {
  transformInputSpecV1ToV2,
  transformInputSpecV2ToV1,
  transformNodeDefV1ToV2
} from '#/migration'
import type { ComfyNodeDef as ComfyNodeDefV1 } from '#/schemas/nodeDefSchema'

describe('NodeDef Migration', () => {
  it('should correctly transform required input specs', () => {
    const plainObject = {
      required: {
        intInput: ['INT', { min: 0, max: 100, default: 50 }],
        stringInput: ['STRING', { default: 'Hello', multiline: true }]
      }
    } as ComfyNodeDefV1['input']

    const nodeDef: ComfyNodeDefV1 = {
      name: 'TestNode',
      display_name: 'Test Node',
      category: 'Testing',
      python_module: 'test_module',
      description: 'A test node',
      input: plainObject,
      output: [],
      output_is_list: [],
      output_name: [],
      output_node: false
    }

    const result = transformNodeDefV1ToV2(nodeDef)

    const intInput = result.inputs['intInput']
    const stringInput = result.inputs['stringInput']

    expect(intInput.min).toBe(0)
    expect(intInput.max).toBe(100)
    expect(intInput.default).toBe(50)
    expect(intInput.name).toBe('intInput')
    expect(intInput.type).toBe('INT')
    expect(stringInput.default).toBe('Hello')
    expect(stringInput.multiline).toBe(true)
    expect(stringInput.name).toBe('stringInput')
    expect(stringInput.type).toBe('STRING')
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
    } as ComfyNodeDefV1['input']

    const nodeDef: ComfyNodeDefV1 = {
      name: 'TestNode',
      display_name: 'Test Node',
      category: 'Testing',
      python_module: 'test_module',
      description: 'A test node',
      input: plainObject,
      output: [],
      output_is_list: [],
      output_name: [],
      output_node: false
    }

    const result = transformNodeDefV1ToV2(nodeDef)

    const booleanInput = result.inputs['booleanInput']
    const floatInput = result.inputs['floatInput']

    expect(booleanInput.default).toBe(true)
    expect(booleanInput.labelOn).toBe('Yes')
    expect(booleanInput.labelOff).toBe('No')
    expect(booleanInput.type).toBe('BOOLEAN')
    expect(booleanInput.isOptional).toBe(true)
    expect(floatInput.min).toBe(0)
    expect(floatInput.max).toBe(1)
    expect(floatInput.step).toBe(0.1)
    expect(floatInput.type).toBe('FLOAT')
    expect(floatInput.isOptional).toBe(true)
  })

  it('should handle combo input specs', () => {
    const plainObject = {
      optional: {
        comboInput: [[1, 2, 3], { default: 2 }]
      }
    } as ComfyNodeDefV1['input']

    const nodeDef: ComfyNodeDefV1 = {
      name: 'TestNode',
      display_name: 'Test Node',
      category: 'Testing',
      python_module: 'test_module',
      description: 'A test node',
      input: plainObject,
      output: [],
      output_is_list: [],
      output_name: [],
      output_node: false
    }

    const result = transformNodeDefV1ToV2(nodeDef)
    expect(result.inputs['comboInput'].type).toBe('COMBO')
    expect(result.inputs['comboInput'].default).toBe(2)
    expect(result.inputs['comboInput'].options).toEqual([1, 2, 3])
  })

  it('should handle combo input specs (auto-default)', () => {
    const plainObject = {
      optional: {
        comboInput: [[1, 2, 3], {}]
      }
    } as ComfyNodeDefV1['input']

    const nodeDef: ComfyNodeDefV1 = {
      name: 'TestNode',
      display_name: 'Test Node',
      category: 'Testing',
      python_module: 'test_module',
      description: 'A test node',
      input: plainObject,
      output: [],
      output_is_list: [],
      output_name: [],
      output_node: false
    }

    const result = transformNodeDefV1ToV2(nodeDef)
    expect(result.inputs['comboInput'].type).toBe('COMBO')
    // Should pick the first choice as default
    expect(result.inputs['comboInput'].options).toEqual([1, 2, 3])
  })

  it('should handle custom input specs', () => {
    const plainObject = {
      optional: {
        customInput: ['CUSTOM_TYPE', { default: 'custom value' }]
      }
    } as ComfyNodeDefV1['input']

    const nodeDef: ComfyNodeDefV1 = {
      name: 'TestNode',
      display_name: 'Test Node',
      category: 'Testing',
      python_module: 'test_module',
      description: 'A test node',
      input: plainObject,
      output: [],
      output_is_list: [],
      output_name: [],
      output_node: false
    }

    const result = transformNodeDefV1ToV2(nodeDef)
    expect(result.inputs['customInput'].type).toBe('CUSTOM_TYPE')
    expect(result.inputs['customInput'].default).toBe('custom value')
  })

  it('should map CHART option type to chartType', () => {
    const plainObject = {
      optional: {
        chartInput: ['CHART', { type: 'bar', data: { labels: [] } }]
      }
    } as ComfyNodeDefV1['input']

    const nodeDef: ComfyNodeDefV1 = {
      name: 'TestNode',
      display_name: 'Test Node',
      category: 'Testing',
      python_module: 'test_module',
      description: 'A test node',
      input: plainObject,
      output: [],
      output_is_list: [],
      output_name: [],
      output_node: false
    }

    const result = transformNodeDefV1ToV2(nodeDef)
    const chartInput = result.inputs['chartInput']
    expect(chartInput.type).toBe('CHART')
    expect(chartInput).toMatchObject({ chartType: 'bar', data: { labels: [] } })
  })

  it('should default a dynamic combo with no supplied options to an empty options array', () => {
    // Synthetic subgraph-blueprint nodedefs (subgraphStore.ts) promote a
    // boundary input's type into a bare [type, undefined] tuple.
    const result = transformInputSpecV1ToV2(
      ['COMFY_DYNAMICCOMBO_V3', undefined],
      { name: 'model' }
    )

    expect(result.type).toBe('COMFY_DYNAMICCOMBO_V3')
    expect(result.options).toEqual([])
  })

  it('should transform an input spec without options', () => {
    const result = transformInputSpecV1ToV2(['PREVIEW_3D'], { name: 'image' })

    expect(result).toEqual({
      type: 'PREVIEW_3D',
      name: 'image',
      isOptional: false
    })
  })

  it('should preserve chartType across a V2 to V1 round trip', () => {
    const inputSpec = transformInputSpecV1ToV2(['CHART', { type: 'bar' }], {
      name: 'chartInput'
    })

    const result = transformInputSpecV1ToV2(
      transformInputSpecV2ToV1(inputSpec),
      { name: 'chartInput' }
    )

    expect(result.chartType).toBe('bar')
  })

  it('should not transform hidden fields', () => {
    const plainObject: NonNullable<ComfyNodeDefV1['input']> = {
      hidden: {
        someHiddenValue: 42,
        anotherHiddenValue: { nested: 'object' }
      }
    }

    const nodeDef: ComfyNodeDefV1 = {
      name: 'TestNode',
      display_name: 'Test Node',
      category: 'Testing',
      python_module: 'test_module',
      description: 'A test node',
      input: plainObject,
      output: [],
      output_is_list: [],
      output_name: [],
      output_node: false
    }

    const result = transformNodeDefV1ToV2(nodeDef)

    expect(result.hidden).toEqual(plainObject.hidden)
    expect(result.hidden?.someHiddenValue).toBe(42)
    expect(result.hidden?.anotherHiddenValue).toEqual({ nested: 'object' })
  })

  it('should handle empty or undefined fields', () => {
    const plainObject = {}

    const nodeDef: ComfyNodeDefV1 = {
      name: 'TestNode',
      display_name: 'Test Node',
      category: 'Testing',
      python_module: 'test_module',
      description: 'A test node',
      input: plainObject,
      output: [],
      output_is_list: [],
      output_name: [],
      output_node: false
    }

    const result = transformNodeDefV1ToV2(nodeDef)

    expect(result).toBeDefined()
    expect(result.inputs).toEqual({})
    expect(result.hidden).toBeUndefined()
  })
})
