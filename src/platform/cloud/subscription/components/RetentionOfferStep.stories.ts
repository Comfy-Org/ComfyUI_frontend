import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, fn } from 'storybook/test'

import { i18n } from '@/i18n'
import { setBillingContextMock } from '@/storybook/mocks/useBillingContext'

import RetentionOfferStep from './RetentionOfferStep.vue'

const meta: Meta<typeof RetentionOfferStep> = {
  title: 'Platform/Cloud/RetentionOfferStep',
  component: RetentionOfferStep,
  parameters: { layout: 'centered' },
  args: {
    offer: {
      id: 'save_30_next_3_v1',
      percent_off: 30,
      duration_in_months: 3
    },
    subscription: {
      currency: 'usd',
      unit_amount: 10000,
      quantity: 1,
      period_end: Date.UTC(2027, 2, 31, 12) / 1000
    },
    sessionId: 'storybook-session',
    workspaceId: 'storybook-workspace',
    isScopeCurrent: () => true,
    onDecide: fn()
  },
  beforeEach() {
    i18n.global.locale.value = 'en'
    setBillingContextMock({
      subscription: {
        isActive: true,
        tier: 'PRO',
        duration: 'MONTHLY',
        planSlug: null,
        scheduledChange: null,
        renewalDate: null,
        endDate: null,
        isCancelled: false,
        hasFunds: true,
        agentHasFunds: true
      }
    })
    return () => setBillingContextMock({})
  }
}

export default meta
type Story = StoryObj<typeof meta>

export const Offer: Story = {}

export const Applied: Story = {
  async play({ canvas, userEvent }) {
    await userEvent.click(
      canvas.getByRole('button', { name: 'Keep Pro and save 30%' })
    )
    await expect(
      await canvas.findByRole('heading', { name: "You're staying on Pro" })
    ).toBeVisible()
    await expect(
      canvas.getByText(
        'Your 30% discount is applied for 3 months from acceptance.'
      )
    ).toBeVisible()
  }
}
