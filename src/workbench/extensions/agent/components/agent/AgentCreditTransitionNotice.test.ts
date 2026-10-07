import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { i18n } from '@/i18n'

import AgentCreditTransitionNotice from './AgentCreditTransitionNotice.vue'

describe('AgentCreditTransitionNotice', () => {
  it('explains that later activity uses the workspace balance', () => {
    const { emitted } = render(AgentCreditTransitionNotice, {
      global: { plugins: [i18n] }
    })

    expect(screen.getByRole('status')).toHaveTextContent(
      i18n.global.t('agent.creditTransitionNotice')
    )
    expect(emitted('shown')).toHaveLength(1)
  })

  it('can be dismissed', async () => {
    const { emitted } = render(AgentCreditTransitionNotice, {
      global: { plugins: [i18n] }
    })

    await userEvent.click(
      screen.getByRole('button', { name: i18n.global.t('agent.dismiss') })
    )

    expect(emitted('dismiss')).toHaveLength(1)
  })
})
