import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import FieldSwitch from './FieldSwitch.vue'

describe('FieldSwitch', () => {
  it('uses its visible label as the switch accessible name', () => {
    render(FieldSwitch, {
      props: { label: 'Enable preview' },
      global: {
        directives: { tooltip: {} }
      }
    })

    expect(
      screen.getByRole('switch', { name: 'Enable preview' })
    ).toBeInTheDocument()
  })
})
