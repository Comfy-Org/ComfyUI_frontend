import type { Meta, StoryObj } from '@storybook/vue3-vite'

import type { PreviewSubscribeResponse } from '@/platform/workspace/api/workspaceApi'
import SubscriptionAddPaymentPreviewWorkspace from '@/platform/workspace/components/SubscriptionAddPaymentPreviewWorkspace.vue'

/**
 * Standalone checkout page (prototype): our own checkout in the spirit of
 * Stripe Checkout — the confirm-your-payment step owning the whole viewport,
 * no dialog chrome. The plan arrives pre-chosen via the URL; plan selection
 * is a separate page. In Storybook the payment column shows the selector's
 * no-key state; on a cloud dev server the real payment element mounts there.
 */
const meta: Meta = {
  title: 'Views/CheckoutPage',
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' }
}

export default meta
type Story = StoryObj<typeof meta>

const NEXT_YEAR = '2027-06-28T00:00:00Z'

function preview(
  tier: 'CREATOR' | 'PRO',
  duration: 'MONTHLY' | 'ANNUAL',
  priceCents: number
): PreviewSubscribeResponse {
  return {
    allowed: true,
    transition_type: 'new_subscription',
    effective_at: '2026-06-19T00:00:00Z',
    is_immediate: true,
    cost_today_cents: priceCents,
    cost_next_period_cents: priceCents,
    credits_today_cents: 0,
    credits_next_period_cents: 0,
    quote_id: 'quote_page',
    quote_version: 1,
    amount_due_cents: priceCents,
    currency: 'usd',
    renewal_amount_cents: priceCents,
    renewal_at: NEXT_YEAR,
    payment_method_configuration_id: 'pmc_story',
    new_plan: {
      slug: `${tier.toLowerCase()}-${duration.toLowerCase()}`,
      tier,
      duration,
      price_cents: priceCents,
      credits_cents: 0,
      seat_summary: {
        seat_count: 1,
        total_cost_cents: priceCents,
        total_credits_cents: 0
      },
      period_end: NEXT_YEAR
    }
  }
}

function pageStory(
  tierKey: 'creator' | 'pro',
  billingCycle: 'monthly' | 'yearly',
  previewData: PreviewSubscribeResponse
): Story {
  return {
    render: () => ({
      components: { SubscriptionAddPaymentPreviewWorkspace },
      setup() {
        return { tierKey, billingCycle, previewData }
      },
      template: `
        <div class="flex h-screen w-screen flex-col bg-secondary-background">
          <SubscriptionAddPaymentPreviewWorkspace
            :tier-key="tierKey"
            :billing-cycle="billingCycle"
            :preview-data="previewData"
            :use-payment-element="true"
            :quote-is-current="true"
          />
        </div>
      `
    })
  }
}

export const CreatorYearly: Story = pageStory(
  'creator',
  'yearly',
  preview('CREATOR', 'ANNUAL', 33_600)
)

export const ProMonthly: Story = pageStory(
  'pro',
  'monthly',
  preview('PRO', 'MONTHLY', 10_000)
)
