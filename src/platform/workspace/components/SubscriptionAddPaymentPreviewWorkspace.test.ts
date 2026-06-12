import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'

import SubscriptionAddPaymentPreviewWorkspace from './SubscriptionAddPaymentPreviewWorkspace.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
    n: (value: number) => value.toLocaleString('en-US')
  })
}))

const globalOptions = {
  mocks: { $t: (key: string) => key },
  stubs: {
    'i18n-t': { template: '<span />' },
    Button: {
      template: '<button @click="$emit(\'click\')"><slot /></button>'
    }
  }
}

describe('SubscriptionAddPaymentPreviewWorkspace', () => {
  it('renders personal tier price and credits from tierKey', () => {
    render(SubscriptionAddPaymentPreviewWorkspace, {
      props: { tierKey: 'creator' },
      global: globalOptions
    })
    expect(screen.getByText('subscription.tiers.creator.name')).toBeTruthy()
    expect(screen.getByText('$35')).toBeTruthy()
  })

  it('renders the team plan from the selected slider stop', () => {
    render(SubscriptionAddPaymentPreviewWorkspace, {
      props: { teamPlan: { usd: 400, credits: 84_400 } },
      global: globalOptions
    })
    expect(screen.getByText('subscription.teamPlan.name')).toBeTruthy()
    expect(screen.getByText('$400')).toBeTruthy()
    expect(screen.getAllByText('84,400').length).toBeGreaterThan(0)
    expect(screen.getByText('$400.00')).toBeTruthy()
  })

  it('emits addCreditCard from the team confirm CTA', async () => {
    const { emitted } = render(SubscriptionAddPaymentPreviewWorkspace, {
      props: { teamPlan: { usd: 400, credits: 84_400 } },
      global: globalOptions
    })
    await userEvent.click(
      screen.getByText('subscription.preview.subscribeToPlan')
    )
    expect(emitted().addCreditCard).toBeTruthy()
  })
})
