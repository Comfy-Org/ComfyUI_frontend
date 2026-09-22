import { describe, expect, it } from 'vitest'

import type { FieldSchema } from './workshop-playground'
import { closestOption, snapToStep } from './router-parameter-options'

describe('numeric parameter snapping', () => {
  it.for([0.1, 0.5, 2, 64])(
    'keeps values on the native %s grid, within bounds and stable when mapped again',
    (step) => {
      const min = step * 1.25
      const max = step * 7.75
      const field: Extract<FieldSchema, { kind: 'number' }> = {
        kind: 'number',
        name: 'size',
        label: 'Size',
        min,
        max,
        step: 1,
        inputSchema: {
          type: 'number',
          multipleOf: step,
          minimum: min,
          maximum: max
        }
      }
      let previous = -Infinity
      for (let index = -20; index <= 100; index++) {
        const value = snapToStep((index * step) / 10, field)
        expect(value).toBeGreaterThanOrEqual(min)
        expect(value).toBeLessThanOrEqual(max)
        expect(value / step).toBeCloseTo(Math.round(value / step), 12)
        expect(snapToStep(value, field)).toBe(value)
        expect(value).toBeGreaterThanOrEqual(previous)
        previous = value
      }
    }
  )

  it('uses the widget minimum as the grid origin only when there is no native schema', () => {
    const field: Extract<FieldSchema, { kind: 'number' }> = {
      kind: 'number',
      name: 'steps',
      label: 'Steps',
      min: 3,
      max: 11,
      step: 2
    }
    expect(snapToStep(6, field)).toBe(7)
    expect(snapToStep(6, { ...field, inputSchema: { type: 'integer' } })).toBe(
      6
    )
    expect(
      snapToStep(6.125, { ...field, inputSchema: { type: 'number' } })
    ).toBe(6.125)
  })
})

describe('native option selection', () => {
  it('keeps declaration order for an equal distance and maps aliases back to native values', () => {
    expect(
      closestOption(
        {
          kind: 'select',
          name: 'duration',
          label: 'Duration',
          options: [8, 4]
        },
        6,
        { parameter: 'duration_seconds' }
      )
    ).toBe(8)
    expect(
      closestOption(
        {
          kind: 'select',
          name: 'audio',
          label: 'Audio',
          options: ['on', 'off']
        },
        false,
        { parameter: 'generate_audio', options: { on: true, off: false } }
      )
    ).toBe('off')
  })

  it('excludes automatic duration sentinels from nearest numeric selection but accepts an exact match', () => {
    const field: Extract<FieldSchema, { kind: 'select' }> = {
      kind: 'select',
      name: 'duration',
      label: 'Duration',
      options: [-1, 5, 10]
    }
    expect(closestOption(field, 1, { parameter: 'duration_seconds' })).toBe(5)
    expect(closestOption(field, -1, { parameter: 'duration_seconds' })).toBe(-1)
  })
})
