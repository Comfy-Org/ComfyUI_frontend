import { describe, expect, it } from 'vitest'

import type { ComfyInputsSpec } from '@/schemas/nodeDefSchema'
import { zDynamicGroupInputSpec } from '@/schemas/nodeDefSchema'

import { resolveDynamicInputSpec } from './dynamicInputSpec'

const inputs: ComfyInputsSpec = {
  required: {
    loras: [
      'COMFY_DYNAMICGROUP_V3',
      {
        min: 0,
        max: 3,
        template: {
          required: { name: ['COMBO', { options: ['A', 'B'] }] },
          optional: { strength: ['FLOAT', { default: 1 }] }
        }
      }
    ]
  }
}

describe('DynamicGroup input specifications', () => {
  it('resolves required fields independently of the minimum row count', () => {
    expect(
      resolveDynamicInputSpec(inputs, 'loras.2.name', () => undefined)
    ).toEqual({ spec: ['COMBO', { options: ['A', 'B'] }], isOptional: false })
    expect(
      resolveDynamicInputSpec(inputs, 'loras.2.strength', () => undefined)
    ).toEqual({ spec: ['FLOAT', { default: 1 }], isOptional: true })
  })

  it.for([
    'loras.3.name',
    'loras.01.name',
    'loras.-1.name',
    'loras.0.unknown',
    'loras.0'
  ])('does not resolve invalid field name %s', (name) => {
    expect(
      resolveDynamicInputSpec(inputs, name, () => undefined)
    ).toBeUndefined()
  })

  it('resolves groups inside the selected DynamicCombo option', () => {
    const combo: ComfyInputsSpec = {
      required: {
        mode: [
          'COMFY_DYNAMICCOMBO_V3',
          {
            options: [
              { key: 'on', inputs },
              { key: 'off', inputs: {} }
            ]
          }
        ]
      }
    }
    expect(
      resolveDynamicInputSpec(combo, 'mode.loras.0.name', () => 'on')?.spec
    ).toEqual(['COMBO', { options: ['A', 'B'] }])
    expect(
      resolveDynamicInputSpec(combo, 'mode.loras.0.name', () => 'off')
    ).toBeUndefined()
  })

  it.for([{ min: 2, max: 1 }, { max: 101 }, { min: 0.5 }, { max: false }])(
    'rejects invalid bounds %j',
    (bounds) => {
      expect(
        zDynamicGroupInputSpec.safeParse([
          'COMFY_DYNAMICGROUP_V3',
          {
            template: { required: { value: ['STRING', {}] } },
            ...bounds
          }
        ]).success
      ).toBe(false)
    }
  )
})
