import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import FormItem from './FormItem.vue'

describe('FormItem', () => {
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
