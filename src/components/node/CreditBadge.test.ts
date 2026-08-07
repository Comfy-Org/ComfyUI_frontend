import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import CreditBadge from '@/components/node/CreditBadge.vue'
import { i18n } from '@/i18n'

describe('CreditBadge', () => {
  it('provides a localized accessible name for the complete estimate', () => {
    render(CreditBadge, {
      props: {
        text: 'Estimated 10-20 credits/run',
        rest: '(model dependent)'
      },
      global: { plugins: [i18n] }
    })

    expect(
      screen.getByLabelText(
        'Cost estimate: Estimated 10-20 credits/run (model dependent)'
      )
    ).toBeInTheDocument()
    expect(screen.getByTestId('credit-badge-rest')).toHaveAttribute(
      'aria-hidden',
      'true'
    )
  })
})
