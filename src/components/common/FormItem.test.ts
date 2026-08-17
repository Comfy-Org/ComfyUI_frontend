import { render, screen } from '@testing-library/vue'
import PrimeVue from 'primevue/config'
import { describe, expect, it } from 'vitest'

import FormItem from '@/components/common/FormItem.vue'

describe('FormItem', () => {
  it('masks a password setting', () => {
    render(FormItem, {
      global: {
        plugins: [PrimeVue],
        directives: { tooltip: {} }
      },
      props: {
        id: 'pack-api-key',
        item: { name: 'API key', type: 'password' },
        formValue: ''
      }
    })

    expect(screen.getByLabelText('API key')).toHaveAttribute('type', 'password')
  })
})
