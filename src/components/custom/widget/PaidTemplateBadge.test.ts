import { render, screen, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import PaidTemplateBadge from './PaidTemplateBadge.vue'

const messages = {
  en: {
    templateWorkflows: {
      paidTemplate: {
        badgeLabel: 'Partner API',
        title: 'Premium template',
        credits: 'Runs with credits'
      }
    }
  }
}

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages
})

describe('PaidTemplateBadge', () => {
  it('explains the paid-plan requirement for partner templates', async () => {
    const user = userEvent.setup()
    render(PaidTemplateBadge, { global: { plugins: [i18n] } })

    const badge = screen.getByTestId('paid-template-badge')
    expect(badge).toHaveAccessibleName('Premium template Runs with credits')

    await user.hover(badge)

    const tooltip = await screen.findByTestId('disclosure-tooltip')
    expect(within(tooltip).getByText('Premium template')).toBeInTheDocument()
    expect(within(tooltip).getByText('Runs with credits')).toBeInTheDocument()
  })
})
