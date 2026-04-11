import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { INumericWidget } from '@/lib/litegraph/src/types/widgets'
import type { InputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'

const mockAddValueControlWidget = vi.fn()

vi.mock('@/scripts/widgets', () => ({
  addValueControlWidget: (...args: unknown[]) =>
    mockAddValueControlWidget(...args),
  addValueControlWidgets: vi.fn()
}))

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => ({
    get: () => false
  })
}))

vi.mock('@/schemas/nodeDef/migration', () => ({
  transformInputSpecV2ToV1: (spec: unknown) => spec
}))

const {
  _for_testing: { onValueChange },
  useIntWidget
} =
  await import('@/renderer/extensions/vueNodes/widgets/composables/useIntWidget')

describe('useIntWidget', () => {
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

  describe('control_after_generate', () => {
    function createMockNode(): LGraphNode {
      return {
        addWidget: vi.fn((_type, _name, _value, _callback, _options) => ({
          type: _type,
          name: _name,
          value: _value,
          options: _options ?? {},
          linkedWidgets: undefined
        }))
      } as unknown as LGraphNode
    }

    beforeEach(() => {
      mockAddValueControlWidget.mockReset()
      mockAddValueControlWidget.mockReturnValue({ type: 'combo' })
    })

    it('should not add control widget for INT named "seed" without control_after_generate', () => {
      const node = createMockNode()
      const inputSpec: InputSpec = {
        type: 'INT',
        name: 'seed',
        default: 0
      }

      const constructor = useIntWidget()
      constructor(node, inputSpec)

      expect(mockAddValueControlWidget).not.toHaveBeenCalled()
    })

    it('should add control widget when control_after_generate is explicitly true', () => {
      const node = createMockNode()
      const inputSpec: InputSpec = {
        type: 'INT',
        name: 'seed',
        default: 0,
        control_after_generate: true
      }

      const constructor = useIntWidget()
      constructor(node, inputSpec)

      expect(mockAddValueControlWidget).toHaveBeenCalled()
    })

    it('should pass string control_after_generate as the default type', () => {
      const node = createMockNode()
      const inputSpec: InputSpec = {
        type: 'INT',
        name: 'seed',
        default: 0,
        control_after_generate: 'increment'
      }

      const constructor = useIntWidget()
      constructor(node, inputSpec)

      expect(mockAddValueControlWidget).toHaveBeenCalledWith(
        node,
        expect.anything(),
        'increment',
        undefined,
        undefined,
        expect.anything()
      )
    })
  })
})
