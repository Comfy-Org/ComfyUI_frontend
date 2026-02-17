import { describe, expect, it } from 'vitest'

import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'

import {
  getControlAfterGenerateWidget,
  isPrimitiveControlAfterGenerateValue,
  primitiveControlAfterGeneratePropertyKey
} from './primitiveControlValue'

function createWidget(
  value: unknown,
  options?: { serialize?: boolean; canvasOnly?: boolean }
): IBaseWidget {
  return {
    value,
    options: {
      serialize: options?.serialize,
      canvasOnly: options?.canvasOnly
    }
  } as unknown as IBaseWidget
}

describe('primitiveControlValue', () => {
  it('uses a stable property key', () => {
    expect(primitiveControlAfterGeneratePropertyKey).toBe(
      '__primitiveControlAfterGenerate'
    )
  })

  it('validates primitive control values', () => {
    expect(isPrimitiveControlAfterGenerateValue('randomize')).toBe(true)
    expect(isPrimitiveControlAfterGenerateValue('fixed')).toBe(true)
    expect(isPrimitiveControlAfterGenerateValue('increment')).toBe(true)
    expect(isPrimitiveControlAfterGenerateValue('decrement')).toBe(true)
    expect(isPrimitiveControlAfterGenerateValue('invalid')).toBe(false)
    expect(isPrimitiveControlAfterGenerateValue(undefined)).toBe(false)
    expect(isPrimitiveControlAfterGenerateValue(42)).toBe(false)
  })

  describe('getControlAfterGenerateWidget', () => {
    it('finds the control widget by options.serialize and options.canvasOnly', () => {
      const controlWidget = createWidget('increment', {
        serialize: false,
        canvasOnly: true
      })
      const widgets = [createWidget(20), controlWidget]

      expect(getControlAfterGenerateWidget(widgets)).toBe(controlWidget)
    })

    it('does not match widgets where serialize is undefined', () => {
      const widgets = [createWidget('randomize', { canvasOnly: true })]

      expect(getControlAfterGenerateWidget(widgets)).toBeUndefined()
    })

    it('does not match widgets where canvasOnly is false', () => {
      const widgets = [
        createWidget('fixed', { serialize: false, canvasOnly: false })
      ]

      expect(getControlAfterGenerateWidget(widgets)).toBeUndefined()
    })

    it('returns undefined for empty or missing widgets', () => {
      expect(getControlAfterGenerateWidget([])).toBeUndefined()
      expect(getControlAfterGenerateWidget(undefined)).toBeUndefined()
    })
  })
})
