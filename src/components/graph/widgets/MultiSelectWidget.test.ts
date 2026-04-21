/* eslint-disable vue/one-component-per-file */
import { render, screen } from '@testing-library/vue'
import PrimeVue from 'primevue/config'
import { describe, expect, it } from 'vitest'
import { defineComponent, ref } from 'vue'

import type { ComboInputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'
import type { ComponentWidget } from '@/scripts/domWidget'

import MultiSelectWidget from './MultiSelectWidget.vue'

const MultiSelectStub = defineComponent({
  name: 'MultiSelect',
  inheritAttrs: false,
  props: {
    modelValue: { type: Array, default: () => [] },
    options: { type: Array, default: () => [] },
    placeholder: { type: String, default: '' },
    display: { type: String, default: '' }
  },
  template: `<div data-testid="multiselect"
    :data-options="JSON.stringify(options)"
    :data-placeholder="placeholder"
    :data-display="display"
    :data-model-value="JSON.stringify(modelValue)" />`
})

function makeWidget(
  inputSpec: Partial<ComboInputSpec>
): ComponentWidget<string[]> {
  return {
    name: 'multi',
    inputSpec: {
      type: 'COMBO',
      name: 'multi',
      ...inputSpec
    } as ComboInputSpec
  } as unknown as ComponentWidget<string[]>
}

function renderWidget(
  inputSpec: Partial<ComboInputSpec>,
  initialValue: string[] = []
) {
  const value = ref<string[]>(initialValue)
  const widget = makeWidget(inputSpec)
  const Harness = defineComponent({
    components: { MultiSelectWidget },
    setup: () => ({ value, widget }),
    template: '<MultiSelectWidget v-model="value" :widget="widget" />'
  })
  const utils = render(Harness, {
    global: { plugins: [PrimeVue], stubs: { MultiSelect: MultiSelectStub } }
  })
  return { ...utils, value }
}

describe('MultiSelectWidget', () => {
  describe('Option list', () => {
    it('passes inputSpec.options through as MultiSelect options', () => {
      renderWidget({ options: ['a', 'b', 'c'] })
      const el = screen.getByTestId('multiselect')
      expect(JSON.parse(el.dataset.options!)).toEqual(['a', 'b', 'c'])
    })

    it('falls back to an empty list when inputSpec.options is absent', () => {
      renderWidget({})
      const el = screen.getByTestId('multiselect')
      expect(JSON.parse(el.dataset.options!)).toEqual([])
    })
  })

  describe('Placeholder', () => {
    it('reads placeholder from multi_select.placeholder', () => {
      renderWidget({
        options: ['a'],
        multi_select: { placeholder: 'Pick one or more' }
      })
      expect(screen.getByTestId('multiselect').dataset.placeholder).toBe(
        'Pick one or more'
      )
    })

    it('defaults placeholder to "Select items" when not provided', () => {
      renderWidget({ options: ['a'] })
      expect(screen.getByTestId('multiselect').dataset.placeholder).toBe(
        'Select items'
      )
    })
  })

  describe('Display mode', () => {
    it('uses "chip" display when multi_select.chip is true', () => {
      renderWidget({ options: ['a'], multi_select: { chip: true } })
      expect(screen.getByTestId('multiselect').dataset.display).toBe('chip')
    })

    it('uses "comma" display when chip is false or missing', () => {
      renderWidget({ options: ['a'], multi_select: { chip: false } })
      expect(screen.getByTestId('multiselect').dataset.display).toBe('comma')
    })

    it('uses "comma" display when multi_select is absent', () => {
      renderWidget({ options: ['a'] })
      expect(screen.getByTestId('multiselect').dataset.display).toBe('comma')
    })
  })

  describe('Value binding', () => {
    it('forwards the initial selected items to MultiSelect', () => {
      renderWidget({ options: ['a', 'b'] }, ['a'])
      const el = screen.getByTestId('multiselect')
      expect(JSON.parse(el.dataset.modelValue!)).toEqual(['a'])
    })
  })
})
