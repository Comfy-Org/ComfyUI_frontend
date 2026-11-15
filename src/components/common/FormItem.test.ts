import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import { defineComponent, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import FormItem from './FormItem.vue'

describe('FormItem', () => {
  it('passes a nullable number value to the number field', () => {
    render(FormItem, {
      props: {
        formValue: null,
        id: 'device',
        item: { name: 'CUDA device', type: 'number' }
      },
      global: {
        plugins: [
          createI18n({
            legacy: false,
            locale: 'en',
            messages: { en: enMessages }
          })
        ]
      }
    })

    expect(screen.getByRole('spinbutton', { name: 'CUDA device' })).toHaveValue(
      ''
    )
  })

  it('renders radio option labels', () => {
    render(FormItem, {
      props: {
        formValue: 'enabled',
        id: 'mode',
        item: {
          name: 'Mode',
          type: 'radio',
          options: [
            { text: 'Enabled', value: 'enabled' },
            { text: 'Disabled', value: 'disabled' }
          ]
        }
      }
    })

    expect(screen.getByRole('radio', { name: 'Enabled' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Disabled' })).toBeInTheDocument()
  })

  it.for(['combo', 'radio'] as const)(
    'renders %s options derived from the current value',
    async (type) => {
      const { rerender } = render(FormItem, {
        props: {
          formValue: 'enabled',
          id: 'mode',
          item: {
            name: 'Mode',
            type,
            options: (value: unknown) => [
              { text: `${value} option`, value: String(value) }
            ]
          }
        },
        global: {
          plugins: [
            createI18n({
              legacy: false,
              locale: 'en',
              messages: { en: enMessages }
            })
          ]
        }
      })

      expect(await screen.findByText('enabled option')).toBeInTheDocument()
      await rerender({ formValue: 'disabled' })
      expect(await screen.findByText('disabled option')).toBeInTheDocument()
    }
  )

  it.for([
    {
      type: 'slider',
      min: 2,
      max: 256,
      step: 2,
      input: '7',
      expected: '8',
      commit: '{Enter}'
    },
    {
      type: 'knob',
      min: 0,
      max: 6,
      step: 1,
      input: '3.7',
      expected: '4',
      commit: '{Tab}'
    },
    {
      type: 'slider',
      min: 100,
      max: 1000,
      step: 50,
      input: '326',
      expected: '350',
      commit: '{Tab}'
    }
  ])(
    'commits $input as $expected for a $type with step $step',
    async ({ type, min, max, step, input, expected, commit }) => {
      const user = userEvent.setup()
      render(
        defineComponent({
          components: { FormItem },
          setup() {
            return { value: ref(min), type, attrs: { min, max, step } }
          },
          template: `
            <FormItem
              v-model:form-value="value"
              :item="{ name: 'Volume', type, attrs }"
              :id="type"
            />
            <output>{{ value }}</output>
          `
        }),
        {
          global: {
            plugins: [
              createI18n({
                legacy: false,
                locale: 'en',
                messages: { en: enMessages }
              })
            ]
          }
        }
      )

      expect(screen.getAllByLabelText('Volume')).toHaveLength(2)
      const numberInput = screen.getByRole('spinbutton', { name: 'Volume' })
      await user.clear(numberInput)
      await user.type(numberInput, input)
      await user.keyboard(commit)
      expect(screen.getByRole('status').textContent).toBe(expected)
      expect(numberInput).toHaveValue(expected)
    }
  )

  it('disables numeric entry in a knob field', () => {
    render(FormItem, {
      props: {
        formValue: 5,
        id: 'volume',
        item: {
          name: 'Volume',
          type: 'knob',
          attrs: { disabled: true }
        }
      },
      global: {
        plugins: [
          createI18n({
            legacy: false,
            locale: 'en',
            messages: { en: enMessages }
          })
        ]
      }
    })

    expect(screen.getByRole('spinbutton', { name: 'Volume' })).toBeDisabled()
  })
})
