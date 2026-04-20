/* eslint-disable vue/one-component-per-file */
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { defineComponent, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import type { Bounds } from '@/renderer/core/layout/types'

import WidgetBoundingBox from './WidgetBoundingBox.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      boundingBox: { x: 'X', y: 'Y', width: 'Width', height: 'Height' }
    }
  }
})

const ScrubableNumberInputStub = defineComponent({
  name: 'ScrubableNumberInput',
  props: {
    modelValue: { type: Number, default: 0 },
    min: { type: Number, default: 0 },
    step: { type: Number, default: 1 },
    disabled: { type: Boolean, default: false }
  },
  // eslint-disable-next-line vue/no-unused-emit-declarations
  emits: ['update:modelValue'],
  template: `
    <input
      type="number"
      :value="modelValue"
      :disabled="disabled"
      :data-min="min"
      :data-step="step"
      @input="$emit('update:modelValue', Number(($event.target).value))"
    />
  `
})

function renderBox(initial: Bounds, disabled = false) {
  const value = ref<Bounds>(initial)
  const Harness = defineComponent({
    components: { WidgetBoundingBox },
    setup: () => ({ value, disabled }),
    template: '<WidgetBoundingBox v-model="value" :disabled="disabled" />'
  })
  const utils = render(Harness, {
    global: {
      plugins: [i18n],
      stubs: { ScrubableNumberInput: ScrubableNumberInputStub }
    }
  })
  return { ...utils, value }
}

describe('WidgetBoundingBox', () => {
  describe('Label rendering', () => {
    it('renders labels for x, y, width, and height', () => {
      renderBox({ x: 0, y: 0, width: 100, height: 100 })
      expect(screen.getByText('X')).toBeInTheDocument()
      expect(screen.getByText('Y')).toBeInTheDocument()
      expect(screen.getByText('Width')).toBeInTheDocument()
      expect(screen.getByText('Height')).toBeInTheDocument()
    })
  })

  describe('Initial values', () => {
    it('displays the initial bounds across four inputs', () => {
      renderBox({ x: 10, y: 20, width: 300, height: 400 })
      const inputs = screen.getAllByRole('spinbutton') as HTMLInputElement[]
      expect(inputs.map((i) => i.value)).toEqual(['10', '20', '300', '400'])
    })
  })

  describe('Constraints', () => {
    it('sets min=0 for x/y and min=1 for width/height', () => {
      renderBox({ x: 0, y: 0, width: 1, height: 1 })
      const inputs = screen.getAllByRole('spinbutton')
      expect(inputs[0].dataset.min).toBe('0') // x
      expect(inputs[1].dataset.min).toBe('0') // y
      expect(inputs[2].dataset.min).toBe('1') // width
      expect(inputs[3].dataset.min).toBe('1') // height
    })
  })

  describe('v-model updates', () => {
    it('updates x immutably, preserving y/width/height', async () => {
      const { value } = renderBox({ x: 10, y: 20, width: 100, height: 200 })
      const inputs = screen.getAllByRole('spinbutton') as HTMLInputElement[]
      const user = userEvent.setup()
      await user.clear(inputs[0])
      await user.type(inputs[0], '55')
      expect(value.value).toEqual({
        x: 55,
        y: 20,
        width: 100,
        height: 200
      })
    })

    it('updates height immutably without mutating the original bounds', async () => {
      const initial = { x: 10, y: 20, width: 100, height: 200 }
      const { value } = renderBox(initial)
      const inputs = screen.getAllByRole('spinbutton') as HTMLInputElement[]
      const user = userEvent.setup()
      await user.clear(inputs[3])
      await user.type(inputs[3], '500')
      expect(value.value.height).toBe(500)
      expect(value.value).not.toBe(initial)
    })
  })

  describe('Disabled state', () => {
    it('disables all four inputs when disabled=true', () => {
      renderBox({ x: 0, y: 0, width: 1, height: 1 }, true)
      for (const input of screen.getAllByRole('spinbutton')) {
        expect(input).toBeDisabled()
      }
    })

    it('leaves all four inputs enabled when disabled=false', () => {
      renderBox({ x: 0, y: 0, width: 1, height: 1 }, false)
      for (const input of screen.getAllByRole('spinbutton')) {
        expect(input).not.toBeDisabled()
      }
    })
  })
})
