import userEvent from '@testing-library/user-event'
import { cleanup, render, screen } from '@testing-library/vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { PreviewSubscribeResponse } from '@/platform/workspace/api/workspaceApi'
import { MAX_WORKSPACE_MEMBERS } from '@/platform/workspace/stores/teamWorkspaceStore'

import SubscriptionSuccessWorkspace from './SubscriptionSuccessWorkspace.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
    n: (value: number) => String(value)
  })
}))

const { mockMembers, mockPendingInvites } = vi.hoisted(() => ({
  mockMembers: [] as unknown[],
  mockPendingInvites: [] as unknown[]
}))

// Provide just the seat cap + member/invite slots so the component import doesn't
// drag the team store's i18n/app chain into this unit test.
vi.mock('@/platform/workspace/stores/teamWorkspaceStore', () => ({
  MAX_WORKSPACE_MEMBERS: 30,
  useTeamWorkspaceStore: () => ({
    members: mockMembers,
    pendingInvites: mockPendingInvites
  })
}))

const { mockFlags } = vi.hoisted(() => ({
  mockFlags: { teamWorkspacesEnabled: true }
}))

vi.mock('@/composables/useFeatureFlags', () => ({
  useFeatureFlags: () => ({ flags: mockFlags })
}))

vi.mock('./InviteMembersForm.vue', () => ({
  default: {
    name: 'InviteMembersForm',
    props: ['maxSeats', 'source', 'submitLabel', 'placeholder'],
    emits: ['submitted'],
    template:
      '<div data-testid="invite-form">seats:{{ maxSeats }}<button data-testid="stub-submit" @click="$emit(\'submitted\', [\'a@b.com\'])">submit</button></div>'
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
        Button: {
          template: '<button @click="$emit(\'click\')"><slot /></button>'
        }
      }
    }
  })
}

function renderTeamCard(props: Record<string, unknown> = {}) {
  return renderCard({
    tierKey: null,
    teamPlan: TEAM_STOP,
    isTeam: true,
    ...props
  })
}

describe('SubscriptionSuccessWorkspace', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFlags.teamWorkspacesEnabled = true
    mockMembers.length = 0
    mockPendingInvites.length = 0
  })

  afterEach(() => {
    cleanup()
  })

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
    const { emitted } = renderCard({ isTeam: false })
    await userEvent.click(screen.getByRole('button'))
    expect(emitted().close).toBeTruthy()
  })

  it('renders the invite block capped at the workspace member limit', () => {
    renderTeamCard()
    expect(screen.getByText('subscription.success.inviteTitle')).toBeTruthy()
    // The buyer holds one of the flat team-member seats, so the rest are invitable.
    expect(screen.getByTestId('invite-form')).toHaveTextContent(
      `seats:${MAX_WORKSPACE_MEMBERS - 1}`
    )
  })

  it('places the Send invites action in the footer for a team upgrade', () => {
    renderTeamCard()
    expect(screen.getByText('subscription.success.sendInvites')).toBeTruthy()
  })

  it('shows no Send invites action for a personal upgrade', () => {
    renderCard({ isTeam: false })
    expect(screen.queryByText('subscription.success.sendInvites')).toBeNull()
  })

  it('does not render the invite block for a personal upgrade', () => {
    renderCard({ isTeam: false })
    expect(screen.queryByText('subscription.success.inviteTitle')).toBeNull()
    expect(screen.queryByTestId('invite-form')).toBeNull()
  })

  it('hides the invite block when team workspaces are disabled', () => {
    mockFlags.teamWorkspacesEnabled = false
    renderTeamCard()
    expect(screen.queryByTestId('invite-form')).toBeNull()
  })

  it('subtracts existing members and pending invites from invitable seats', () => {
    mockMembers.push({}, {})
    mockPendingInvites.push({})
    renderTeamCard()
    expect(screen.getByTestId('invite-form')).toHaveTextContent(
      `seats:${MAX_WORKSPACE_MEMBERS - 3}`
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
