import { beforeEach, describe, expect, it, vi } from 'vitest'

import { _for_testing } from '@/composables/widgets/useIntWidget'

vi.mock('@/scripts/widgets', () => ({
  addValueControlWidgets: vi.fn()
}))

vi.mock('@/stores/settingStore', () => ({
  useSettingStore: () => ({
    settings: {}
  })
}))

const { onValueChange } = _for_testing

describe('useIntWidget', () => {
  describe('onValueChange', () => {
    let widget: any

    beforeEach(() => {
      // Reset the widget before each test
      widget = {
        options: {},
        value: 0
      }
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
