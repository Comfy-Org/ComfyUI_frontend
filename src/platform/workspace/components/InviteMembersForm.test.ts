import { render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import InviteMembersForm from './InviteMembersForm.vue'

import type { PendingInvite } from '@/platform/workspace/stores/teamWorkspaceStore'

const { mockCreateInvite, mockFetchStatus, mockToastAdd, mockTrackInviteSent } =
  vi.hoisted(() => ({
    mockCreateInvite: vi.fn(),
    mockFetchStatus: vi.fn(),
    mockToastAdd: vi.fn(),
    mockTrackInviteSent: vi.fn()
  }))

vi.mock('@/composables/billing/useBillingContext', () => ({
  useBillingContext: () => ({ fetchStatus: mockFetchStatus })
}))

vi.mock('@/platform/workspace/stores/teamWorkspaceStore', () => ({
  useTeamWorkspaceStore: () => ({
    createInvite: mockCreateInvite as (email: string) => Promise<PendingInvite>
  })
}))

vi.mock('primevue/usetoast', () => ({
  useToast: () => ({
    add: mockToastAdd
  })
}))

vi.mock('@/platform/telemetry', () => ({
  useTelemetry: () => ({
    trackWorkspaceInviteSent: mockTrackInviteSent
  })
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: {} },
  missingWarn: false,
  fallbackWarn: false
})

function pendingInviteFor(email: string): PendingInvite {
  return {
    id: `inv-${email}`,
    email,
    inviteDate: new Date(0),
    expiryDate: new Date(0)
  }
}

function renderForm(props: Record<string, unknown> = {}) {
  const user = userEvent.setup()
  const result = render(InviteMembersForm, {
    props: {
      submitLabel: 'Send invites',
      placeholder: 'Enter emails',
      source: 'post_upgrade_success',
      ...props
    },
    global: { plugins: [i18n] }
  })
  return { ...result, user }
}

function emailInput() {
  return screen.getByRole('textbox')
}

function submitButton() {
  return screen.getByRole('button', { name: 'Send invites' })
}

describe('InviteMembersForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetchStatus.mockResolvedValue(undefined)
    mockCreateInvite.mockImplementation(async (email: string) =>
      pendingInviteFor(email)
    )
  })

  it('turns comma-, whitespace-, and enter-delimited input into chips', async () => {
    const { user } = renderForm()

    await user.type(emailInput(), 'a@b.com ')
    await user.type(emailInput(), 'c@d.com,')
    await user.type(emailInput(), 'e@f.com{Enter}')

    expect(screen.getByText('a@b.com')).toBeInTheDocument()
    expect(screen.getByText('c@d.com')).toBeInTheDocument()
    expect(screen.getByText('e@f.com')).toBeInTheDocument()
  })

  it('disables submit with no chips and flags invalid emails', async () => {
    const { user } = renderForm()

    expect(submitButton()).toBeDisabled()

    await user.type(emailInput(), 'not-an-email{Enter}')

    expect(screen.getByText('not-an-email')).toBeInTheDocument()
    expect(
      screen.getByText('workspacePanel.inviteMemberDialog.invalidEmailCount')
    ).toBeInTheDocument()
    expect(submitButton()).toBeDisabled()
  })

  it('creates an invite per email, tracks telemetry, and emits submitted', async () => {
    const { user, emitted } = renderForm()

    await user.type(emailInput(), 'A@B.com C@D.com{Enter}')
    await user.click(submitButton())

    await waitFor(() => expect(mockCreateInvite).toHaveBeenCalledTimes(2))
    expect(mockCreateInvite).toHaveBeenCalledWith('a@b.com')
    expect(mockCreateInvite).toHaveBeenCalledWith('c@d.com')
    expect(mockTrackInviteSent).toHaveBeenCalledWith({
      source: 'post_upgrade_success',
      count: 2
    })
    expect(mockFetchStatus).toHaveBeenCalledOnce()
    expect(emitted().submitted).toEqual([[['a@b.com', 'c@d.com']]])
  })

  it('keeps failed emails for retry and emits all invited emails after recovery', async () => {
    let shouldFail = true
    mockCreateInvite.mockImplementation(async (email: string) => {
      if (email === 'fail@x.com' && shouldFail) {
        shouldFail = false
        throw new Error('nope')
      }
      return pendingInviteFor(email)
    })
    const { user, emitted } = renderForm()

    await user.type(emailInput(), 'ok@x.com fail@x.com{Enter}')
    await user.click(submitButton())

    await waitFor(() => expect(mockCreateInvite).toHaveBeenCalledTimes(2))
    expect(screen.getByText('fail@x.com')).toBeInTheDocument()
    expect(screen.queryByText('ok@x.com')).not.toBeInTheDocument()
    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'error' })
    )
    expect(emitted().submitted).toBeUndefined()
    expect(mockTrackInviteSent).toHaveBeenCalledWith({
      source: 'post_upgrade_success',
      count: 1
    })

    await user.click(submitButton())

    await waitFor(() => expect(mockCreateInvite).toHaveBeenCalledTimes(3))
    expect(emitted().submitted).toEqual([[['ok@x.com', 'fail@x.com']]])
    expect(mockTrackInviteSent).toHaveBeenCalledTimes(2)
    expect(mockTrackInviteSent).toHaveBeenLastCalledWith({
      source: 'post_upgrade_success',
      count: 1
    })
  })

  it('keeps all chips, toasts, and emits nothing when every invite fails', async () => {
    mockCreateInvite.mockRejectedValue(new Error('nope'))
    const { user, emitted } = renderForm()

    await user.type(emailInput(), 'a@b.com,c@d.com{Enter}')
    await user.click(submitButton())

    await waitFor(() => expect(mockCreateInvite).toHaveBeenCalledTimes(2))
    expect(screen.getByText('a@b.com')).toBeInTheDocument()
    expect(screen.getByText('c@d.com')).toBeInTheDocument()
    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'error' })
    )
    expect(emitted().submitted).toBeUndefined()
    expect(mockTrackInviteSent).not.toHaveBeenCalled()
    expect(mockFetchStatus).not.toHaveBeenCalled()
  })

  it('caps the number of chips at maxSeats', async () => {
    const { user } = renderForm({ maxSeats: 2 })

    await user.type(emailInput(), 'a@b.com,b@b.com,c@b.com{Enter}')

    expect(screen.getByText('a@b.com')).toBeInTheDocument()
    expect(screen.getByText('b@b.com')).toBeInTheDocument()
    expect(screen.queryByText('c@b.com')).not.toBeInTheDocument()
    expect(
      screen.getByText('workspacePanel.inviteMemberDialog.seatLimitReached')
    ).toBeInTheDocument()
  })

  it('emits cancel when a cancel label is provided', async () => {
    const { user, emitted } = renderForm({ cancelLabel: 'Cancel' })

    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(emitted().cancel).toBeTruthy()
    expect(mockCreateInvite).not.toHaveBeenCalled()
  })

  it('hides the built-in submit row when showSubmit is false', () => {
    renderForm({ showSubmit: false })

    expect(
      screen.queryByRole('button', { name: 'Send invites' })
    ).not.toBeInTheDocument()
  })
})
