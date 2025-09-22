import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import AssetFilterBar from '@/platform/assets/components/AssetFilterBar.vue'
import type { FilterState } from '@/platform/assets/components/AssetFilterBar.vue'

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

describe('AssetFilterBar', () => {
  describe('Filter State Management', () => {
    it('maintains correct initial state', () => {
      const wrapper = mount(AssetFilterBar)

      // Test initial state through component props
      const multiSelects = wrapper.findAllComponents({ name: 'MultiSelect' })
      const singleSelect = wrapper.findComponent({ name: 'SingleSelect' })

      expect(multiSelects[0].props('modelValue')).toEqual([])
      expect(multiSelects[1].props('modelValue')).toEqual([])
      expect(singleSelect.props('modelValue')).toBe('name-asc')
    })

    it('handles multiple simultaneous filter changes correctly', async () => {
      const wrapper = mount(AssetFilterBar)

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
      const wrapper = mount(AssetFilterBar)

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
})
