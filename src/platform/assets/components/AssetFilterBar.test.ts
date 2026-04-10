/* eslint-disable testing-library/no-container */
/* eslint-disable testing-library/no-node-access */
/* eslint-disable testing-library/prefer-user-event */
import { fireEvent, render } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import AssetFilterBar from '@/platform/assets/components/AssetFilterBar.vue'
import {
  createAssetWithSpecificBaseModel,
  createAssetWithSpecificExtension,
  createAssetWithoutBaseModel
} from '@/platform/assets/fixtures/ui-mock-assets'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import type { AssetFilterState } from '@/platform/assets/types/filterTypes'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {}
  }
})

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
  const onFilterChange = vi.fn()
  const { container } = render(AssetFilterBar, {
    props: { ...props, onFilterChange },
    global: {
      plugins: [i18n]
    }
  })
  return { container, onFilterChange }
}

// Helper functions to find filters by user-facing attributes
function findFileFormatsFilter(container: Element) {
  return container.querySelector(
    '[data-component-id="asset-filter-file-formats"]'
  )
}

function findBaseModelsFilter(container: Element) {
  return container.querySelector(
    '[data-component-id="asset-filter-base-models"]'
  )
}

function findSortFilter(container: Element) {
  return container.querySelector('[data-component-id="asset-filter-sort"]')
}

describe('AssetFilterBar', () => {
  describe('Filter State Management', () => {
    it('handles multiple simultaneous filter changes correctly', async () => {
      // Provide assets with options so filters are visible
      const assets = [
        createAssetWithSpecificExtension('safetensors'),
        createAssetWithSpecificExtension('ckpt'),
        createAssetWithSpecificBaseModel('sd15'),
        createAssetWithSpecificBaseModel('sdxl')
      ]
      const { container, onFilterChange } = mountAssetFilterBar({ assets })

      // Update file formats
      const fileFormatEl = findFileFormatsFilter(container)!
      const fileFormatSelectEl = fileFormatEl.querySelector(
        'select'
      ) as HTMLSelectElement
      const fileFormatOptions = fileFormatEl.querySelectorAll('option')
      const ckptOption = Array.from(fileFormatOptions).find(
        (o) => (o as HTMLOptionElement).value === 'ckpt'
      ) as HTMLOptionElement
      const safetensorsOption = Array.from(fileFormatOptions).find(
        (o) => (o as HTMLOptionElement).value === 'safetensors'
      ) as HTMLOptionElement
      ckptOption.selected = true
      safetensorsOption.selected = true
      await fireEvent.change(fileFormatSelectEl)

      await nextTick()

      // Update base models
      const baseModelEl = findBaseModelsFilter(container)!
      const baseModelSelectEl = baseModelEl.querySelector(
        'select'
      ) as HTMLSelectElement
      const baseModelOptions = baseModelEl.querySelectorAll('option')
      const sdxlOption = Array.from(baseModelOptions).find(
        (o) => (o as HTMLOptionElement).value === 'sdxl'
      ) as HTMLOptionElement
      sdxlOption.selected = true
      await fireEvent.change(baseModelSelectEl)

      await nextTick()

      // Update sort
      const sortEl = findSortFilter(container)!
      const sortSelectEl = sortEl.querySelector('select') as HTMLSelectElement
      sortSelectEl.value = 'name-desc'
      await fireEvent.change(sortSelectEl)

      await nextTick()

      expect(onFilterChange).toHaveBeenCalled()
      expect(onFilterChange.mock.calls.length).toBeGreaterThanOrEqual(3)

      // Check final state
      const lastCall =
        onFilterChange.mock.calls[onFilterChange.mock.calls.length - 1]
      const finalState: AssetFilterState = lastCall[0]
      expect(finalState.fileFormats).toEqual(['ckpt', 'safetensors'])
      expect(finalState.baseModels).toEqual(['sdxl'])
      expect(finalState.sortBy).toBe('name-desc')
      expect(finalState.ownership).toBe('all')
    })

    it('ensures AssetFilterState interface compliance', async () => {
      // Provide assets with options so filters are visible
      const assets = [
        createAssetWithSpecificExtension('safetensors'),
        createAssetWithSpecificBaseModel('sd15')
      ]
      const { container, onFilterChange } = mountAssetFilterBar({ assets })

      const fileFormatEl = findFileFormatsFilter(container)!
      const fileFormatSelectEl = fileFormatEl.querySelector(
        'select'
      ) as HTMLSelectElement
      const firstOption = fileFormatEl.querySelector(
        'option'
      ) as HTMLOptionElement
      firstOption.selected = true
      await fireEvent.change(fileFormatSelectEl)

      await nextTick()

      expect(onFilterChange).toHaveBeenCalled()
      const filterState: AssetFilterState = onFilterChange.mock.calls[0][0]

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

      const { container } = mountAssetFilterBar({ assets })

      const fileFormatEl = findFileFormatsFilter(container)!
      const options = fileFormatEl.querySelectorAll('option')
      expect(
        Array.from(options).map((o) => ({
          name: o.textContent?.trim(),
          value: (o as HTMLOptionElement).value
        }))
      ).toEqual([
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

      const { container } = mountAssetFilterBar({ assets })

      const baseModelEl = findBaseModelsFilter(container)!
      const options = baseModelEl.querySelectorAll('option')
      expect(
        Array.from(options).map((o) => ({
          name: o.textContent?.trim(),
          value: (o as HTMLOptionElement).value
        }))
      ).toEqual([
        { name: 'sd15', value: 'sd15' },
        { name: 'sd35', value: 'sd35' },
        { name: 'sdxl', value: 'sdxl' }
      ])
    })
  })

  describe('Conditional Filter Visibility', () => {
    it('hides file format filter when no options available', () => {
      const assets: AssetItem[] = [] // No assets = no file format options
      const { container } = mountAssetFilterBar({ assets })

      expect(findFileFormatsFilter(container)).toBeNull()
    })

    it('hides base model filter when no options available', () => {
      const assets = [createAssetWithoutBaseModel()] // Asset without base model = no base model options
      const { container } = mountAssetFilterBar({ assets })

      expect(findBaseModelsFilter(container)).toBeNull()
    })

    it('shows both filters when options are available', () => {
      const assets = [
        createAssetWithSpecificExtension('safetensors'),
        createAssetWithSpecificBaseModel('sd15')
      ]
      const { container } = mountAssetFilterBar({ assets })

      expect(findFileFormatsFilter(container)).not.toBeNull()
      expect(findBaseModelsFilter(container)).not.toBeNull()
    })

    it('hides both filters when no assets provided', () => {
      const { container } = mountAssetFilterBar()

      expect(findFileFormatsFilter(container)).toBeNull()
      expect(findBaseModelsFilter(container)).toBeNull()
    })
  })
})
