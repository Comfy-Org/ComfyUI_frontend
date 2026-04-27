import { render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import PrimeVue from 'primevue/config'
import { defineComponent } from 'vue'
import { describe, expect, it } from 'vitest'

import type { SimplifiedWidget } from '@/types/simplifiedWidget'

import WidgetSelectDefault from './WidgetSelectDefault.vue'

const WidgetLayoutFieldStub = defineComponent({
  name: 'WidgetLayoutField',
  template: '<div><slot /></div>'
})

const SelectPlusStub = defineComponent({
  name: 'SelectPlus',
  props: {
    options: { type: Array, default: () => [] },
    modelValue: { type: String, default: undefined }
  },
  emits: ['update:modelValue', 'show', 'filter'],
  template: `<div data-testid="select-plus" :data-options="JSON.stringify(options)">
    <button data-testid="trigger-show" @click="$emit('show')">show</button>
    <button data-testid="trigger-filter" @click="$emit('filter')">filter</button>
  </div>`
})

function getSelectOptions(): string[] {
  const el = screen.getByTestId('select-plus')
  return JSON.parse(el.getAttribute('data-options') ?? '[]')
}

describe('WidgetSelectDefault', () => {
  const createWidget = (
    values: unknown
  ): SimplifiedWidget<string | undefined> => ({
    name: 'test_combo',
    type: 'combo',
    value: undefined,
    options: { values } as SimplifiedWidget['options']
  })

  function renderComponent(widget: SimplifiedWidget<string | undefined>) {
    return render(WidgetSelectDefault, {
      props: { widget },
      global: {
        plugins: [PrimeVue],
        stubs: {
          SelectPlus: SelectPlusStub,
          WidgetLayoutField: WidgetLayoutFieldStub
        }
      }
    })
  }

  describe('array-valued options', () => {
    it('resolves options from a plain array', () => {
      renderComponent(createWidget(['a', 'b', 'c']))

      expect(getSelectOptions()).toEqual(['a', 'b', 'c'])
    })

    it('reactively updates when widget prop changes', async () => {
      const { rerender } = renderComponent(createWidget(['x', 'y']))

      await rerender({ widget: createWidget(['x', 'y', 'z']) })

      expect(getSelectOptions()).toEqual(['x', 'y', 'z'])
    })
  })

  describe('undefined/empty options', () => {
    it('returns empty array when values is undefined', () => {
      renderComponent(createWidget(undefined))

      expect(getSelectOptions()).toEqual([])
    })
  })

  describe('function-valued options', () => {
    it('resolves options from a function', () => {
      renderComponent(createWidget(() => ['a', 'b', 'c']))

      expect(getSelectOptions()).toEqual(['a', 'b', 'c'])
    })

    it('re-evaluates function on show event', async () => {
      let items = ['x', 'y']
      renderComponent(createWidget(() => items))

      items = ['x', 'y', 'z']
      const user = userEvent.setup()
      await user.click(screen.getByTestId('trigger-show'))

      await waitFor(() => {
        expect(getSelectOptions()).toEqual(['x', 'y', 'z'])
      })
    })

    it('re-evaluates function on filter event', async () => {
      let items = ['a']
      renderComponent(createWidget(() => items))

      items = ['a', 'b']
      const user = userEvent.setup()
      await user.click(screen.getByTestId('trigger-filter'))

      await waitFor(() => {
        expect(getSelectOptions()).toEqual(['a', 'b'])
      })
    })
  })
})
