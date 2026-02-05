import { describe, expect, it } from 'vitest'

import type { IWidget } from '@/lib/litegraph/src/types/widgets'

import {
  createMutableSlotWidgetRef,
  createSlotWidgetRef,
  fromLiteGraphWidget,
  kindToLegacyType,
  legacyTypeToKind,
  toLiteGraphWidget,
  toWidgetIdentity
} from './adapters'
import type { WidgetModel } from './model'

describe('legacyTypeToKind', () => {
  it('maps toggle to boolean', () => {
    expect(legacyTypeToKind('toggle')).toBe('boolean')
  })

  it('maps text to textarea', () => {
    expect(legacyTypeToKind('text')).toBe('textarea')
  })

  it('maps number to number', () => {
    expect(legacyTypeToKind('number')).toBe('number')
  })

  it('maps string to string', () => {
    expect(legacyTypeToKind('string')).toBe('string')
  })

  it('preserves direct mappings', () => {
    expect(legacyTypeToKind('slider')).toBe('slider')
    expect(legacyTypeToKind('combo')).toBe('combo')
    expect(legacyTypeToKind('button')).toBe('button')
    expect(legacyTypeToKind('color')).toBe('color')
  })
})

describe('kindToLegacyType', () => {
  it('maps boolean to toggle', () => {
    expect(kindToLegacyType('boolean')).toBe('toggle')
  })

  it('maps textarea to textarea', () => {
    expect(kindToLegacyType('textarea')).toBe('textarea')
  })

  it('maps string to string', () => {
    expect(kindToLegacyType('string')).toBe('string')
  })
})

describe('fromLiteGraphWidget', () => {
  const nodeId = 42

  it('converts toggle widget to boolean', () => {
    const lgWidget = {
      name: 'enabled',
      type: 'toggle',
      value: true,
      options: {},
      y: 0
    } as IWidget

    const result = fromLiteGraphWidget(lgWidget, nodeId)

    expect(result.kind).toBe('boolean')
    expect(result.value).toBe(true)
    expect(result.nodeId).toBe(42)
    expect(result.name).toBe('enabled')
  })

  it('converts number widget with options', () => {
    const lgWidget = {
      name: 'steps',
      type: 'number',
      value: 20,
      options: { min: 1, max: 100, step2: 1, precision: 0 },
      y: 0
    } as IWidget

    const result = fromLiteGraphWidget(lgWidget, nodeId)

    expect(result.kind).toBe('number')
    expect(result.value).toBe(20)
    if (result.kind === 'number') {
      expect(result.options.min).toBe(1)
      expect(result.options.max).toBe(100)
      expect(result.options.step).toBe(1)
      expect(result.options.precision).toBe(0)
    }
  })

  it('converts slider widget', () => {
    const lgWidget = {
      name: 'strength',
      type: 'slider',
      value: 0.75,
      options: { min: 0, max: 1, step2: 0.01 },
      y: 0
    } as IWidget

    const result = fromLiteGraphWidget(lgWidget, nodeId)

    expect(result.kind).toBe('slider')
    expect(result.value).toBe(0.75)
    if (result.kind === 'slider') {
      expect(result.options.min).toBe(0)
      expect(result.options.max).toBe(1)
      expect(result.options.step).toBe(0.01)
    }
  })

  it('converts combo widget with string array values', () => {
    const lgWidget = {
      name: 'sampler',
      type: 'combo',
      value: 'euler',
      options: { values: ['euler', 'euler_a', 'dpm'] },
      y: 0
    } as IWidget

    const result = fromLiteGraphWidget(lgWidget, nodeId)

    expect(result.kind).toBe('combo')
    expect(result.value).toBe('euler')
    if (result.kind === 'combo') {
      expect(result.options.values).toEqual(['euler', 'euler_a', 'dpm'])
    }
  })

  it('converts text widget to textarea', () => {
    const lgWidget = {
      name: 'prompt',
      type: 'text',
      value: 'a cat',
      options: { multiline: true },
      y: 0
    } as IWidget

    const result = fromLiteGraphWidget(lgWidget, nodeId)

    expect(result.kind).toBe('textarea')
    expect(result.value).toBe('a cat')
  })

  it('converts string widget preserving multiline option', () => {
    const lgWidget = {
      name: 'label',
      type: 'string',
      value: 'test',
      options: { multiline: false },
      y: 0
    } as IWidget

    const result = fromLiteGraphWidget(lgWidget, nodeId)

    expect(result.kind).toBe('string')
    expect(result.value).toBe('test')
    if (result.kind === 'string') {
      expect(result.options.multiline).toBe(false)
    }
  })

  it('preserves hidden/disabled/advanced/promoted flags', () => {
    const lgWidget = {
      name: 'test',
      type: 'toggle',
      value: false,
      hidden: true,
      disabled: true,
      advanced: true,
      promoted: true,
      options: {},
      y: 0
    } as IWidget

    const result = fromLiteGraphWidget(lgWidget, nodeId)

    expect(result.hidden).toBe(true)
    expect(result.disabled).toBe(true)
    expect(result.advanced).toBe(true)
    expect(result.promoted).toBe(true)
  })

  it('handles missing value gracefully', () => {
    const lgWidget = {
      name: 'empty',
      type: 'string',
      value: '',
      options: {},
      y: 0
    } as IWidget
    lgWidget.value = undefined as unknown as string

    const result = fromLiteGraphWidget(lgWidget, nodeId)

    expect(result.kind).toBe('string')
    expect(result.value).toBe('')
  })
})

describe('toLiteGraphWidget', () => {
  it('converts boolean widget to toggle', () => {
    const model: WidgetModel = {
      nodeId: 1,
      name: 'enabled',
      kind: 'boolean',
      value: true,
      options: {}
    }

    const result = toLiteGraphWidget(model)

    expect(result.type).toBe('toggle')
    expect(result.value).toBe(true)
    expect(result.name).toBe('enabled')
  })

  it('converts slider widget with options', () => {
    const model: WidgetModel = {
      nodeId: 1,
      name: 'strength',
      kind: 'slider',
      value: 0.5,
      options: { min: 0, max: 1, step: 0.1 }
    }

    const result = toLiteGraphWidget(model)

    expect(result.type).toBe('slider')
    expect(result.value).toBe(0.5)
    expect(result.options?.min).toBe(0)
    expect(result.options?.max).toBe(1)
    expect(result.options?.step2).toBe(0.1)
  })

  it('converts number widget options correctly', () => {
    const model: WidgetModel = {
      nodeId: 1,
      name: 'steps',
      kind: 'number',
      value: 20,
      options: { min: 1, max: 100, step: 1, precision: 0 }
    }

    const result = toLiteGraphWidget(model)

    expect(result.type).toBe('number')
    expect(result.options?.step2).toBe(1)
    expect(result.options?.precision).toBe(0)
  })

  it('preserves state flags', () => {
    const model: WidgetModel = {
      nodeId: 1,
      name: 'test',
      kind: 'boolean',
      value: false,
      hidden: true,
      disabled: true,
      advanced: true,
      promoted: true,
      options: {}
    }

    const result = toLiteGraphWidget(model)

    expect(result.hidden).toBe(true)
    expect(result.disabled).toBe(true)
    expect(result.advanced).toBe(true)
    expect(result.promoted).toBe(true)
  })
})

describe('round-trip conversion', () => {
  it('preserves boolean widget data', () => {
    const original: WidgetModel = {
      nodeId: 5,
      name: 'toggle_test',
      kind: 'boolean',
      value: true,
      options: {}
    }

    const lgWidget = toLiteGraphWidget(original) as IWidget
    const roundTripped = fromLiteGraphWidget(lgWidget, original.nodeId)

    expect(roundTripped.kind).toBe(original.kind)
    expect(roundTripped.name).toBe(original.name)
    expect(roundTripped.value).toBe(original.value)
    expect(roundTripped.nodeId).toBe(original.nodeId)
  })

  it('preserves slider widget data', () => {
    const original: WidgetModel = {
      nodeId: 10,
      name: 'slider_test',
      kind: 'slider',
      value: 0.5,
      options: { min: 0, max: 1, step: 0.01 }
    }

    const lgWidget = toLiteGraphWidget(original) as IWidget
    const roundTripped = fromLiteGraphWidget(lgWidget, original.nodeId)

    expect(roundTripped.kind).toBe('slider')
    expect(roundTripped.value).toBe(0.5)
    if (roundTripped.kind === 'slider') {
      expect(roundTripped.options.min).toBe(0)
      expect(roundTripped.options.max).toBe(1)
      expect(roundTripped.options.step).toBe(0.01)
    }
  })

  it('preserves combo widget data', () => {
    const original: WidgetModel = {
      nodeId: 15,
      name: 'combo_test',
      kind: 'combo',
      value: 'option_b',
      options: { values: ['option_a', 'option_b', 'option_c'] }
    }

    const lgWidget = toLiteGraphWidget(original) as IWidget
    const roundTripped = fromLiteGraphWidget(lgWidget, original.nodeId)

    expect(roundTripped.kind).toBe('combo')
    expect(roundTripped.value).toBe('option_b')
    if (roundTripped.kind === 'combo') {
      expect(roundTripped.options.values).toEqual([
        'option_a',
        'option_b',
        'option_c'
      ])
    }
  })

  it('preserves number widget precision', () => {
    const original: WidgetModel = {
      nodeId: 20,
      name: 'number_test',
      kind: 'number',
      value: 42.5,
      options: { min: 0, max: 100, step: 0.5, precision: 1 }
    }

    const lgWidget = toLiteGraphWidget(original) as IWidget
    const roundTripped = fromLiteGraphWidget(lgWidget, original.nodeId)

    expect(roundTripped.kind).toBe('number')
    expect(roundTripped.value).toBe(42.5)
    if (roundTripped.kind === 'number') {
      expect(roundTripped.options.precision).toBe(1)
    }
  })
})

describe('toWidgetIdentity', () => {
  it('creates identity from minimal widget', () => {
    const fakeWidget = { name: 'seed' }
    const result = toWidgetIdentity(fakeWidget, 42)

    expect(result.nodeId).toBe(42)
    expect(result.name).toBe('seed')
  })

  it('works with objects that have extra properties', () => {
    const widgetLike = { name: 'cfg', value: 7.5, type: 'number' }
    const result = toWidgetIdentity(widgetLike, 10)

    expect(result.nodeId).toBe(10)
    expect(result.name).toBe('cfg')
  })
})

describe('createSlotWidgetRef', () => {
  it('creates a frozen SlotWidgetRef', () => {
    const ref = createSlotWidgetRef('my_widget')

    expect(ref.name).toBe('my_widget')
    expect(Object.isFrozen(ref)).toBe(true)
  })

  it('cannot be modified', () => {
    const ref = createSlotWidgetRef('my_widget')

    expect(() => {
      ;(ref as { name: string }).name = 'changed'
    }).toThrow()
  })
})

describe('createMutableSlotWidgetRef', () => {
  it('creates a mutable SlotWidgetRef', () => {
    const ref = createMutableSlotWidgetRef('my_widget')

    expect(ref.name).toBe('my_widget')
    expect(Object.isFrozen(ref)).toBe(false)
  })

  it('can be modified', () => {
    const ref = createMutableSlotWidgetRef('my_widget')
    ref.name = 'changed'

    expect(ref.name).toBe('changed')
  })

  it('supports prototype chaining', () => {
    const base = { value: 42 }
    const ref = createMutableSlotWidgetRef('my_widget')
    Object.setPrototypeOf(ref, base)

    expect((ref as { name: string; value: number }).value).toBe(42)
    expect(ref.name).toBe('my_widget')
  })
})
