import { createTestingPinia } from '@pinia/testing'
import { mount } from '@vue/test-utils'
import type { VueWrapper } from '@vue/test-utils'
import PrimeVue from 'primevue/config'
import type { ComponentPublicInstance } from 'vue'
import { describe, expect, it, vi } from 'vitest'

import type { ComboInputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'
import type { DropdownItem } from '@/renderer/extensions/vueNodes/widgets/components/form/dropdown/types'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'

import WidgetSelectDropdown from '@/renderer/extensions/vueNodes/widgets/components/WidgetSelectDropdown.vue'

interface WidgetSelectDropdownInstance extends ComponentPublicInstance {
  inputItems: DropdownItem[]
  outputItems: DropdownItem[]
  updateSelectedItems: (selectedSet: Set<string>) => void
}

describe('WidgetSelectDropdown custom label mapping', () => {
  const createMockWidget = (
    value: string = 'img_001.png',
    options: {
      values?: string[]
      getOptionLabel?: (value: string | null) => string
    } = {},
    spec?: ComboInputSpec
  ): SimplifiedWidget<string | undefined> => ({
    name: 'test_image_select',
    type: 'combo',
    value,
    options: {
      values: ['img_001.png', 'photo_abc.jpg', 'hash789.png'],
      ...options
    },
    spec
  })

  const mountComponent = (
    widget: SimplifiedWidget<string | undefined>,
    modelValue: string | undefined,
    assetKind: 'image' | 'video' | 'audio' = 'image'
  ): VueWrapper<WidgetSelectDropdownInstance> => {
    return mount(WidgetSelectDropdown, {
      props: {
        widget,
        modelValue,
        assetKind,
        allowUpload: true,
        uploadFolder: 'input'
      },
      global: {
        plugins: [PrimeVue, createTestingPinia()]
      }
    }) as unknown as VueWrapper<WidgetSelectDropdownInstance>
  }

  describe('when custom labels are not provided', () => {
    it('uses values as labels when no mapping provided', () => {
      const widget = createMockWidget('img_001.png')
      const wrapper = mountComponent(widget, 'img_001.png')

      const inputItems = wrapper.vm.inputItems
      expect(inputItems).toHaveLength(3)
      expect(inputItems[0].name).toBe('img_001.png')
      expect(inputItems[0].label).toBe('img_001.png')
      expect(inputItems[1].name).toBe('photo_abc.jpg')
      expect(inputItems[1].label).toBe('photo_abc.jpg')
      expect(inputItems[2].name).toBe('hash789.png')
      expect(inputItems[2].label).toBe('hash789.png')
    })
  })

  describe('when custom labels are provided via getOptionLabel', () => {
    it('displays custom labels while preserving original values', () => {
      const getOptionLabel = vi.fn((value: string | null) => {
        if (!value) return 'No file'
        const mapping: Record<string, string> = {
          'img_001.png': 'Vacation Photo',
          'photo_abc.jpg': 'Family Portrait',
          'hash789.png': 'Sunset Beach'
        }
        return mapping[value] || value
      })

      const widget = createMockWidget('img_001.png', {
        getOptionLabel
      })
      const wrapper = mountComponent(widget, 'img_001.png')

      const inputItems = wrapper.vm.inputItems
      expect(inputItems).toHaveLength(3)
      expect(inputItems[0].name).toBe('img_001.png')
      expect(inputItems[0].label).toBe('Vacation Photo')
      expect(inputItems[1].name).toBe('photo_abc.jpg')
      expect(inputItems[1].label).toBe('Family Portrait')
      expect(inputItems[2].name).toBe('hash789.png')
      expect(inputItems[2].label).toBe('Sunset Beach')

      expect(getOptionLabel).toHaveBeenCalledWith('img_001.png')
      expect(getOptionLabel).toHaveBeenCalledWith('photo_abc.jpg')
      expect(getOptionLabel).toHaveBeenCalledWith('hash789.png')
    })

    it('emits original values when items with custom labels are selected', async () => {
      const getOptionLabel = vi.fn((value: string | null) => {
        if (!value) return 'No file'
        return `Custom: ${value}`
      })

      const widget = createMockWidget('img_001.png', {
        getOptionLabel
      })
      const wrapper = mountComponent(widget, 'img_001.png')

      // Simulate selecting an item
      const selectedSet = new Set(['input-1']) // index 1 = photo_abc.jpg
      wrapper.vm.updateSelectedItems(selectedSet)

      // Should emit the original value, not the custom label
      expect(wrapper.emitted('update:modelValue')).toBeDefined()
      expect(wrapper.emitted('update:modelValue')![0]).toEqual([
        'photo_abc.jpg'
      ])
    })

    it('falls back to original value when label mapping fails', () => {
      const getOptionLabel = vi.fn((value: string | null) => {
        if (value === 'photo_abc.jpg') {
          throw new Error('Mapping failed')
        }
        return `Labeled: ${value}`
      })

      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {})

      const widget = createMockWidget('img_001.png', {
        getOptionLabel
      })
      const wrapper = mountComponent(widget, 'img_001.png')

      const inputItems = wrapper.vm.inputItems
      expect(inputItems[0].name).toBe('img_001.png')
      expect(inputItems[0].label).toBe('Labeled: img_001.png')
      expect(inputItems[1].name).toBe('photo_abc.jpg')
      expect(inputItems[1].label).toBe('photo_abc.jpg')
      expect(inputItems[2].name).toBe('hash789.png')
      expect(inputItems[2].label).toBe('Labeled: hash789.png')

      expect(consoleErrorSpy).toHaveBeenCalled()
      consoleErrorSpy.mockRestore()
    })
  })

  describe('output items with custom label mapping', () => {
    it('applies custom label mapping to output items from queue history', () => {
      const getOptionLabel = vi.fn((value: string | null) => {
        if (!value) return 'No file'
        return `Output: ${value}`
      })

      const widget = createMockWidget('img_001.png', {
        getOptionLabel
      })
      const wrapper = mountComponent(widget, 'img_001.png')

      const outputItems = wrapper.vm.outputItems
      expect(outputItems).toBeDefined()
      expect(Array.isArray(outputItems)).toBe(true)
    })
  })

  describe('missing value handling for template-loaded nodes', () => {
    it('creates a fallback item in "all" filter when modelValue is not in available items', () => {
      const widget = createMockWidget('template_image.png', {
        values: ['img_001.png', 'photo_abc.jpg']
      })
      const wrapper = mountComponent(widget, 'template_image.png')

      const inputItems = wrapper.vm.inputItems
      expect(inputItems).toHaveLength(2)
      expect(
        inputItems.some((item) => item.name === 'template_image.png')
      ).toBe(false)

      // The missing value should be accessible via dropdownItems when filter is 'all' (default)
      const dropdownItems = (
        wrapper.vm as unknown as { dropdownItems: DropdownItem[] }
      ).dropdownItems
      expect(
        dropdownItems.some((item) => item.name === 'template_image.png')
      ).toBe(true)
      expect(dropdownItems[0].name).toBe('template_image.png')
      expect(dropdownItems[0].id).toBe('missing-template_image.png')
    })

    it('does not include fallback item when filter is "inputs"', async () => {
      const widget = createMockWidget('template_image.png', {
        values: ['img_001.png', 'photo_abc.jpg']
      })
      const wrapper = mountComponent(widget, 'template_image.png')

      const vmWithFilter = wrapper.vm as unknown as {
        filterSelected: string
        dropdownItems: DropdownItem[]
      }

      vmWithFilter.filterSelected = 'inputs'
      await wrapper.vm.$nextTick()

      const dropdownItems = vmWithFilter.dropdownItems
      expect(dropdownItems).toHaveLength(2)
      expect(
        dropdownItems.every((item) => !String(item.id).startsWith('missing-'))
      ).toBe(true)
    })

    it('does not include fallback item when filter is "outputs"', async () => {
      const widget = createMockWidget('template_image.png', {
        values: ['img_001.png', 'photo_abc.jpg']
      })
      const wrapper = mountComponent(widget, 'template_image.png')

      const vmWithFilter = wrapper.vm as unknown as {
        filterSelected: string
        dropdownItems: DropdownItem[]
        outputItems: DropdownItem[]
      }

      vmWithFilter.filterSelected = 'outputs'
      await wrapper.vm.$nextTick()

      const dropdownItems = vmWithFilter.dropdownItems
      expect(dropdownItems).toHaveLength(wrapper.vm.outputItems.length)
      expect(
        dropdownItems.every((item) => !String(item.id).startsWith('missing-'))
      ).toBe(true)
    })

    it('does not create a fallback item when modelValue exists in available items', () => {
      const widget = createMockWidget('img_001.png', {
        values: ['img_001.png', 'photo_abc.jpg']
      })
      const wrapper = mountComponent(widget, 'img_001.png')

      const dropdownItems = (
        wrapper.vm as unknown as { dropdownItems: DropdownItem[] }
      ).dropdownItems
      expect(dropdownItems).toHaveLength(2)
      expect(
        dropdownItems.every((item) => !String(item.id).startsWith('missing-'))
      ).toBe(true)
    })

    it('does not create a fallback item when modelValue is undefined', () => {
      const widget = createMockWidget(undefined as unknown as string, {
        values: ['img_001.png', 'photo_abc.jpg']
      })
      const wrapper = mountComponent(widget, undefined)

      const dropdownItems = (
        wrapper.vm as unknown as { dropdownItems: DropdownItem[] }
      ).dropdownItems
      expect(dropdownItems).toHaveLength(2)
      expect(
        dropdownItems.every((item) => !String(item.id).startsWith('missing-'))
      ).toBe(true)
    })
  })
})
