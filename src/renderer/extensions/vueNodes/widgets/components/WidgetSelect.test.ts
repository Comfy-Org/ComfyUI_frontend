import { mount } from '@vue/test-utils'
import PrimeVue from 'primevue/config'
import Select from 'primevue/select'
import type { SelectProps } from 'primevue/select'
import { describe, expect, it } from 'vitest'

import type { SimplifiedWidget } from '@/types/simplifiedWidget'

import WidgetSelect from './WidgetSelect.vue'

describe('WidgetSelect Value Binding', () => {
  const createMockWidget = (
    value: string = 'option1',
    options: Partial<
      SelectProps & { values?: string[]; return_index?: boolean }
    > = {},
    callback?: (value: string | number | undefined) => void
  ): SimplifiedWidget<string | number | undefined> => ({
    name: 'test_select',
    type: 'combo',
    value,
    options: {
      values: ['option1', 'option2', 'option3'],
      ...options
    },
    callback
  })

  describe('Vue Event Emission', () => {
    it('emits Vue event when selection changes', async () => {
      const widget = createMockWidget('option1')

      const wrapper = mount(WidgetSelect, {
        props: {
          widget,
          modelValue: 'option1',
          readonly: false
        },
        global: {
          plugins: [PrimeVue],
          components: { Select }
        }
      })

      const select = wrapper.findComponent({ name: 'Select' })
      await select.setValue('option2')

      const emitted = wrapper.emitted('update:modelValue')
      expect(emitted).toBeDefined()
      expect(emitted![0]).toContain('option2')
    })

    it('emits string value for different options', async () => {
      const widget = createMockWidget('option1')

      const wrapper = mount(WidgetSelect, {
        props: {
          widget,
          modelValue: 'option1',
          readonly: false
        },
        global: {
          plugins: [PrimeVue],
          components: { Select }
        }
      })

      const select = wrapper.findComponent({ name: 'Select' })
      await select.setValue('option3')

      const emitted = wrapper.emitted('update:modelValue')
      expect(emitted).toBeDefined()
      // Should emit the string value
      expect(emitted![0]).toContain('option3')
    })

    it('handles custom option values', async () => {
      const customOptions = ['custom_a', 'custom_b', 'custom_c']
      const widget = createMockWidget('custom_a', { values: customOptions })

      const wrapper = mount(WidgetSelect, {
        props: {
          widget,
          modelValue: 'custom_a',
          readonly: false
        },
        global: {
          plugins: [PrimeVue],
          components: { Select }
        }
      })

      const select = wrapper.findComponent({ name: 'Select' })
      await select.setValue('custom_b')

      const emitted = wrapper.emitted('update:modelValue')
      expect(emitted).toBeDefined()
      expect(emitted![0]).toContain('custom_b')
    })

    it('handles missing callback gracefully', async () => {
      const widget = createMockWidget('option1', {}, undefined)

      const wrapper = mount(WidgetSelect, {
        props: {
          widget,
          modelValue: 'option1',
          readonly: false
        },
        global: {
          plugins: [PrimeVue],
          components: { Select }
        }
      })

      const select = wrapper.findComponent({ name: 'Select' })
      await select.setValue('option2')

      // Should emit Vue event
      const emitted = wrapper.emitted('update:modelValue')
      expect(emitted).toBeDefined()
      expect(emitted![0]).toContain('option2')
    })

    it('handles value changes gracefully', async () => {
      const widget = createMockWidget('option1')

      const wrapper = mount(WidgetSelect, {
        props: {
          widget,
          modelValue: 'option1',
          readonly: false
        },
        global: {
          plugins: [PrimeVue],
          components: { Select }
        }
      })

      const select = wrapper.findComponent({ name: 'Select' })
      await select.setValue('option2')

      const emitted = wrapper.emitted('update:modelValue')
      expect(emitted).toBeDefined()
      expect(emitted![0]).toContain('option2')
    })
  })

  describe('Readonly Mode', () => {
    it('disables the select component when readonly', async () => {
      const widget = createMockWidget('option1')

      const wrapper = mount(WidgetSelect, {
        props: {
          widget,
          modelValue: 'option1',
          readonly: true
        },
        global: {
          plugins: [PrimeVue],
          components: { Select }
        }
      })

      const select = wrapper.findComponent({ name: 'Select' })
      expect(select.props('disabled')).toBe(true)
    })
  })

  describe('Option Handling', () => {
    it('handles empty options array', async () => {
      const widget = createMockWidget('', { values: [] })

      const wrapper = mount(WidgetSelect, {
        props: {
          widget,
          modelValue: '',
          readonly: false
        },
        global: {
          plugins: [PrimeVue],
          components: { Select }
        }
      })

      const select = wrapper.findComponent({ name: 'Select' })
      expect(select.props('options')).toEqual([])
    })

    it('handles single option', async () => {
      const widget = createMockWidget('only_option', {
        values: ['only_option']
      })

      const wrapper = mount(WidgetSelect, {
        props: {
          widget,
          modelValue: 'only_option',
          readonly: false
        },
        global: {
          plugins: [PrimeVue],
          components: { Select }
        }
      })

      const select = wrapper.findComponent({ name: 'Select' })
      const options = select.props('options')
      expect(options).toHaveLength(1)
      expect(options[0]).toEqual('only_option')
    })

    it('handles options with special characters', async () => {
      const specialOptions = [
        'option with spaces',
        'option@#$%',
        'option/with\\slashes'
      ]
      const widget = createMockWidget(specialOptions[0], {
        values: specialOptions
      })

      const wrapper = mount(WidgetSelect, {
        props: {
          widget,
          modelValue: specialOptions[0],
          readonly: false
        },
        global: {
          plugins: [PrimeVue],
          components: { Select }
        }
      })

      const select = wrapper.findComponent({ name: 'Select' })
      await select.setValue(specialOptions[1])

      const emitted = wrapper.emitted('update:modelValue')
      expect(emitted).toBeDefined()
      expect(emitted![0]).toContain(specialOptions[1])
    })
  })

  describe('Edge Cases', () => {
    it('handles selection of non-existent option gracefully', async () => {
      const widget = createMockWidget('option1')

      const wrapper = mount(WidgetSelect, {
        props: {
          widget,
          modelValue: 'option1',
          readonly: false
        },
        global: {
          plugins: [PrimeVue],
          components: { Select }
        }
      })

      const select = wrapper.findComponent({ name: 'Select' })
      await select.setValue('non_existent_option')

      // Should still emit Vue event with the value
      const emitted = wrapper.emitted('update:modelValue')
      expect(emitted).toBeDefined()
      expect(emitted![0]).toContain('non_existent_option')
    })

    it('handles numeric string options correctly', async () => {
      const numericOptions = ['1', '2', '10', '100']
      const widget = createMockWidget('1', { values: numericOptions })

      const wrapper = mount(WidgetSelect, {
        props: {
          widget,
          modelValue: '1',
          readonly: false
        },
        global: {
          plugins: [PrimeVue],
          components: { Select }
        }
      })

      const select = wrapper.findComponent({ name: 'Select' })
      await select.setValue('100')

      // Should maintain string type in emitted event
      const emitted = wrapper.emitted('update:modelValue')
      expect(emitted).toBeDefined()
      expect(emitted![0]).toContain('100')
    })
  })
})
