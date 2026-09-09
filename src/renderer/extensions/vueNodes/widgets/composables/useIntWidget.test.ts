import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { INumericWidget } from '@/lib/litegraph/src/types/widgets'
import {
  _for_testing,
  useIntWidget
} from '@/renderer/extensions/vueNodes/widgets/composables/useIntWidget'

vi.mock(import('@/scripts/widgets'), () => ({
  addValueControlWidget: vi.fn()
}))

vi.mock<unknown>(import('@/platform/settings/settingStore'), () => ({
  useSettingStore: () => ({
    get: vi.fn(() => false)
  })
}))

const { onValueChange } = _for_testing

describe('useIntWidget', () => {
  it('uses a color picker while preserving the integer value', () => {
    const graph = new LGraph()
    const node = new LGraphNode('EmptyImage')
    node.serialize_widgets = true
    graph.add(node)
    const widget = useIntWidget()(node, {
      type: 'INT',
      name: 'color',
      default: 0x45edf5,
      min: 0,
      max: 0xffffff,
      display: 'color'
    })

    expect(widget.type).toBe('color')
    expect(widget.value).toBe(0x45edf5)
    expect(widget.options).toMatchObject({ format: 'int' })
    expect(node.serialize().widgets_values).toEqual([0x45edf5])
  })

  describe('onValueChange', () => {
    let widget: INumericWidget

    beforeEach(() => {
      // Reset the widget before each test
      widget = {
        type: 'number',
        name: 'test_widget',
        y: 0,
        options: {},
        value: 0
      } as Partial<INumericWidget> as INumericWidget
    })

    it('should round values based on step size', () => {
      widget.options.step2 = 0.1
      onValueChange.call(widget, 5.7)
      expect(widget.value).toBe(5.7)

      widget.options.step2 = 0.5
      onValueChange.call(widget, 7.3)
      expect(widget.value).toBe(7.5)

      widget.options.step2 = 1
      onValueChange.call(widget, 23.4)
      expect(widget.value).toBe(23)
    })

    it('should handle undefined step by using default of 1', () => {
      widget.options.step2 = undefined
      onValueChange.call(widget, 3.7)
      expect(widget.value).toBe(4)
    })

    it('should account for min value offset', () => {
      widget.options.step2 = 2
      widget.options.min = 1
      // 2 valid values between 1.6 are 1 and 3
      // 1.6 is closer to 1, so it should round to 1
      onValueChange.call(widget, 1.6)
      expect(widget.value).toBe(1)
    })

    it('should handle undefined min by using default of 0', () => {
      widget.options.step2 = 2
      widget.options.min = undefined
      onValueChange.call(widget, 5.7)
      expect(widget.value).toBe(6)
    })

    it('should handle NaN shift value', () => {
      widget.options.step2 = 0
      widget.options.min = 1
      onValueChange.call(widget, 5.7)
      expect(widget.value).toBe(6)
    })
  })
})
