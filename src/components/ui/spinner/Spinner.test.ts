import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import Spinner from './Spinner.vue'

describe('Spinner', () => {
  it('exposes loading status with a consumer-provided label', () => {
    render(Spinner, { attrs: { 'aria-label': 'Loading nodes' } })

    expect(
      screen.getByRole('status', { name: 'Loading nodes' })
    ).toBeInTheDocument()
  })
})
