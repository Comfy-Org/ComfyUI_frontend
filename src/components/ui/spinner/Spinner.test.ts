import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import Spinner from './Spinner.vue'

describe('Spinner', () => {
  it('names indeterminate progress in the current locale and allows a contextual label', async () => {
    const { rerender } = render(Spinner, {
      global: {
        plugins: [
          createI18n({
            legacy: false,
            locale: 'fr',
            messages: { fr: { g: { loading: 'Chargement' } } }
          })
        ]
      }
    })

    expect(
      screen.getByRole('progressbar', { name: 'Chargement' })
    ).not.toHaveAttribute('aria-valuenow')

    await rerender({ 'aria-label': 'Loading nodes' })

    expect(
      screen.getByRole('progressbar', { name: 'Loading nodes' })
    ).toBeInTheDocument()
  })
})
