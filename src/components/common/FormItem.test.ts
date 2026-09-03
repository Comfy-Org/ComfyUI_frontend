import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import FormItem from './FormItem.vue'

describe('FormItem', () => {
  it('normalizes a nullable number value for the stepper', () => {
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

    expect(screen.getByRole('spinbutton')).toHaveValue('0')
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
})
