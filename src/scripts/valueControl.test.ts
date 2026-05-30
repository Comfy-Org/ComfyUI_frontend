import { afterEach, describe, expect, it, vi } from 'vitest'

import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'

import { IS_CONTROL_WIDGET } from './controlWidgetMarker'
import {
  computeNextControlledValue,
  isValueControlWidget
} from './valueControl'

const makeNumberWidget = (
  value: number,
  options: Partial<IBaseWidget['options']> = {}
): IBaseWidget =>
  ({
    type: 'number',
    name: 'seed',
    value,
    options
  }) as unknown as IBaseWidget

const makeComboWidget = (value: string, values: string[]): IBaseWidget =>
  ({
    type: 'combo',
    name: 'choice',
    value,
    options: { values }
  }) as unknown as IBaseWidget

describe('isValueControlWidget', () => {
  it('returns true for a marked widget with both lifecycle hooks', () => {
    const widget = {
      [IS_CONTROL_WIDGET]: true,
      beforeQueued: () => {},
      afterQueued: () => {}
    } as unknown as IBaseWidget
    expect(isValueControlWidget(widget)).toBe(true)
  })

  it('returns false when the marker symbol is missing', () => {
    const widget = {
      beforeQueued: () => {},
      afterQueued: () => {}
    } as unknown as IBaseWidget
    expect(isValueControlWidget(widget)).toBe(false)
  })

  it('returns false when lifecycle hooks are missing', () => {
    const widget = {
      [IS_CONTROL_WIDGET]: true
    } as unknown as IBaseWidget
    expect(isValueControlWidget(widget)).toBe(false)
  })
})

describe('computeNextControlledValue (number)', () => {
  it('returns undefined for fixed mode', () => {
    expect(
      computeNextControlledValue(makeNumberWidget(5), 'fixed')
    ).toBeUndefined()
  })

  it('increments by step2', () => {
    const widget = makeNumberWidget(5, { min: 0, max: 100, step2: 2 })
    expect(computeNextControlledValue(widget, 'increment')).toBe(7)
  })

  it('decrements by step2', () => {
    const widget = makeNumberWidget(5, { min: 0, max: 100, step2: 3 })
    expect(computeNextControlledValue(widget, 'decrement')).toBe(2)
  })

  it('clamps to max on increment', () => {
    const widget = makeNumberWidget(99, { min: 0, max: 100, step2: 5 })
    expect(computeNextControlledValue(widget, 'increment')).toBe(100)
  })

  it('clamps to min on decrement', () => {
    const widget = makeNumberWidget(1, { min: 0, max: 100, step2: 5 })
    expect(computeNextControlledValue(widget, 'decrement')).toBe(0)
  })

  it('randomizes within range using a seeded random', () => {
    const widget = makeNumberWidget(0, { min: 10, max: 20, step2: 1 })
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    expect(computeNextControlledValue(widget, 'randomize')).toBe(15)
  })

  it('returns undefined when target value is not numeric', () => {
    const widget = {
      type: 'number',
      name: 'seed',
      value: 'not a number',
      options: {}
    } as unknown as IBaseWidget
    expect(computeNextControlledValue(widget, 'increment')).toBeUndefined()
  })
})

describe('computeNextControlledValue (combo)', () => {
  it('cycles to the next value on increment', () => {
    const widget = makeComboWidget('a', ['a', 'b', 'c'])
    expect(computeNextControlledValue(widget, 'increment')).toBe('b')
  })

  it('clamps at the end on increment without wrap', () => {
    const widget = makeComboWidget('c', ['a', 'b', 'c'])
    expect(computeNextControlledValue(widget, 'increment')).toBe('c')
  })

  it('wraps to first value on increment-wrap past the end', () => {
    const widget = makeComboWidget('c', ['a', 'b', 'c'])
    expect(computeNextControlledValue(widget, 'increment-wrap')).toBe('a')
  })

  it('cycles to the previous value on decrement', () => {
    const widget = makeComboWidget('b', ['a', 'b', 'c'])
    expect(computeNextControlledValue(widget, 'decrement')).toBe('a')
  })

  it('randomizes by index', () => {
    const widget = makeComboWidget('a', ['a', 'b', 'c', 'd'])
    vi.spyOn(Math, 'random').mockReturnValue(0.6)
    expect(computeNextControlledValue(widget, 'randomize')).toBe('c')
  })

  it('applies a substring filter', () => {
    const widget = makeComboWidget('apple', ['apple', 'banana', 'apricot'])
    expect(
      computeNextControlledValue(widget, 'increment', { comboFilter: 'ap' })
    ).toBe('apricot')
  })

  it('applies a regex filter when wrapped in slashes', () => {
    const widget = makeComboWidget('foo1', ['foo1', 'bar', 'foo2'])
    expect(
      computeNextControlledValue(widget, 'increment', { comboFilter: '/foo/' })
    ).toBe('foo2')
  })

  it('returns undefined when the filter eliminates all values', () => {
    const widget = makeComboWidget('a', ['a', 'b'])
    expect(
      computeNextControlledValue(widget, 'increment', { comboFilter: 'zzz' })
    ).toBeUndefined()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })
})
