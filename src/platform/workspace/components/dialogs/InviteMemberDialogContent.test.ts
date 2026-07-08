import { render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import InviteMemberDialogContent from './InviteMemberDialogContent.vue'

import type { PendingInvite } from '@/platform/workspace/stores/teamWorkspaceStore'

const { mockCreateInvite, mockCloseDialog, mockToastAdd } = vi.hoisted(() => ({
  mockCreateInvite: vi.fn(),
  mockCloseDialog: vi.fn(),
  mockToastAdd: vi.fn()
}))

vi.mock('@/platform/workspace/stores/teamWorkspaceStore', () => ({
  useTeamWorkspaceStore: () => ({
    createInvite: mockCreateInvite
  })
}))

vi.mock('@/stores/dialogStore', () => ({
  useDialogStore: () => ({
    closeDialog: mockCloseDialog
  })
}))

vi.mock('primevue/usetoast', () => ({
  useToast: () => ({
    add: mockToastAdd
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

describe('InviteMemberDialogContent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCreateInvite.mockImplementation(async (email: string) =>
      pendingInviteFor(email)
    )
  })

  it('turns comma- and enter-delimited input into chips', async () => {
    const { user } = renderDialog()

    await user.type(emailInput(), 'a@b.com,')
    await user.type(emailInput(), 'c@d.com{Enter}')

    expect(screen.getByText('a@b.com')).toBeInTheDocument()
    expect(screen.getByText('c@d.com')).toBeInTheDocument()
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
    expect(mockCreateInvite).toHaveBeenCalledTimes(2)
    expect(mockCreateInvite).toHaveBeenCalledWith('a@b.com')
    expect(mockCreateInvite).toHaveBeenCalledWith('c@d.com')

    const closeButton = screen
      .getAllByRole('button', { name: 'g.close' })
      .find((button) => button.textContent?.includes('g.close'))
    await user.click(closeButton!)

    expect(mockCloseDialog).toHaveBeenCalledWith({ key: 'invite-member' })
  })

  it('keeps only failed emails as chips and toasts on partial failure', async () => {
    mockCreateInvite.mockImplementation(async (email: string) => {
      if (email === 'fail@x.com') throw new Error('nope')
      return pendingInviteFor(email)
    })
    const { user } = renderDialog()

    await user.type(emailInput(), 'ok@x.com,fail@x.com{Enter}')
    await user.click(inviteButton())

    await waitFor(() => expect(mockCreateInvite).toHaveBeenCalledTimes(2))
    expect(screen.getByText('fail@x.com')).toBeInTheDocument()
    expect(screen.queryByText('ok@x.com')).not.toBeInTheDocument()
    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'error' })
    )
    expect(inviteButton()).toBeEnabled()
  })

  it('stays on the form and keeps every chip when all invites fail', async () => {
    mockCreateInvite.mockRejectedValue(new Error('nope'))
    const { user } = renderDialog()

    await user.type(emailInput(), 'a@b.com,c@d.com{Enter}')
    await user.click(inviteButton())

    await waitFor(() => expect(mockCreateInvite).toHaveBeenCalledTimes(2))
    expect(
      screen.queryByText('workspacePanel.inviteMemberDialog.invitedMessage')
    ).not.toBeInTheDocument()
    expect(screen.getByText('a@b.com')).toBeInTheDocument()
    expect(screen.getByText('c@d.com')).toBeInTheDocument()
    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'error' })
    )
    expect(inviteButton()).toBeEnabled()
  })

  it('closes without inviting on Cancel', async () => {
    const { user } = renderDialog()

    await user.click(screen.getByRole('button', { name: 'g.cancel' }))

    expect(mockCreateInvite).not.toHaveBeenCalled()
    expect(mockCloseDialog).toHaveBeenCalledWith({ key: 'invite-member' })
  })
})
