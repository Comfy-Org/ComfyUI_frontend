import { mount } from '@vue/test-utils'
import PrimeVue from 'primevue/config'
import MultiSelect from 'primevue/multiselect'
import type { MultiSelectProps } from 'primevue/multiselect'
import { describe, expect, it } from 'vitest'

import type { SimplifiedWidget, WidgetValue } from '@/types/simplifiedWidget'

import WidgetMultiSelect from './WidgetMultiSelect.vue'

describe('WidgetMultiSelect Value Binding', () => {
  const createMockWidget = (
    value: WidgetValue[] = [],
    options: Partial<MultiSelectProps> & { values?: WidgetValue[] } = {},
    callback?: (value: WidgetValue[]) => void
  ): SimplifiedWidget<WidgetValue[]> => ({
    name: 'test_multiselect',
    type: 'array',
    value,
    options,
    callback
  })

  const mountComponent = (
    widget: SimplifiedWidget<WidgetValue[]>,
    modelValue: WidgetValue[],
    readonly = false
  ) => {
    return mount(WidgetMultiSelect, {
      global: {
        plugins: [PrimeVue],
        components: { MultiSelect }
      },
      props: {
        widget,
        modelValue,
        readonly
      }
    })
  }

  const setMultiSelectValueAndEmit = async (
    wrapper: ReturnType<typeof mount>,
    values: WidgetValue[]
  ) => {
    const multiselect = wrapper.findComponent({ name: 'MultiSelect' })
    await multiselect.vm.$emit('update:modelValue', values)
    return multiselect
  }

  describe('Vue Event Emission', () => {
    it('emits Vue event when selection changes', async () => {
      const widget = createMockWidget([], {
        values: ['option1', 'option2', 'option3']
      })
      const wrapper = mountComponent(widget, [])

      await setMultiSelectValueAndEmit(wrapper, ['option1', 'option2'])

      const emitted = wrapper.emitted('update:modelValue')
      expect(emitted).toBeDefined()
      expect(emitted![0]).toEqual([['option1', 'option2']])
    })

    it('emits Vue event when selection is cleared', async () => {
      const widget = createMockWidget(['option1'], {
        values: ['option1', 'option2']
      })
      const wrapper = mountComponent(widget, ['option1'])

      await setMultiSelectValueAndEmit(wrapper, [])

      const emitted = wrapper.emitted('update:modelValue')
      expect(emitted).toBeDefined()
      expect(emitted![0]).toEqual([[]])
    })

    it('handles single item selection', async () => {
      const widget = createMockWidget([], {
        values: ['single']
      })
      const wrapper = mountComponent(widget, [])

      await setMultiSelectValueAndEmit(wrapper, ['single'])

      const emitted = wrapper.emitted('update:modelValue')
      expect(emitted).toBeDefined()
      expect(emitted![0]).toEqual([['single']])
    })

    it('emits update:modelValue for callback handling at parent level', async () => {
      const widget = createMockWidget([], {
        values: ['option1', 'option2']
      })
      const wrapper = mountComponent(widget, [])

      await setMultiSelectValueAndEmit(wrapper, ['option1'])

      // The widget should emit the change for parent (NodeWidgets) to handle callbacks
      const emitted = wrapper.emitted('update:modelValue')
      expect(emitted).toBeDefined()
      expect(emitted![0]).toEqual([['option1']])
    })

    it('handles missing callback gracefully', async () => {
      const widget = createMockWidget(
        [],
        {
          values: ['option1']
        },
        undefined
      )
      const wrapper = mountComponent(widget, [])

      await setMultiSelectValueAndEmit(wrapper, ['option1'])

      // Should still emit Vue event
      const emitted = wrapper.emitted('update:modelValue')
      expect(emitted).toBeDefined()
      expect(emitted![0]).toEqual([['option1']])
    })
  })

  describe('Component Rendering', () => {
    it('renders multiselect component', () => {
      const widget = createMockWidget([], {
        values: ['option1', 'option2']
      })
      const wrapper = mountComponent(widget, [])

      const multiselect = wrapper.findComponent({ name: 'MultiSelect' })
      expect(multiselect.exists()).toBe(true)
    })

    it('displays options from widget values', () => {
      const options = ['apple', 'banana', 'cherry']
      const widget = createMockWidget([], { values: options })
      const wrapper = mountComponent(widget, [])

      const multiselect = wrapper.findComponent({ name: 'MultiSelect' })
      expect(multiselect.props('options')).toEqual(options)
    })

    it('displays initial selected values', () => {
      const widget = createMockWidget(['banana'], {
        values: ['apple', 'banana', 'cherry']
      })
      const wrapper = mountComponent(widget, ['banana'])

      const multiselect = wrapper.findComponent({ name: 'MultiSelect' })
      expect(multiselect.props('modelValue')).toEqual(['banana'])
    })

    it('applies small size styling', () => {
      const widget = createMockWidget([], { values: ['test'] })
      const wrapper = mountComponent(widget, [])

      const multiselect = wrapper.findComponent({ name: 'MultiSelect' })
      expect(multiselect.props('size')).toBe('small')
    })

    it('uses chip display mode', () => {
      const widget = createMockWidget([], { values: ['test'] })
      const wrapper = mountComponent(widget, [])

      const multiselect = wrapper.findComponent({ name: 'MultiSelect' })
      expect(multiselect.props('display')).toBe('chip')
    })

    it('applies text-xs class', () => {
      const widget = createMockWidget([], { values: ['test'] })
      const wrapper = mountComponent(widget, [])

      const multiselect = wrapper.findComponent({ name: 'MultiSelect' })
      expect(multiselect.classes()).toContain('text-xs')
    })
  })

  describe('Widget Options Handling', () => {
    it('passes through valid widget options', () => {
      const widget = createMockWidget([], {
        values: ['option1', 'option2'],
        placeholder: 'Select items...',
        filter: true,
        showClear: true
      })
      const wrapper = mountComponent(widget, [])

      const multiselect = wrapper.findComponent({ name: 'MultiSelect' })
      expect(multiselect.props('placeholder')).toBe('Select items...')
      expect(multiselect.props('filter')).toBe(true)
      expect(multiselect.props('showClear')).toBe(true)
    })

    it('excludes panel-related props', () => {
      const widget = createMockWidget([], {
        values: ['option1'],
        overlayStyle: { color: 'red' },
        panelClass: 'custom-panel'
      })
      const wrapper = mountComponent(widget, [])

      const multiselect = wrapper.findComponent({ name: 'MultiSelect' })
      // These props should be filtered out by the prop filter
      expect(multiselect.props('overlayStyle')).not.toEqual({ color: 'red' })
      expect(multiselect.props('panelClass')).not.toBe('custom-panel')
    })

    it('handles empty values array', () => {
      const widget = createMockWidget([], { values: [] })
      const wrapper = mountComponent(widget, [])

      const multiselect = wrapper.findComponent({ name: 'MultiSelect' })
      expect(multiselect.props('options')).toEqual([])
    })

    it('handles missing values option', () => {
      const widget = createMockWidget([])
      const wrapper = mountComponent(widget, [])

      const multiselect = wrapper.findComponent({ name: 'MultiSelect' })
      // Should not crash, options might be undefined
      expect(multiselect.exists()).toBe(true)
    })
  })

  describe('Edge Cases', () => {
    it('handles numeric values', async () => {
      const widget = createMockWidget([], {
        values: [1, 2, 3, 4, 5]
      })
      const wrapper = mountComponent(widget, [])

      await setMultiSelectValueAndEmit(wrapper, [1, 3, 5])

      const emitted = wrapper.emitted('update:modelValue')
      expect(emitted).toBeDefined()
      expect(emitted![0]).toEqual([[1, 3, 5]])
    })

    it('handles mixed type values', async () => {
      const widget = createMockWidget([], {
        values: ['string', 123, true, null]
      })
      const wrapper = mountComponent(widget, [])

      await setMultiSelectValueAndEmit(wrapper, ['string', 123])

      const emitted = wrapper.emitted('update:modelValue')
      expect(emitted).toBeDefined()
      expect(emitted![0]).toEqual([['string', 123]])
    })

    it('handles object values', async () => {
      const objectValues = [
        { id: 1, label: 'First' },
        { id: 2, label: 'Second' }
      ]
      const widget = createMockWidget([], {
        values: objectValues,
        optionLabel: 'label',
        optionValue: 'id'
      })
      const wrapper = mountComponent(widget, [])

      await setMultiSelectValueAndEmit(wrapper, [1, 2])

      const emitted = wrapper.emitted('update:modelValue')
      expect(emitted).toBeDefined()
      expect(emitted![0]).toEqual([[1, 2]])
    })

    it('handles duplicate selections gracefully', async () => {
      const widget = createMockWidget([], {
        values: ['option1', 'option2']
      })
      const wrapper = mountComponent(widget, [])

      // MultiSelect should handle duplicates internally
      await setMultiSelectValueAndEmit(wrapper, ['option1', 'option1'])

      const emitted = wrapper.emitted('update:modelValue')
      expect(emitted).toBeDefined()
      // The actual behavior depends on PrimeVue implementation
      expect(emitted![0]).toEqual([['option1', 'option1']])
    })

    it('handles very large option lists', () => {
      const largeOptionList = Array.from(
        { length: 1000 },
        (_, i) => `option${i}`
      )
      const widget = createMockWidget([], { values: largeOptionList })
      const wrapper = mountComponent(widget, [])

      const multiselect = wrapper.findComponent({ name: 'MultiSelect' })
      expect(multiselect.props('options')).toHaveLength(1000)
    })

    it('handles empty string values', async () => {
      const widget = createMockWidget([], {
        values: ['', 'not empty', '  ', 'normal']
      })
      const wrapper = mountComponent(widget, [])

      await setMultiSelectValueAndEmit(wrapper, ['', '  '])

      const emitted = wrapper.emitted('update:modelValue')
      expect(emitted).toBeDefined()
      expect(emitted![0]).toEqual([['', '  ']])
    })
  })

  describe('Integration with Layout', () => {
    it('renders within WidgetLayoutField', () => {
      const widget = createMockWidget([], { values: ['test'] })
      const wrapper = mountComponent(widget, [])

      const layoutField = wrapper.findComponent({ name: 'WidgetLayoutField' })
      expect(layoutField.exists()).toBe(true)
      expect(layoutField.props('widget')).toEqual(widget)
    })

    it('passes widget name to layout field', () => {
      const widget = createMockWidget([], { values: ['test'] })
      widget.name = 'custom_multiselect'
      const wrapper = mountComponent(widget, [])

      const layoutField = wrapper.findComponent({ name: 'WidgetLayoutField' })
      expect(layoutField.props('widget').name).toBe('custom_multiselect')
    })
  })
})
