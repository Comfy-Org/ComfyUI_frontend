import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import FieldSwitch from './FieldSwitch.vue'

describe('FieldSwitch', () => {
  it('forwards its identity and visible label to the switch', () => {
    render(FieldSwitch, {
      props: { id: 'enable-preview', label: 'Enable preview' },
      global: {
        directives: { tooltip: {} }
      }
    })

    const control = screen.getByRole('switch', { name: 'Enable preview' })
    expect(control).toHaveAttribute('id', 'enable-preview')
  })
})
