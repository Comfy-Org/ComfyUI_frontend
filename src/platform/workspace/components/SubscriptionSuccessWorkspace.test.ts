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

// Provide just the seat cap so the component import doesn't drag the team store's
// i18n/app chain into this unit test.
vi.mock('@/platform/workspace/stores/teamWorkspaceStore', () => ({
  MAX_WORKSPACE_MEMBERS: 30
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
    template: '<div data-testid="invite-form">seats:{{ maxSeats }}</div>'
  }
}))

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
})
