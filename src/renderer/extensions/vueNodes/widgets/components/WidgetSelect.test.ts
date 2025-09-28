import { mount } from '@vue/test-utils'
import PrimeVue from 'primevue/config'
import Select from 'primevue/select'
import type { SelectProps } from 'primevue/select'
import { describe, expect, it } from 'vitest'

import type { ComboInputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'

import WidgetSelect from './WidgetSelect.vue'
import WidgetSelectDefault from './WidgetSelectDefault.vue'
import WidgetSelectDropdown from './WidgetSelectDropdown.vue'

describe('WidgetSelect Value Binding', () => {
  const createMockWidget = (
    value: string = 'option1',
    options: Partial<
      SelectProps & { values?: string[]; return_index?: boolean }
    > = {},
    callback?: (value: string | number | undefined) => void,
    spec?: ComboInputSpec
  ): SimplifiedWidget<string | number | undefined> => ({
    name: 'test_select',
    type: 'combo',
    value,
    options: {
      values: ['option1', 'option2', 'option3'],
      ...options
    },
    callback,
    spec
  })

  const mountComponent = (
    widget: SimplifiedWidget<string | number | undefined>,
    modelValue: string | number | undefined,
    readonly = false
  ) => {
    return mount(WidgetSelect, {
      props: {
        widget,
        modelValue,
        readonly
      },
      global: {
        plugins: [PrimeVue],
        components: { Select }
      }
    })
  }

  const setSelectValueAndEmit = async (
    wrapper: ReturnType<typeof mount>,
    value: string
  ) => {
    const select = wrapper.findComponent({ name: 'Select' })
    await select.setValue(value)
    return wrapper.emitted('update:modelValue')
  }

  describe('Vue Event Emission', () => {
    it('emits Vue event when selection changes', async () => {
      const widget = createMockWidget('option1')
      const wrapper = mountComponent(widget, 'option1')

      const emitted = await setSelectValueAndEmit(wrapper, 'option2')

      expect(emitted).toBeDefined()
      expect(emitted![0]).toContain('option2')
    })

    it('emits string value for different options', async () => {
      const widget = createMockWidget('option1')
      const wrapper = mountComponent(widget, 'option1')

      const emitted = await setSelectValueAndEmit(wrapper, 'option3')

      expect(emitted).toBeDefined()
      // Should emit the string value
      expect(emitted![0]).toContain('option3')
    })

    it('handles custom option values', async () => {
      const customOptions = ['custom_a', 'custom_b', 'custom_c']
      const widget = createMockWidget('custom_a', { values: customOptions })
      const wrapper = mountComponent(widget, 'custom_a')

      const emitted = await setSelectValueAndEmit(wrapper, 'custom_b')

      expect(emitted).toBeDefined()
      expect(emitted![0]).toContain('custom_b')
    })

    it('handles missing callback gracefully', async () => {
      const widget = createMockWidget('option1', {}, undefined)
      const wrapper = mountComponent(widget, 'option1')

      const emitted = await setSelectValueAndEmit(wrapper, 'option2')

      // Should emit Vue event
      expect(emitted).toBeDefined()
      expect(emitted![0]).toContain('option2')
    })

    it('handles value changes gracefully', async () => {
      const widget = createMockWidget('option1')
      const wrapper = mountComponent(widget, 'option1')

      const emitted = await setSelectValueAndEmit(wrapper, 'option2')

      expect(emitted).toBeDefined()
      expect(emitted![0]).toContain('option2')
    })
  })

  describe('Readonly Mode', () => {
    it('disables the select component when readonly', async () => {
      const widget = createMockWidget('option1')
      const wrapper = mountComponent(widget, 'option1', true)

      const select = wrapper.findComponent({ name: 'Select' })
      expect(select.props('disabled')).toBe(true)
    })
  })

  describe('Option Handling', () => {
    it('handles empty options array', async () => {
      const widget = createMockWidget('', { values: [] })
      const wrapper = mountComponent(widget, '')

      const select = wrapper.findComponent({ name: 'Select' })
      expect(select.props('options')).toEqual([])
    })

    it('handles single option', async () => {
      const widget = createMockWidget('only_option', {
        values: ['only_option']
      })
      const wrapper = mountComponent(widget, 'only_option')

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
      const wrapper = mountComponent(widget, specialOptions[0])

      const emitted = await setSelectValueAndEmit(wrapper, specialOptions[1])

      expect(emitted).toBeDefined()
      expect(emitted![0]).toContain(specialOptions[1])
    })
  })

  describe('Edge Cases', () => {
    it('handles selection of non-existent option gracefully', async () => {
      const widget = createMockWidget('option1')
      const wrapper = mountComponent(widget, 'option1')

      const emitted = await setSelectValueAndEmit(
        wrapper,
        'non_existent_option'
      )

      // Should still emit Vue event with the value
      expect(emitted).toBeDefined()
      expect(emitted![0]).toContain('non_existent_option')
    })

    it('handles numeric string options correctly', async () => {
      const numericOptions = ['1', '2', '10', '100']
      const widget = createMockWidget('1', { values: numericOptions })
      const wrapper = mountComponent(widget, '1')

      const emitted = await setSelectValueAndEmit(wrapper, '100')

      // Should maintain string type in emitted event
      expect(emitted).toBeDefined()
      expect(emitted![0]).toContain('100')
    })
  })

  describe('Spec-aware rendering', () => {
    it('uses dropdown variant when combo spec enables image uploads', () => {
      const spec: ComboInputSpec = {
        type: 'COMBO',
        name: 'test_select',
        image_upload: true
      }
      const widget = createMockWidget('option1', {}, undefined, spec)
      const wrapper = mountComponent(widget, 'option1')

      expect(wrapper.findComponent(WidgetSelectDropdown).exists()).toBe(true)
      expect(wrapper.findComponent(WidgetSelectDefault).exists()).toBe(false)
    })

    it('uses dropdown variant for audio uploads', () => {
      const spec: ComboInputSpec = {
        type: 'COMBO',
        name: 'test_select',
        audio_upload: true
      }
      const widget = createMockWidget('clip.wav', {}, undefined, spec)
      const wrapper = mountComponent(widget, 'clip.wav')
      const dropdown = wrapper.findComponent(WidgetSelectDropdown)

      expect(dropdown.exists()).toBe(true)
      expect(dropdown.props('assetKind')).toBe('audio')
      expect(dropdown.props('allowUpload')).toBe(false)
    })

    it('keeps default select when no spec or media hints are present', () => {
      const widget = createMockWidget('plain', {
        values: ['plain', 'text']
      })
      const wrapper = mountComponent(widget, 'plain')

      expect(wrapper.findComponent(WidgetSelectDefault).exists()).toBe(true)
      expect(wrapper.findComponent(WidgetSelectDropdown).exists()).toBe(false)
    })
  })
})
