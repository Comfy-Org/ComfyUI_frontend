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

const { mockGetMaxSeats, mockFlags } = vi.hoisted(() => ({
  mockGetMaxSeats: vi.fn(),
  mockFlags: { teamWorkspacesEnabled: true }
}))

vi.mock('@/composables/billing/useBillingContext', () => ({
  useBillingContext: () => ({ getMaxSeats: mockGetMaxSeats })
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

describe('SubscriptionSuccessWorkspace', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetMaxSeats.mockReturnValue(5)
    mockFlags.teamWorkspacesEnabled = true
  })

  it('renders the all-set heading and plan price', () => {
    renderCard()
    expect(screen.getByText('subscription.success.allSet')).toBeTruthy()
    expect(screen.getByText('$16')).toBeTruthy()
  })

  it('emits close when the close button is clicked', async () => {
    const { emitted } = renderCard({ isTeam: false })
    await userEvent.click(screen.getByRole('button'))
    expect(emitted().close).toBeTruthy()
  })

  it('renders the invite block capped at the plan seats minus the owner', () => {
    renderCard({ isTeam: true })
    expect(screen.getByText('subscription.success.inviteTitle')).toBeTruthy()
    // getMaxSeats returns 5; the owner already holds one seat, so 4 are invitable.
    expect(screen.getByTestId('invite-form')).toHaveTextContent('seats:4')
    expect(mockGetMaxSeats).toHaveBeenCalledWith('creator')
  })

  it('does not render the invite block for a personal upgrade', () => {
    renderCard({ isTeam: false })
    expect(screen.queryByText('subscription.success.inviteTitle')).toBeNull()
    expect(screen.queryByTestId('invite-form')).toBeNull()
  })

  it('hides the invite block when team workspaces are disabled', () => {
    mockFlags.teamWorkspacesEnabled = false
    renderCard({ isTeam: true })
    expect(screen.queryByTestId('invite-form')).toBeNull()
  })

  it('hides the invite block when the plan has a single seat', () => {
    mockGetMaxSeats.mockReturnValue(1)
    renderCard({ isTeam: true })
    expect(screen.queryByTestId('invite-form')).toBeNull()
  })
})
