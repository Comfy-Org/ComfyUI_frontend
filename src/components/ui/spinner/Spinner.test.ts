import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import Spinner from './Spinner.vue'

describe('Spinner', () => {
  it('names indeterminate progress with the supplied label and updates it', async () => {
    const { rerender } = render(Spinner, {
      props: { loadingLabel: 'Chargement' }
    })

    expect(
      screen.getByRole('progressbar', { name: 'Chargement' })
    ).not.toHaveAttribute('aria-valuenow')

    await rerender({ loadingLabel: 'Loading nodes' })

    expect(
      screen.getByRole('progressbar', { name: 'Loading nodes' })
    ).toBeInTheDocument()
  })
})
