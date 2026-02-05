import { describe, expect, it } from 'vitest'

import type {
  BooleanWidgetCore,
  SliderWidgetCore,
  WidgetCoreFor,
  WidgetIdentity,
  WidgetKind,
  WidgetModel,
  WidgetOptionsFor,
  WidgetValueFor
} from '.'
import { assertNever, getWidgetId, widgetId } from '.'

describe('widget primitives', () => {
  describe('widgetId', () => {
    it('creates id from nodeId and name', () => {
      expect(widgetId(42, 'seed')).toBe('42:seed')
    })

    it('handles string names with special characters', () => {
      expect(widgetId(1, 'my-widget')).toBe('1:my-widget')
      expect(widgetId(1, 'my_widget')).toBe('1:my_widget')
      expect(widgetId(1, 'my widget')).toBe('1:my widget')
    })

    it('handles zero nodeId', () => {
      expect(widgetId(0, 'name')).toBe('0:name')
    })
  })
})

describe('widget identity', () => {
  describe('getWidgetId', () => {
    it('derives id from identity object', () => {
      const identity: WidgetIdentity = { nodeId: 42, name: 'seed' }
      expect(getWidgetId(identity)).toBe('42:seed')
    })

    it('works with any object implementing WidgetIdentity', () => {
      const extended = { nodeId: 10, name: 'cfg', extra: 'ignored' }
      expect(getWidgetId(extended)).toBe('10:cfg')
    })
  })
})

describe('widget model type utilities', () => {
  it('WidgetKind derives all kinds from WidgetModel', () => {
    const kinds: WidgetKind[] = [
      'asset',
      'boolean',
      'boundingbox',
      'button',
      'chart',
      'color',
      'combo',
      'custom',
      'fileupload',
      'galleria',
      'image',
      'imagecompare',
      'imagecrop',
      'knob',
      'markdown',
      'multiselect',
      'number',
      'selectbutton',
      'slider',
      'string',
      'textarea',
      'treeselect'
    ]
    expect(kinds.length).toBe(22)
  })

  it('WidgetValueFor extracts correct value types', () => {
    const boolValue: WidgetValueFor<'boolean'> = true
    const sliderValue: WidgetValueFor<'slider'> = 0.5
    const comboValue: WidgetValueFor<'combo'> = 'option1'
    const comboNumValue: WidgetValueFor<'combo'> = 42

    expect(boolValue).toBe(true)
    expect(sliderValue).toBe(0.5)
    expect(comboValue).toBe('option1')
    expect(comboNumValue).toBe(42)
  })

  it('WidgetOptionsFor extracts correct options types', () => {
    const sliderOptions: WidgetOptionsFor<'slider'> = { min: 0, max: 100 }
    const comboOptions: WidgetOptionsFor<'combo'> = { values: ['a', 'b'] }

    expect(sliderOptions.min).toBe(0)
    expect(comboOptions.values).toEqual(['a', 'b'])
  })

  it('WidgetCoreFor extracts the full core type', () => {
    const slider: WidgetCoreFor<'slider'> = {
      nodeId: 1,
      name: 'amount',
      kind: 'slider',
      value: 50,
      options: { min: 0, max: 100 }
    }

    expect(slider.kind).toBe('slider')
    expect(slider.value).toBe(50)
    expect(slider.options.min).toBe(0)
  })
})

describe('discriminated union narrowing', () => {
  function getDefaultValue(widget: WidgetModel): unknown {
    switch (widget.kind) {
      case 'boolean':
        return false
      case 'slider':
        return widget.options.min
      case 'combo':
        return widget.options.values[0]
      case 'number':
        return widget.options.min ?? 0
      case 'string':
      case 'textarea':
      case 'markdown':
        return ''
      case 'color':
        return '#000000'
      case 'button':
        return undefined
      case 'fileupload':
      case 'asset':
      case 'image':
        return ''
      case 'chart':
        return {}
      case 'galleria':
      case 'imagecompare':
      case 'multiselect':
        return []
      case 'treeselect':
        return ''
      case 'selectbutton':
        return widget.options.values[0]
      case 'knob':
        return widget.options.min
      case 'imagecrop':
      case 'boundingbox':
        return { x: 0, y: 0, width: 0, height: 0 }
      case 'custom':
        return null
      default:
        return assertNever(widget)
    }
  }

  it('narrows boolean widget correctly', () => {
    const widget: BooleanWidgetCore = {
      nodeId: 1,
      name: 'enabled',
      kind: 'boolean',
      value: true,
      options: {}
    }
    expect(getDefaultValue(widget)).toBe(false)
  })

  it('narrows slider widget and accesses options.min', () => {
    const widget: SliderWidgetCore = {
      nodeId: 1,
      name: 'strength',
      kind: 'slider',
      value: 50,
      options: { min: 10, max: 100 }
    }
    expect(getDefaultValue(widget)).toBe(10)
  })
})

describe('assertNever', () => {
  it('throws with unexpected value message', () => {
    expect(() => assertNever('unexpected' as never)).toThrow(
      'Unexpected widget kind: unexpected'
    )
  })
})
