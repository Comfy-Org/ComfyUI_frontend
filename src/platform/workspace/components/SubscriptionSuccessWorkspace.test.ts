import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { PreviewSubscribeResponse } from '@/platform/workspace/api/workspaceApi'
import SubscriptionSuccessWorkspace from './SubscriptionSuccessWorkspace.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
    n: (value: number) => String(value)
  })
}))

const { mockInviteSubmit, mockMaxSeats, mockOccupiedSeats } = vi.hoisted(
  () => ({
    mockInviteSubmit: vi.fn(),
    mockMaxSeats: { value: 73 },
    mockOccupiedSeats: { value: 1 }
  })
)

vi.mock('@/composables/billing/useBillingContext', () => ({
  useBillingContext: () => ({
    maxSeats: mockMaxSeats,
    occupiedSeats: mockOccupiedSeats
  })
}))

vi.mock('./InviteMembersForm.vue', () => ({
  default: {
    name: 'InviteMembersForm',
    props: [
      'maxSeats',
      'occupiedSeats',
      'source',
      'submitLabel',
      'placeholder'
    ],
    emits: ['submitted'],
    setup(
      _: unknown,
      {
        emit,
        expose
      }: {
        emit: (event: string, emails: string[]) => void
        expose: (exposed: Record<string, unknown>) => void
      }
    ) {
      mockInviteSubmit.mockImplementation(async () => {
        emit('submitted', ['a@b.com'])
      })
      expose({ canSubmit: true, loading: false, submit: mockInviteSubmit })
    },
    template:
      '<div data-testid="invite-form">max:{{ maxSeats }} occupied:{{ occupiedSeats }}<button data-testid="stub-submit" @click="$emit(\'submitted\', [\'a@b.com\'])">submit</button></div>'
  }
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

const TEAM_STOP = {
  id: 'team_700',
  usd: 700,
  credits: 147_700,
  discountedUsd: 630
}

const ButtonStub = {
  emits: ['click'],
  template: '<button @click="$emit(\'click\')"><slot /></button>'
}

function renderCard(props: Record<string, unknown> = {}) {
  return render(SubscriptionSuccessWorkspace, {
    props: {
      tierKey: 'creator',
      previewData: {
        new_plan: { price_cents: 1600 }
      } as unknown as PreviewSubscribeResponse,
      ...props
    },
    global: {
      mocks: { $t: (key: string) => key },
      stubs: {
        Button: ButtonStub
      }
    }
  })
}

function renderTeamCard(props: Record<string, unknown> = {}) {
  return renderCard({
    tierKey: null,
    teamPlan: TEAM_STOP,
    previewData: null,
    ...props
  })
}

describe('SubscriptionSuccessWorkspace', () => {
  beforeEach(() => {
    mockInviteSubmit.mockReset()
    mockMaxSeats.value = 73
    mockOccupiedSeats.value = 1
  })

  it('renders the all-set heading and plan price', () => {
    renderCard()
    expect(screen.getByText('subscription.success.allSet')).toBeTruthy()
    expect(screen.getByText('$16')).toBeTruthy()
  })

  it('renders a zero price when subscription pricing is unavailable', () => {
    renderCard({ tierKey: null, previewData: null })

    expect(screen.getByText('$0')).toBeTruthy()
    expect(screen.getByText('subscription.usdPerMonth')).toBeTruthy()
  })

  it('renders the team plan summary from the selected stop', () => {
    renderTeamCard()
    expect(screen.getByText('subscription.teamPlan.name')).toBeTruthy()
    expect(screen.getByText('$630')).toBeTruthy()
    expect(screen.getByText(/147700/)).toBeTruthy()
  })

  it('shows the annual total (not a monthly-equivalent) for an annual personal plan', () => {
    render(SubscriptionSuccessWorkspace, {
      props: {
        tierKey: 'creator',
        previewData: makePreviewData(33_600, 'ANNUAL')
      },
      global: {
        mocks: { $t: (key: string) => key },
        stubs: {
          Button: ButtonStub
        }
      }
    })
    expect(screen.getByText('$336')).toBeTruthy()
    expect(screen.queryByText('$28')).toBeNull()
    expect(screen.getByText('subscription.usdPerYear')).toBeTruthy()
    expect(screen.getByText(/88800 subscription\.perYear/)).toBeTruthy()
  })

  it('shows the monthly price and monthly credits for a monthly personal plan', () => {
    render(SubscriptionSuccessWorkspace, {
      props: {
        tierKey: 'creator',
        previewData: makePreviewData(3_500, 'MONTHLY')
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
    expect(screen.getByText('$35')).toBeTruthy()
    expect(screen.getByText('subscription.usdPerMonth')).toBeTruthy()
    expect(screen.getByText(/7400 subscription\.perMonth/)).toBeTruthy()
  })

  it('shows the annual total price and annual credit total for a yearly team plan', () => {
    renderTeamCard({ billingCycle: 'yearly' })
    expect(screen.getByText('$7560')).toBeTruthy()
    expect(screen.queryByText('$630')).toBeNull()
    expect(screen.getByText('subscription.usdPerYear')).toBeTruthy()
    expect(screen.getByText(/1772400 subscription\.perYear/)).toBeTruthy()
  })

  it('prefers the fetched preview price over the client-computed team total for a team plan change', () => {
    renderTeamCard({
      billingCycle: 'yearly',
      previewData: makePreviewData(7_580 * 100, 'ANNUAL')
    })
    expect(screen.getByText('$7580')).toBeTruthy()
    expect(screen.queryByText('$7560')).toBeNull()
  })

  it('emits close when the close button is clicked', async () => {
    mockMaxSeats.value = 1
    const { emitted } = renderCard()
    await userEvent.click(screen.getByRole('button', { name: 'g.close' }))
    expect(emitted().close).toBeTruthy()
  })

  it('passes workspace capacity to the invite form', () => {
    renderTeamCard()
    expect(screen.getByText('subscription.success.inviteTitle')).toBeTruthy()
    expect(screen.getByTestId('invite-form')).toHaveTextContent(
      'max:73 occupied:1'
    )
  })

  it('places the Send invites action in the footer for a team upgrade', () => {
    renderTeamCard()
    expect(screen.getByText('subscription.success.sendInvites')).toBeTruthy()
  })

  it('submits the invite form from the footer action', async () => {
    renderTeamCard()

    await userEvent.click(
      screen.getByRole('button', {
        name: 'subscription.success.sendInvites'
      })
    )

    expect(mockInviteSubmit).toHaveBeenCalledOnce()
    expect(screen.queryByTestId('invite-form')).toBeNull()
    expect(
      screen.getByText('workspacePanel.inviteMemberDialog.invitedMessage')
    ).toBeTruthy()
  })

  it('shows no Send invites action for a personal upgrade', () => {
    mockMaxSeats.value = 1
    renderCard()
    expect(screen.queryByText('subscription.success.sendInvites')).toBeNull()
  })

  it('does not render the invite block for a personal upgrade', () => {
    mockMaxSeats.value = 1
    renderCard()
    expect(screen.queryByText('subscription.success.inviteTitle')).toBeNull()
    expect(screen.queryByTestId('invite-form')).toBeNull()
  })

  it('renders the invite block for a multi-seat personal upgrade', () => {
    mockMaxSeats.value = 5
    renderCard()
    expect(screen.getByTestId('invite-form')).toHaveTextContent(
      'max:5 occupied:1'
    )
  })

  it('passes occupied workspace seats to the invite form', () => {
    mockOccupiedSeats.value = 10
    renderTeamCard()
    expect(screen.getByTestId('invite-form')).toHaveTextContent(
      'max:73 occupied:10'
    )
  })

  it('swaps the form for the success message once invites are submitted', async () => {
    renderTeamCard()
    expect(screen.getByTestId('invite-form')).toBeTruthy()

    await userEvent.click(screen.getByTestId('stub-submit'))

    expect(screen.queryByTestId('invite-form')).toBeNull()
    expect(
      screen.getByText('workspacePanel.inviteMemberDialog.invitedMessage')
    ).toBeTruthy()
    expect(screen.queryByText('subscription.success.sendInvites')).toBeNull()
  })
})
