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

function makePreviewData(
  priceCents: number,
  duration: 'MONTHLY' | 'ANNUAL' = 'MONTHLY'
): PreviewSubscribeResponse {
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
      duration,
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

function renderTeamCard() {
  return render(SubscriptionSuccessWorkspace, {
    props: {
      teamPlan: {
        id: 'team_700',
        usd: 700,
        credits: 147_700,
        discountedUsd: 630
      }
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

  it('renders the team plan summary from the selected stop', () => {
    renderTeamCard()
    expect(screen.getByText('subscription.teamPlan.name')).toBeTruthy()
    expect(screen.getByText('$630')).toBeTruthy()
    expect(screen.getByText(/147700/)).toBeTruthy()
  })

  it('shows the monthly-equivalent price for an annual personal plan', () => {
    render(SubscriptionSuccessWorkspace, {
      props: {
        tierKey: 'creator',
        previewData: makePreviewData(33_600, 'ANNUAL')
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
    expect(screen.getByText('$28')).toBeTruthy()
    expect(screen.queryByText('$336')).toBeNull()
  })

  it('emits close when the close button is clicked', async () => {
    const { emitted } = renderCard()
    await userEvent.click(screen.getByRole('button'))
    expect(emitted().close).toBeTruthy()
  })
})
