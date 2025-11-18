import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MockedFunction } from 'vitest'
import { ref } from 'vue'

import {
  useBooleanWidgetValue,
  useWidgetValue
} from '@/composables/graph/useWidgetValue'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'

describe('useWidgetValue', () => {
  let mockWidget: SimplifiedWidget<string>
  let mockEmit: MockedFunction<(event: 'update:modelValue', value: any) => void>
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    mockWidget = {
      name: 'testWidget',
      type: 'string',
      value: 'initial',
      callback: vi.fn()
    }
    mockEmit = vi.fn()
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleWarnSpy.mockRestore()
  })

  describe('basic functionality', () => {
    it('should initialize with modelValue', () => {
      const { localValue } = useWidgetValue({
        widget: mockWidget,
        modelValue: 'test value',
        defaultValue: '',
        emit: mockEmit
      })

      expect(localValue.value).toBe('test value')
    })

    it('should use defaultValue when modelValue is null', () => {
      const { localValue } = useWidgetValue({
        widget: mockWidget,
        modelValue: null as any,
        defaultValue: 'default',
        emit: mockEmit
      })

      expect(localValue.value).toBe('default')
    })

    it('should use defaultValue when modelValue is undefined', () => {
      const { localValue } = useWidgetValue({
        widget: mockWidget,
        modelValue: undefined as any,
        defaultValue: 'default',
        emit: mockEmit
      })

      expect(localValue.value).toBe('default')
    })
  })

  describe('onChange handler', () => {
    it('should update localValue immediately', () => {
      const { localValue, onChange } = useWidgetValue({
        widget: mockWidget,
        modelValue: 'initial',
        defaultValue: '',
        emit: mockEmit
      })

      onChange('new value')
      expect(localValue.value).toBe('new value')
    })

    it('should emit update:modelValue event', () => {
      const { onChange } = useWidgetValue({
        widget: mockWidget,
        modelValue: 'initial',
        defaultValue: '',
        emit: mockEmit
      })

      onChange('new value')
      expect(mockEmit).toHaveBeenCalledWith('update:modelValue', 'new value')
    })

    it('should not error if widget callback is undefined', () => {
      const widgetWithoutCallback = { ...mockWidget, callback: undefined }
      const { onChange } = useWidgetValue({
        widget: widgetWithoutCallback,
        modelValue: 'initial',
        defaultValue: '',
        emit: mockEmit
      })

      expect(() => onChange('new value')).not.toThrow()
      expect(mockEmit).toHaveBeenCalledWith('update:modelValue', 'new value')
    })

    it('should handle null values', () => {
      const { localValue, onChange } = useWidgetValue({
        widget: mockWidget,
        modelValue: 'initial',
        defaultValue: 'default',
        emit: mockEmit
      })

      onChange(null as any)
      expect(localValue.value).toBe('default')
      expect(mockEmit).toHaveBeenCalledWith('update:modelValue', 'default')
    })

    it('should handle undefined values', () => {
      const { localValue, onChange } = useWidgetValue({
        widget: mockWidget,
        modelValue: 'initial',
        defaultValue: 'default',
        emit: mockEmit
      })

      onChange(undefined as any)
      expect(localValue.value).toBe('default')
      expect(mockEmit).toHaveBeenCalledWith('update:modelValue', 'default')
    })
  })

  describe('type safety', () => {
    it('should handle type mismatches with warning', () => {
      const numberWidget: SimplifiedWidget<number> = {
        name: 'numberWidget',
        type: 'number',
        value: 42,
        callback: vi.fn()
      }

      const { onChange } = useWidgetValue({
        widget: numberWidget,
        modelValue: 10,
        defaultValue: 0,
        emit: mockEmit
      })

      // Pass string to number widget
      onChange('not a number' as any)

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'useWidgetValue: Type mismatch for widget numberWidget. Expected number, got string'
      )
      expect(mockEmit).toHaveBeenCalledWith('update:modelValue', 0) // Uses defaultValue
    })

    it('should accept values of matching type', () => {
      const numberWidget: SimplifiedWidget<number> = {
        name: 'numberWidget',
        type: 'number',
        value: 42,
        callback: vi.fn()
      }

      const { onChange } = useWidgetValue({
        widget: numberWidget,
        modelValue: 10,
        defaultValue: 0,
        emit: mockEmit
      })

      onChange(25)
      expect(consoleWarnSpy).not.toHaveBeenCalled()
      expect(mockEmit).toHaveBeenCalledWith('update:modelValue', 25)
    })
  })

  describe('transform function', () => {
    it('should apply transform function to new values', () => {
      const transform = vi.fn((value: string) => value.toUpperCase())
      const { onChange } = useWidgetValue({
        widget: mockWidget,
        modelValue: 'initial',
        defaultValue: '',
        emit: mockEmit,
        transform
      })

      onChange('hello')
      expect(transform).toHaveBeenCalledWith('hello')
      expect(mockEmit).toHaveBeenCalledWith('update:modelValue', 'HELLO')
    })

    it('should skip type checking when transform is provided', () => {
      const numberWidget: SimplifiedWidget<number> = {
        name: 'numberWidget',
        type: 'number',
        value: 42,
        callback: vi.fn()
      }

      const transform = (value: string) => parseInt(value, 10) || 0
      const { onChange } = useWidgetValue({
        widget: numberWidget,
        modelValue: 10,
        defaultValue: 0,
        emit: mockEmit,
        transform
      })

      onChange('123')
      expect(consoleWarnSpy).not.toHaveBeenCalled()
      expect(mockEmit).toHaveBeenCalledWith('update:modelValue', 123)
    })
  })

  describe('external updates', () => {
    it('should update localValue when modelValue changes', async () => {
      const modelValue = ref('initial')
      const { localValue } = useWidgetValue({
        widget: mockWidget,
        modelValue: modelValue.value,
        defaultValue: '',
        emit: mockEmit
      })

      expect(localValue.value).toBe('initial')

      // Simulate parent updating modelValue
      modelValue.value = 'updated externally'

      // Re-create the composable with new value (simulating prop change)
      const { localValue: newLocalValue } = useWidgetValue({
        widget: mockWidget,
        modelValue: modelValue.value,
        defaultValue: '',
        emit: mockEmit
      })

      expect(newLocalValue.value).toBe('updated externally')
    })

    it('should handle external null values', async () => {
      const modelValue = ref<string | null>('initial')
      const { localValue } = useWidgetValue({
        widget: mockWidget,
        modelValue: modelValue.value!,
        defaultValue: 'default',
        emit: mockEmit
      })

      expect(localValue.value).toBe('initial')

      // Simulate external update to null
      modelValue.value = null
      const { localValue: newLocalValue } = useWidgetValue({
        widget: mockWidget,
        modelValue: modelValue.value as any,
        defaultValue: 'default',
        emit: mockEmit
      })

      expect(newLocalValue.value).toBe('default')
    })
  })

  describe('useBooleanWidgetValue helper', () => {
    it('should handle boolean values correctly', () => {
      const boolWidget: SimplifiedWidget<boolean> = {
        name: 'toggleWidget',
        type: 'boolean',
        value: false,
        callback: vi.fn()
      }

      const { localValue, onChange } = useBooleanWidgetValue(
        boolWidget,
        true,
        mockEmit
      )

      expect(localValue.value).toBe(true)

      onChange(false)
      expect(mockEmit).toHaveBeenCalledWith('update:modelValue', false)
    })

    it('should convert truthy values to true', () => {
      const boolWidget: SimplifiedWidget<boolean> = {
        name: 'toggleWidget',
        type: 'boolean',
        value: false,
        callback: vi.fn()
      }

      const { onChange } = useBooleanWidgetValue(boolWidget, false, mockEmit)

      onChange('truthy' as any)
      expect(mockEmit).toHaveBeenCalledWith('update:modelValue', true)
    })

    it('should convert falsy values to false', () => {
      const boolWidget: SimplifiedWidget<boolean> = {
        name: 'toggleWidget',
        type: 'boolean',
        value: false,
        callback: vi.fn()
      }

      const { onChange } = useBooleanWidgetValue(boolWidget, true, mockEmit)

      onChange(0 as any)
      expect(mockEmit).toHaveBeenCalledWith('update:modelValue', false)
    })
  })

  describe('edge cases', () => {
    it('should handle rapid onChange calls', () => {
      const { onChange } = useWidgetValue({
        widget: mockWidget,
        modelValue: 'initial',
        defaultValue: '',
        emit: mockEmit
      })

      onChange('value1')
      onChange('value2')
      onChange('value3')

      expect(mockEmit).toHaveBeenCalledTimes(3)
      expect(mockEmit).toHaveBeenNthCalledWith(1, 'update:modelValue', 'value1')
      expect(mockEmit).toHaveBeenNthCalledWith(2, 'update:modelValue', 'value2')
      expect(mockEmit).toHaveBeenNthCalledWith(3, 'update:modelValue', 'value3')
    })

    it('should handle widget with all properties undefined', () => {
      const minimalWidget = {
        name: 'minimal',
        type: 'unknown'
      } as SimplifiedWidget<any>

      const { localValue, onChange } = useWidgetValue({
        widget: minimalWidget,
        modelValue: 'test',
        defaultValue: 'default',
        emit: mockEmit
      })

      expect(localValue.value).toBe('test')
      expect(() => onChange('new')).not.toThrow()
    })
  })
})
