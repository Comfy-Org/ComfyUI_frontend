import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  _for_testing,
  useFloatWidget
} from '@/renderer/extensions/vueNodes/widgets/composables/useFloatWidget'
import type { InputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'

let mockFloatRoundingPrecision = 0

vi.mock('@/scripts/widgets', () => ({
  addValueControlWidgets: vi.fn(),
  addValueControlWidget: vi.fn()
}))

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => ({
    settings: {},
    get: (key: string) => {
      if (key === 'Comfy.FloatRoundingPrecision')
        return mockFloatRoundingPrecision
      if (key === 'Comfy.DisableFloatRounding') return false
      if (key === 'Comfy.DisableSliders') return false
      return undefined
    }
  })
}))

const { onFloatValueChange } = _for_testing

describe('useFloatWidget', () => {
  describe('onFloatValueChange', () => {
    let widget: any

    beforeEach(() => {
      // Reset the widget before each test
      widget = {
        options: {},
        value: 0
      }
      mockFloatRoundingPrecision = 0
    })

    it('should not round values when round option is not set', () => {
      widget.options.round = undefined
      onFloatValueChange.call(widget, 5.7)
      expect(widget.value).toBe(5.7)
    })

    it('should round values based on round option', () => {
      widget.options.round = 0.5
      onFloatValueChange.call(widget, 5.7)
      expect(widget.value).toBe(5.5)

      widget.options.round = 0.1
      onFloatValueChange.call(widget, 5.74)
      expect(widget.value).toBe(5.7)

      widget.options.round = 1
      onFloatValueChange.call(widget, 5.7)
      expect(widget.value).toBe(6)
    })

    it('should respect min and max constraints after rounding', () => {
      widget.options.round = 0.5
      widget.options.min = 1
      widget.options.max = 5

      // Should round to 1 and respect min
      onFloatValueChange.call(widget, 0.7)
      expect(widget.value).toBe(1)

      // Should round to 5.5 but be clamped to max of 5
      onFloatValueChange.call(widget, 5.3)
      expect(widget.value).toBe(5)

      // Should round to 3.5 and be within bounds
      onFloatValueChange.call(widget, 3.6)
      expect(widget.value).toBe(3.5)
    })

    it('should handle Number.EPSILON for precision issues', () => {
      widget.options.round = 0.1

      // Without Number.EPSILON, 1.35 / 0.1 = 13.499999999999998
      // which would round to 13 * 0.1 = 1.3 instead of 1.4
      onFloatValueChange.call(widget, 1.35)
      expect(widget.value).toBeCloseTo(1.4, 10)

      // Test another edge case
      onFloatValueChange.call(widget, 2.95)
      expect(widget.value).toBeCloseTo(3, 10)
    })
  })

  describe('widget constructor precision', () => {
    const buildNode = () => {
      const widgets: IBaseWidget[] = []
      const node: LGraphNode = {
        addWidget: (
          type: string,
          name: string,
          value: number,
          callback: (v: number) => void,
          options: any
        ) => {
          const widget = {
            type,
            name,
            value,
            callback,
            options,
            y: 0
          } as unknown as IBaseWidget
          widgets.push(widget)
          return widget
        }
      } as unknown as LGraphNode

      return { node, widgets }
    }

    it('uses auto precision derived from step when provided', () => {
      const { node, widgets } = buildNode()
      const widgetConstructor = useFloatWidget()

      const inputSpec = {
        type: 'FLOAT',
        name: 'test-float',
        step: 0.01,
        min: 0,
        max: 1
      } as unknown as InputSpec

      widgetConstructor(node, inputSpec)

      expect(widgets).toHaveLength(1)
      expect(widgets[0].options.precision).toBe(2)
    })

    it('falls back to default precision when step and round are not provided', () => {
      const { node, widgets } = buildNode()
      const widgetConstructor = useFloatWidget()

      const inputSpec = {
        type: 'FLOAT',
        name: 'test-float',
        min: 0,
        max: 1
      } as unknown as InputSpec

      widgetConstructor(node, inputSpec)

      expect(widgets).toHaveLength(1)
      expect(widgets[0].options.precision).toBe(3)
    })

    it('respects user FloatRoundingPrecision setting when > 0', () => {
      const { node, widgets } = buildNode()
      const widgetConstructor = useFloatWidget()

      mockFloatRoundingPrecision = 4

      const inputSpec = {
        type: 'FLOAT',
        name: 'test-float',
        step: 0.01,
        min: 0,
        max: 1
      } as unknown as InputSpec

      widgetConstructor(node, inputSpec)

      expect(widgets).toHaveLength(1)
      expect(widgets[0].options.precision).toBe(4)
    })
  })
})
