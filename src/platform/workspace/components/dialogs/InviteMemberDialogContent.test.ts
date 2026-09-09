import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { useDialogStore } from '@/stores/dialogStore'
import { render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import InviteMemberDialogContent from './InviteMemberDialogContent.vue'

import type { WorkspacePendingInvite } from '@/platform/workspace/stores/teamWorkspaceStore'

const {
  mockToastAdd,
  mockTrackInviteSent,
  mockTrackInviteFailed,
  mockFetchStatus,
  mockMaxSeats,
  mockOccupiedSeats
} = vi.hoisted(() => {
  const nullableNumber = (value: number | null) => ({ value })
  return {
    mockToastAdd: vi.fn(),
    mockTrackInviteSent: vi.fn(),
    mockTrackInviteFailed: vi.fn(),
    mockFetchStatus: vi.fn(),
    mockMaxSeats: nullableNumber(73),
    mockOccupiedSeats: nullableNumber(0)
  }
})

vi.mock<unknown>(import('@/composables/billing/useBillingContext'), () => ({
  useBillingContext: () => ({
    fetchStatus: mockFetchStatus,
    maxSeats: mockMaxSeats,
    occupiedSeats: mockOccupiedSeats
  })
}))

vi.mock<unknown>(import('@/platform/telemetry'), () => ({
  useTelemetry: () => ({
    trackWorkspaceInviteSent: mockTrackInviteSent,
    trackWorkspaceInviteFailed: mockTrackInviteFailed
  })
}))

vi.mock<unknown>(
  import('primevue/usetoast'), // eslint-disable-line primevue-removal/no-imports
  () => ({
    useToast: () => ({
      add: mockToastAdd
    })
  })
)

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: {} },
  missingWarn: false,
  fallbackWarn: false
})

function pendingInviteFor(email: string): WorkspacePendingInvite {
  return {
    id: `inv-${email}`,
    email,
    inviteDate: new Date(0),
    expiryDate: new Date(0)
  }
}

function renderDialog() {
  const user = userEvent.setup()
  const result = render(InviteMemberDialogContent, {
    global: { plugins: [i18n] }
  })
  return { ...result, user }
}

function emailInput() {
  return screen.getByRole('textbox')
}

function inviteButton() {
  return screen.getByRole('button', { name: 'workspacePanel.invite' })
}

beforeEach(() => {
  Object.assign(useTeamWorkspaceStore(), { pendingInvites: [] })
  vi.mocked(useDialogStore().closeDialog).mockImplementation(() => {})
})

describe('InviteMemberDialogContent', () => {
  beforeEach(() => {
    vi.useRealTimers()
    vi.mocked(useTeamWorkspaceStore().fetchPendingInvites).mockResolvedValue([])
    mockFetchStatus.mockResolvedValue(undefined)
    mockMaxSeats.value = 73
    mockOccupiedSeats.value = 0
    vi.mocked(useTeamWorkspaceStore().createInvite).mockImplementation(
      async (email: string) => pendingInviteFor(email)
    )
  })

  it('turns comma-, whitespace-, and enter-delimited input into chips', async () => {
    const { user } = renderDialog()

    await user.type(emailInput(), 'a@b.com ')
    await user.type(emailInput(), 'c@d.com,')
    await user.type(emailInput(), 'e@f.com{Enter}')

    expect(screen.getByText('a@b.com')).toBeInTheDocument()
    expect(screen.getByText('c@d.com')).toBeInTheDocument()
    expect(screen.getByText('e@f.com')).toBeInTheDocument()
  })

  it('splits a pasted comma-separated list into chips', async () => {
    const { user } = renderDialog()

    await user.click(emailInput())
    await user.paste('a@b.com, c@d.com')

    expect(screen.getByText('a@b.com')).toBeInTheDocument()
    expect(screen.getByText('c@d.com')).toBeInTheDocument()
  })

  it('disables Invite while there are no chips', () => {
    renderDialog()

    expect(inviteButton()).toBeDisabled()
  })

  it('fails closed while the workspace limit is unresolved', async () => {
    mockMaxSeats.value = null
    const { user } = renderDialog()

    await user.type(emailInput(), 'a@b.com ')

    expect(screen.getByText('a@b.com')).toBeInTheDocument()
    expect(inviteButton()).toBeDisabled()
  })

  it('fails closed while workspace occupancy is unresolved', async () => {
    mockOccupiedSeats.value = null
    const { user } = renderDialog()

    await user.type(emailInput(), 'a@b.com ')

    expect(screen.getByText('a@b.com')).toBeInTheDocument()
    expect(inviteButton()).toBeDisabled()
  })

  it('allows unlimited invitations when the backend max is zero', async () => {
    mockMaxSeats.value = 0
    mockOccupiedSeats.value = 100
    const { user } = renderDialog()

    await user.type(emailInput(), 'a@b.com b@c.com ')

    expect(screen.getByText('a@b.com')).toBeInTheDocument()
    expect(screen.getByText('b@c.com')).toBeInTheDocument()
  })

  it('uses the backend workspace override to calculate available seats', async () => {
    mockOccupiedSeats.value = 72
    const { user } = renderDialog()

    await user.type(emailInput(), 'a@b.com b@c.com ')

    expect(screen.getByText('a@b.com')).toBeInTheDocument()
    expect(screen.getByText('b@c.com')).toBeInTheDocument()
    expect(
      screen.getByText('workspacePanel.inviteMemberDialog.seatLimitExceeded')
    ).toBeInTheDocument()
    expect(inviteButton()).toBeDisabled()
  })

  it('flags invalid emails and keeps Invite disabled', async () => {
    const { user } = renderDialog()

    await user.type(emailInput(), 'not-an-email{Enter}')

    expect(screen.getByText('not-an-email')).toBeInTheDocument()
    expect(
      screen.getByText('workspacePanel.inviteMemberDialog.invalidEmailCount')
    ).toBeInTheDocument()
    expect(inviteButton()).toBeDisabled()

    await user.type(emailInput(), 'a@b.com{Enter}')

    expect(inviteButton()).toBeDisabled()
  })

  it('creates an invite per email and shows the success state', async () => {
    const { user } = renderDialog()

    await user.type(emailInput(), 'a@b.com,c@d.com{Enter}')
    await user.click(inviteButton())

    expect(
      await screen.findByText(
        'workspacePanel.inviteMemberDialog.invitedMessage'
      )
    ).toBeInTheDocument()
    expect(useTeamWorkspaceStore().createInvite).toHaveBeenCalledTimes(2)
    expect(useTeamWorkspaceStore().createInvite).toHaveBeenCalledWith('a@b.com')
    expect(useTeamWorkspaceStore().createInvite).toHaveBeenCalledWith('c@d.com')
    expect(mockTrackInviteSent).toHaveBeenCalledWith({
      source: 'settings_members',
      count: 2
    })

    const closeButton = screen
      .getAllByRole('button', { name: 'g.close' })
      .find((button) => button.textContent.includes('g.close'))
    await user.click(closeButton!)

    expect(useDialogStore().closeDialog).toHaveBeenCalledWith({
      key: 'invite-member'
    })
  })

  it('keeps only failed emails as chips and toasts on partial failure', async () => {
    vi.mocked(useTeamWorkspaceStore().createInvite).mockImplementation(
      async (email: string) => {
        if (email === 'fail@x.com') throw new Error('nope')
        return pendingInviteFor(email)
      }
    )
    const { user } = renderDialog()

    await user.type(emailInput(), 'ok@x.com,fail@x.com{Enter}')
    await user.click(inviteButton())

    await waitFor(() =>
      expect(useTeamWorkspaceStore().createInvite).toHaveBeenCalledTimes(2)
    )
    expect(screen.getByText('fail@x.com')).toBeInTheDocument()
    expect(screen.queryByText('ok@x.com')).not.toBeInTheDocument()
    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'error' })
    )
    expect(mockTrackInviteSent).toHaveBeenCalledWith({
      source: 'settings_members',
      count: 1
    })
    expect(inviteButton()).toBeEnabled()
  })

  it('stays on the form and keeps every chip when all invites fail', async () => {
    vi.mocked(useTeamWorkspaceStore().createInvite).mockRejectedValue(
      new Error('nope')
    )
    const { user } = renderDialog()

    await user.type(emailInput(), 'a@b.com,c@d.com{Enter}')
    await user.click(inviteButton())

    await waitFor(() =>
      expect(useTeamWorkspaceStore().createInvite).toHaveBeenCalledTimes(2)
    )
    expect(
      screen.queryByText('workspacePanel.inviteMemberDialog.invitedMessage')
    ).not.toBeInTheDocument()
    expect(screen.getByText('a@b.com')).toBeInTheDocument()
    expect(screen.getByText('c@d.com')).toBeInTheDocument()
    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'error' })
    )
    expect(mockTrackInviteSent).not.toHaveBeenCalled()
    expect(inviteButton()).toBeEnabled()
  })

  it('closes without inviting on Cancel', async () => {
    const { user } = renderDialog()

    await user.click(screen.getByRole('button', { name: 'g.cancel' }))

    expect(useTeamWorkspaceStore().createInvite).not.toHaveBeenCalled()
    expect(useDialogStore().closeDialog).toHaveBeenCalledWith({
      key: 'invite-member'
    })
  })
})
