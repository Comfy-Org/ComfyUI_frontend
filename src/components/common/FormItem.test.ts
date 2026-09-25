import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
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
        ],
        directives: { tooltip: {} }
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

  it.for(['slider', 'knob'] as const)(
    'labels both controls in a %s field',
    (type) => {
      render(FormItem, {
        props: {
          formValue: 5,
          id: type,
          item: { name: 'Volume', type }
        },
        global: {
          plugins: [
            createI18n({
              legacy: false,
              locale: 'en',
              messages: { en: enMessages }
            })
          ],
          directives: { tooltip: {} }
        }
      })

      expect(screen.getAllByLabelText('Volume')).toHaveLength(2)
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
        ],
        directives: { tooltip: {} }
      }
    })

    expect(screen.getByRole('spinbutton', { name: 'Volume' })).toBeDisabled()
  })
})
