import { createTestingPinia } from '@pinia/testing'
import { mount } from '@vue/test-utils'
import PrimeVue from 'primevue/config'
import Select from 'primevue/select'
import type { SelectProps } from 'primevue/select'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref, watch } from 'vue'

import type { ComboInputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'

import WidgetSelect from '@/renderer/extensions/vueNodes/widgets/components/WidgetSelect.vue'
import WidgetSelectDefault from '@/renderer/extensions/vueNodes/widgets/components/WidgetSelectDefault.vue'
import WidgetSelectDropdown from '@/renderer/extensions/vueNodes/widgets/components/WidgetSelectDropdown.vue'

// Mock state for distribution and settings
const mockDistributionState = vi.hoisted(() => ({ isCloud: false }))
const mockSettingStoreGet = vi.hoisted(() => vi.fn(() => false))
const mockIsAssetBrowserEligible = vi.hoisted(() => vi.fn(() => false))

vi.mock('@/platform/distribution/types', () => ({
  get isCloud() {
    return mockDistributionState.isCloud
  }
}))

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: vi.fn(() => ({
    get: mockSettingStoreGet
  }))
}))

vi.mock('@/platform/assets/services/assetService', () => ({
  assetService: {
    isAssetBrowserEligible: mockIsAssetBrowserEligible
  }
}))

describe('WidgetSelect Value Binding', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    mockDistributionState.isCloud = false
    mockSettingStoreGet.mockReturnValue(false)
    mockIsAssetBrowserEligible.mockReturnValue(false)
    vi.clearAllMocks()
  })

  const createMockWidget = (
    value: string = 'option1',
    options: Partial<
      SelectProps & { values?: string[]; return_index?: boolean }
    > = {},
    callback?: (value: string | undefined) => void,
    spec?: ComboInputSpec
  ): SimplifiedWidget<string | undefined> => {
    const valueRef = ref(value)
    if (callback) watch(valueRef, (v) => callback(v))
    return {
      name: 'test_select',
      type: 'combo',
      value: () => valueRef,
      options: {
        values: ['option1', 'option2', 'option3'],
        ...options
      },
      spec
    }
  }

  const mountComponent = (
    widget: SimplifiedWidget<string | undefined>,
    modelValue: string | undefined,
    readonly = false
  ) => {
    return mount(WidgetSelect, {
      props: {
        widget,
        modelValue,
        readonly
      },
      global: {
        plugins: [PrimeVue, createTestingPinia()],
        components: { Select }
      }
    })
  }

  const setSelectValue = async (
    wrapper: ReturnType<typeof mount>,
    value: string
  ) => {
    const select = wrapper.findComponent({ name: 'Select' })
    await select.setValue(value)
  }

  describe('Widget Value Callbacks', () => {
    it('triggers callback when selection changes', async () => {
      const callback = vi.fn()
      const widget = createMockWidget('option1', {}, callback)
      const wrapper = mountComponent(widget, 'option1')

      await setSelectValue(wrapper, 'option2')

      expect(callback).toHaveBeenCalledExactlyOnceWith('option2')
    })

    it('handles string value for different options', async () => {
      const callback = vi.fn()
      const widget = createMockWidget('option1', {}, callback)
      const wrapper = mountComponent(widget, 'option1')

      await setSelectValue(wrapper, 'option3')
      expect(callback).toHaveBeenCalledExactlyOnceWith('option3')
    })

    it('handles custom option values', async () => {
      const customOptions = ['custom_a', 'custom_b', 'custom_c']
      const callback = vi.fn()
      const widget = createMockWidget(
        'custom_a',
        { values: customOptions },
        callback
      )
      const wrapper = mountComponent(widget, 'custom_a')

      await setSelectValue(wrapper, 'custom_b')

      expect(callback).toHaveBeenCalledExactlyOnceWith('custom_b')
    })

    it('handles value changes gracefully', async () => {
      const callback = vi.fn()
      const widget = createMockWidget('option1', {}, callback)
      const wrapper = mountComponent(widget, 'option1')

      await setSelectValue(wrapper, 'option2')

      expect(callback).toHaveBeenCalledExactlyOnceWith('option2')
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
      const callback = vi.fn()
      const widget = createMockWidget(
        specialOptions[0],
        {
          values: specialOptions
        },
        callback
      )
      const wrapper = mountComponent(widget, specialOptions[0])

      await setSelectValue(wrapper, specialOptions[1])

      expect(callback).toHaveBeenCalledExactlyOnceWith(specialOptions[1])
    })
  })

  describe('Edge Cases', () => {
    it('handles selection of non-existent option gracefully', async () => {
      const callback = vi.fn()
      const widget = createMockWidget('option1', {}, callback)
      const wrapper = mountComponent(widget, 'option1')

      await setSelectValue(wrapper, 'non_existent_option')

      // Should still trigger callback with the value
      expect(callback).toHaveBeenCalledExactlyOnceWith('non_existent_option')
    })

    it('handles numeric string options correctly', async () => {
      const callback = vi.fn()
      const numericOptions = ['1', '2', '10', '100']
      const widget = createMockWidget('1', { values: numericOptions }, callback)
      const wrapper = mountComponent(widget, '1')

      await setSelectValue(wrapper, '100')

      expect(callback).toHaveBeenCalledExactlyOnceWith('100')
    })
  })

  describe('node-type prop passing', () => {
    it('passes node-type prop to WidgetSelectDropdown', () => {
      const spec: ComboInputSpec = {
        type: 'COMBO',
        name: 'test_select',
        image_upload: true
      }
      const widget = createMockWidget('option1', {}, undefined, spec)
      const wrapper = mount(WidgetSelect, {
        props: {
          widget,
          modelValue: 'option1',
          nodeType: 'CheckpointLoaderSimple'
        },
        global: {
          plugins: [PrimeVue, createTestingPinia()],
          components: { Select }
        }
      })

      const dropdown = wrapper.findComponent(WidgetSelectDropdown)
      expect(dropdown.exists()).toBe(true)
      expect(dropdown.props('nodeType')).toBe('CheckpointLoaderSimple')
    })

    it('does not pass node-type prop to WidgetSelectDefault', () => {
      const widget = createMockWidget('option1')
      const wrapper = mount(WidgetSelect, {
        props: {
          widget,
          modelValue: 'option1',
          nodeType: 'KSampler'
        },
        global: {
          plugins: [PrimeVue, createTestingPinia()],
          components: { Select }
        }
      })

      const defaultSelect = wrapper.findComponent(WidgetSelectDefault)
      expect(defaultSelect.exists()).toBe(true)
    })
  })

  describe('Asset mode detection', () => {
    it('enables asset mode when all conditions are met', () => {
      mockDistributionState.isCloud = true
      mockSettingStoreGet.mockReturnValue(true)
      mockIsAssetBrowserEligible.mockReturnValue(true)

      const widget = createMockWidget('test.safetensors')
      const wrapper = mount(WidgetSelect, {
        props: {
          widget,
          modelValue: 'test.safetensors',
          nodeType: 'CheckpointLoaderSimple'
        },
        global: {
          plugins: [PrimeVue, createTestingPinia()],
          components: { Select }
        }
      })

      expect(wrapper.findComponent(WidgetSelectDropdown).exists()).toBe(true)
    })

    it('disables asset mode when conditions are not met', () => {
      mockDistributionState.isCloud = false

      const widget = createMockWidget('test.safetensors')
      const wrapper = mount(WidgetSelect, {
        props: {
          widget,
          modelValue: 'test.safetensors',
          nodeType: 'CheckpointLoaderSimple'
        },
        global: {
          plugins: [PrimeVue, createTestingPinia()],
          components: { Select }
        }
      })

      expect(wrapper.findComponent(WidgetSelectDefault).exists()).toBe(true)
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

    it('uses dropdown variant for audio uploads', (context) => {
      context.skip('allowUpload is not false, should it be? needs diagnosis')
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
