import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'

import type { PreviewSubscribeResponse } from '@/platform/workspace/api/workspaceApi'

import SubscriptionSuccessWorkspace from './SubscriptionSuccessWorkspace.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
    n: (value: number) => String(value)
  })
}))

function makePreviewData(priceCents: number): PreviewSubscribeResponse {
  return {
    allowed: true,
    transition_type: 'new_subscription',
    effective_at: '2026-07-10T00:00:00Z',
    is_immediate: true,
    cost_today_cents: priceCents,
    cost_next_period_cents: priceCents,
    credits_today_cents: 0,
    credits_next_period_cents: 0,
    new_plan: {
      slug: 'standard-monthly',
      tier: 'STANDARD',
      duration: 'MONTHLY',
      price_cents: priceCents,
      credits_cents: 0,
      seat_summary: {
        seat_count: 1,
        total_cost_cents: priceCents,
        total_credits_cents: 0
      }
    }
  }
}

function renderCard() {
  return render(SubscriptionSuccessWorkspace, {
    props: {
      tierKey: 'standard',
      previewData: makePreviewData(1600)
    },
    global: {
      mocks: { $t: (key: string) => key },
      stubs: {
        Button: {
          template: '<button @click="$emit(\'click\')"><slot /></button>'
        }
      }
    }
  })
}

describe('SubscriptionSuccessWorkspace', () => {
  it('renders the all-set heading and plan price', () => {
    renderCard()
    expect(screen.getByText('subscription.success.allSet')).toBeTruthy()
    expect(screen.getByText('$16')).toBeTruthy()
  })

  it('emits close when the close button is clicked', async () => {
    const { emitted } = renderCard()
    await userEvent.click(screen.getByRole('button'))
    expect(emitted().close).toBeTruthy()
  })
})
