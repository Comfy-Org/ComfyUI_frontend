import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import AppSpinner from './AppSpinner.vue'

describe('AppSpinner', () => {
  it.for(['ring', 'dots'] as const)(
    'keeps %s progress named when toggling its visible label',
    async (variant) => {
      const i18n = createI18n({
        legacy: false,
        locale: 'fr',
        messages: { fr: { g: { loading: 'Chargement' } } }
      })
      const { rerender } = render(AppSpinner, {
        props: { variant },
        attrs: { class: 'size-8', 'data-testid': 'loading' },
        global: { plugins: [i18n] }
      })

      const progress = screen.getByRole('progressbar', { name: 'Chargement' })
      expect(progress).not.toHaveAttribute('aria-valuenow')
      expect(progress).toHaveClass('size-8')
      expect(progress).toHaveAttribute('data-testid', 'loading')
      expect(screen.queryByText('Chargement')).not.toBeInTheDocument()

      await rerender({ label: true })

      expect(screen.getByText('Chargement')).toBeVisible()
      expect(
        screen.getByRole('progressbar', { name: 'Chargement' })
      ).toBeInTheDocument()

      await rerender({ label: false })

      expect(screen.queryByText('Chargement')).not.toBeInTheDocument()
      expect(
        screen.getByRole('progressbar', { name: 'Chargement' })
      ).toBeInTheDocument()
    }
  )
})
