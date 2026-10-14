import { render, screen, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
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

    const tooltip = await screen.findByRole('tooltip')
    expect(within(tooltip).getByText('Premium template')).toBeInTheDocument()
    expect(within(tooltip).getByText('Runs with credits')).toBeInTheDocument()
  })

  it('opens on tap without activating the surrounding card', async () => {
    const user = userEvent.setup()
    const onCardClick = vi.fn()
    render(
      {
        components: { PaidTemplateBadge },
        setup: () => ({ onCardClick }),
        template: '<div @click="onCardClick"><PaidTemplateBadge /></div>'
      },
      { global: { plugins: [i18n] } }
    )

    await user.pointer({
      keys: '[TouchA]',
      target: screen.getByTestId('paid-template-badge')
    })

    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      'Premium template'
    )
    expect(onCardClick).not.toHaveBeenCalled()
  })
})
