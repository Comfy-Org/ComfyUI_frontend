import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import AssetFilterBar from '@/platform/assets/components/AssetFilterBar.vue'
import type { FilterState } from '@/platform/assets/components/AssetFilterBar.vue'
import {
  createAssetWithSpecificBaseModel,
  createAssetWithSpecificExtension,
  createAssetWithoutBaseModel
} from '@/platform/assets/fixtures/ui-mock-assets'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'

// Mock @/i18n directly since component imports { t } from '@/i18n'
vi.mock('@/i18n', () => ({
  t: (key: string) => key
}))

// Mock components with minimal functionality for business logic testing
vi.mock('@/components/input/MultiSelect.vue', () => ({
  default: {
    name: 'MultiSelect',
    props: {
      modelValue: Array,
      label: String,
      options: Array,
      class: String
    },
    emits: ['update:modelValue'],
    template: `
      <div data-testid="multi-select">
        <select multiple @change="$emit('update:modelValue', Array.from($event.target.selectedOptions).map(o => ({ name: o.text, value: o.value })))">
          <option v-for="option in options" :key="option.value" :value="option.value">
            {{ option.name }}
          </option>
        </select>
      </div>
    `
  }
}))

vi.mock('@/components/input/SingleSelect.vue', () => ({
  default: {
    name: 'SingleSelect',
    props: {
      modelValue: String,
      label: String,
      options: Array,
      class: String
    },
    emits: ['update:modelValue'],
    template: `
      <div data-testid="single-select">
        <select @change="$emit('update:modelValue', $event.target.value)">
          <option v-for="option in options" :key="option.value" :value="option.value">
            {{ option.name }}
          </option>
        </select>
      </div>
    `
  }
}))

// Test factory functions
function mountAssetFilterBar(props = {}) {
  return mount(AssetFilterBar, {
    props,
    global: {
      mocks: {
        $t: (key: string) => key
      }
    }
  })
}

describe('AssetFilterBar', () => {
  describe('Filter State Management', () => {
    it('maintains correct initial state', () => {
      // Provide assets with options so filters are visible
      const assets = [
        createAssetWithSpecificExtension('safetensors'),
        createAssetWithSpecificBaseModel('sd15')
      ]
      const wrapper = mountAssetFilterBar({ assets })

      // Test initial state through component props
      const multiSelects = wrapper.findAllComponents({ name: 'MultiSelect' })
      const singleSelect = wrapper.findComponent({ name: 'SingleSelect' })

      expect(multiSelects[0].props('modelValue')).toEqual([])
      expect(multiSelects[1].props('modelValue')).toEqual([])
      expect(singleSelect.props('modelValue')).toBe('name-asc')
    })

    it('handles multiple simultaneous filter changes correctly', async () => {
      // Provide assets with options so filters are visible
      const assets = [
        createAssetWithSpecificExtension('safetensors'),
        createAssetWithSpecificBaseModel('sd15')
      ]
      const wrapper = mountAssetFilterBar({ assets })

      // Update file formats
      const fileFormatSelect = wrapper.findAllComponents({
        name: 'MultiSelect'
      })[0]
      await fileFormatSelect.vm.$emit('update:modelValue', [
        { name: '.ckpt', value: 'ckpt' },
        { name: '.safetensors', value: 'safetensors' }
      ])

      await nextTick()

      // Update base models
      const baseModelSelect = wrapper.findAllComponents({
        name: 'MultiSelect'
      })[1]
      await baseModelSelect.vm.$emit('update:modelValue', [
        { name: 'SD XL', value: 'sdxl' }
      ])

      await nextTick()

      // Update sort
      const sortSelect = wrapper.findComponent({ name: 'SingleSelect' })
      await sortSelect.vm.$emit('update:modelValue', 'popular')

      await nextTick()

      const emitted = wrapper.emitted('filterChange')
      expect(emitted).toHaveLength(3)

      // Check final state
      const finalState: FilterState = emitted![2][0] as FilterState
      expect(finalState.fileFormats).toEqual(['ckpt', 'safetensors'])
      expect(finalState.baseModels).toEqual(['sdxl'])
      expect(finalState.sortBy).toBe('popular')
    })

    it('ensures FilterState interface compliance', async () => {
      // Provide assets with options so filters are visible
      const assets = [
        createAssetWithSpecificExtension('safetensors'),
        createAssetWithSpecificBaseModel('sd15')
      ]
      const wrapper = mountAssetFilterBar({ assets })

      const fileFormatSelect = wrapper.findAllComponents({
        name: 'MultiSelect'
      })[0]
      await fileFormatSelect.vm.$emit('update:modelValue', [
        { name: '.ckpt', value: 'ckpt' }
      ])

      await nextTick()

      const emitted = wrapper.emitted('filterChange')
      const filterState = emitted![0][0] as FilterState

      // Type and structure assertions
      expect(Array.isArray(filterState.fileFormats)).toBe(true)
      expect(Array.isArray(filterState.baseModels)).toBe(true)
      expect(typeof filterState.sortBy).toBe('string')

      // Value type assertions
      expect(filterState.fileFormats.every((f) => typeof f === 'string')).toBe(
        true
      )
      expect(filterState.baseModels.every((m) => typeof m === 'string')).toBe(
        true
      )
    })
  })

  describe('Dynamic Filter Options', () => {
    it('should use dynamic file format options based on actual assets', () => {
      const assets = [
        createAssetWithSpecificExtension('safetensors'),
        createAssetWithSpecificExtension('ckpt'),
        createAssetWithSpecificExtension('pt')
      ]

      const wrapper = mountAssetFilterBar({ assets })

      const fileFormatSelect = wrapper.findAllComponents({
        name: 'MultiSelect'
      })[0]
      expect(fileFormatSelect.props('options')).toEqual([
        { name: '.ckpt', value: 'ckpt' },
        { name: '.pt', value: 'pt' },
        { name: '.safetensors', value: 'safetensors' }
      ])
    })

    it('should use dynamic base model options based on actual assets', () => {
      const assets = [
        createAssetWithSpecificBaseModel('sd15'),
        createAssetWithSpecificBaseModel('sdxl'),
        createAssetWithSpecificBaseModel('sd35')
      ]

      const wrapper = mountAssetFilterBar({ assets })

      const baseModelSelect = wrapper.findAllComponents({
        name: 'MultiSelect'
      })[1]
      expect(baseModelSelect.props('options')).toEqual([
        { name: 'sd15', value: 'sd15' },
        { name: 'sd35', value: 'sd35' },
        { name: 'sdxl', value: 'sdxl' }
      ])
    })
  })

  describe('Conditional Filter Visibility', () => {
    it('hides file format filter when no options available', () => {
      const assets: AssetItem[] = [] // No assets = no file format options
      const wrapper = mountAssetFilterBar({ assets })

      const fileFormatSelects = wrapper
        .findAllComponents({ name: 'MultiSelect' })
        .filter(
          (component) => component.props('label') === 'assetBrowser.fileFormats'
        )

      expect(fileFormatSelects).toHaveLength(0)
    })

    it('hides base model filter when no options available', () => {
      const assets = [createAssetWithoutBaseModel()] // Asset without base model = no base model options
      const wrapper = mountAssetFilterBar({ assets })

      const baseModelSelects = wrapper
        .findAllComponents({ name: 'MultiSelect' })
        .filter(
          (component) => component.props('label') === 'assetBrowser.baseModels'
        )

      expect(baseModelSelects).toHaveLength(0)
    })

    it('shows both filters when options are available', () => {
      const assets = [
        createAssetWithSpecificExtension('safetensors'),
        createAssetWithSpecificBaseModel('sd15')
      ]
      const wrapper = mountAssetFilterBar({ assets })

      const multiSelects = wrapper.findAllComponents({ name: 'MultiSelect' })
      const fileFormatSelect = multiSelects.find(
        (component) => component.props('label') === 'assetBrowser.fileFormats'
      )
      const baseModelSelect = multiSelects.find(
        (component) => component.props('label') === 'assetBrowser.baseModels'
      )

      expect(fileFormatSelect).toBeDefined()
      expect(baseModelSelect).toBeDefined()
    })

    it('hides both filters when no assets provided', () => {
      const wrapper = mountAssetFilterBar()

      const multiSelects = wrapper.findAllComponents({ name: 'MultiSelect' })
      expect(multiSelects).toHaveLength(0)
    })
  })
})
