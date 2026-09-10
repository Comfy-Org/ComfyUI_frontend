import { computed, ref } from 'vue'
import { useBillingContext } from '@/composables/billing/useBillingContext'
import { useToast } from '@/components/ui/toast'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { useDialogStore } from '@/stores/dialogStore'
import { render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import { useTelemetry } from '@/platform/telemetry'

import InviteMemberDialogContent from './InviteMemberDialogContent.vue'

import { buildInviteLink } from '@/platform/workspace/utils/inviteLinks'

import type { WorkspacePendingInvite } from '@/platform/workspace/stores/teamWorkspaceStore'

const mockToastAdd = vi.hoisted(() => vi.fn())
const mockMaxSeats = ref<number | null>(73)
const mockOccupiedSeats = ref<number | null>(0)

vi.mock(import('@/composables/billing/useBillingContext'))

vi.mock(import('@/platform/telemetry'))

beforeEach(() => {
  vi.mocked(useToast().success).mockImplementation((...args: unknown[]) =>
    mockToastAdd('success', ...args)
  )
  vi.mocked(useToast().error).mockImplementation((...args: unknown[]) =>
    mockToastAdd('error', ...args)
  )
  vi.mocked(useToast().info).mockImplementation((...args: unknown[]) =>
    mockToastAdd('info', ...args)
  )
  vi.mocked(useToast().warning).mockImplementation((...args: unknown[]) =>
    mockToastAdd('warning', ...args)
  )
  vi.mocked(useToast().loading).mockImplementation((...args: unknown[]) =>
    mockToastAdd('loading', ...args)
  )
  vi.mocked(useToast().custom).mockImplementation((...args: unknown[]) =>
    mockToastAdd('custom', ...args)
  )
})

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: {} },
  missingWarn: false,
  fallbackWarn: false
})

function pendingInviteFor(
  email: string,
  token?: string
): WorkspacePendingInvite {
  return {
    id: `inv-${email}`,
    email,
    inviteDate: new Date(0),
    expiryDate: new Date(0),
    token
  }
}

function inviteLinkFor(token: string) {
  return `${window.location.origin}/?invite=${token}`
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
  const billing = useBillingContext()
  Object.assign(billing, {
    maxSeats: computed(() => mockMaxSeats.value),
    occupiedSeats: computed(() => mockOccupiedSeats.value)
  })
  vi.mocked(useBillingContext).mockReturnValue(billing)

  Object.assign(useTeamWorkspaceStore(), { pendingInvites: [] })
  vi.mocked(useDialogStore().closeDialog).mockImplementation(() => {})
})

describe('InviteMemberDialogContent', () => {
  beforeEach(() => {
    vi.useRealTimers()
    vi.mocked(useTeamWorkspaceStore().fetchPendingInvites).mockResolvedValue([])
    vi.mocked(useBillingContext().fetchStatus).mockResolvedValue(undefined)
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
    expect(useTelemetry()?.trackWorkspaceInviteSent).toHaveBeenCalledWith({
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
    expect(mockToastAdd.mock.calls.map(([method]) => method)).toContain('error')
    expect(useTelemetry()?.trackWorkspaceInviteSent).toHaveBeenCalledWith({
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
      screen.queryByText('workspacePanel.inviteLinks.sentLead')
    ).not.toBeInTheDocument()
    expect(screen.getByText('a@b.com')).toBeInTheDocument()
    expect(screen.getByText('c@d.com')).toBeInTheDocument()
    expect(mockToastAdd.mock.calls.map(([method]) => method)).toContain('error')
    expect(useTelemetry()?.trackWorkspaceInviteSent).not.toHaveBeenCalled()
    expect(inviteButton()).toBeEnabled()
  })

  describe('invite link rows', () => {
    async function inviteAndConfirm(
      user: ReturnType<typeof userEvent.setup>,
      emails: string
    ) {
      await user.type(emailInput(), emails)
      await user.click(inviteButton())
      await screen.findByText(/inviteLinks\.sentLead|invitedMessage/)
    }

    function mockInviteListAfterSend(invites: WorkspacePendingInvite[]) {
      vi.mocked(useTeamWorkspaceStore().fetchPendingInvites)
        .mockResolvedValueOnce([])
        .mockResolvedValue(invites)
    }

    function copyLinkButtons() {
      return screen.queryAllByRole('button', {
        name: 'workspacePanel.inviteLinks.copyLink'
      })
    }

    function copyAllButton() {
      return screen.queryByRole('button', {
        name: 'workspacePanel.inviteLinks.copyAll'
      })
    }

    it('renders a row with a Copy link action per invited email', async () => {
      mockInviteListAfterSend([
        pendingInviteFor('a@b.com', 'tok-a'),
        pendingInviteFor('c@d.com', 'tok-c')
      ])
      const { user } = renderDialog()

      await inviteAndConfirm(user, 'a@b.com,c@d.com{Enter}')

      await waitFor(() => expect(copyLinkButtons()).toHaveLength(2))
      expect(screen.getByText('a@b.com')).toBeInTheDocument()
      expect(screen.getByText('c@d.com')).toBeInTheDocument()
    })

    it('copies the row link and swaps the button label to Copied', async () => {
      mockInviteListAfterSend([
        pendingInviteFor('a@b.com', 'tok-a'),
        pendingInviteFor('c@d.com', 'tok-c')
      ])
      const { user } = renderDialog()
      await inviteAndConfirm(user, 'a@b.com,c@d.com{Enter}')
      await waitFor(() => expect(copyLinkButtons()).toHaveLength(2))

      await user.click(copyLinkButtons()[0])

      expect(await navigator.clipboard.readText()).toBe(inviteLinkFor('tok-a'))
      expect(
        await screen.findByRole('button', {
          name: 'workspacePanel.inviteLinks.copied'
        })
      ).toBeInTheDocument()
      // The other row keeps its Copy link label.
      expect(copyLinkButtons()).toHaveLength(1)
    })

    it('Copy all links writes tab-separated email/url pairs', async () => {
      mockInviteListAfterSend([
        pendingInviteFor('a@b.com', 'tok-a'),
        pendingInviteFor('c@d.com', 'tok-c')
      ])
      const { user } = renderDialog()
      await inviteAndConfirm(user, 'a@b.com,c@d.com{Enter}')
      await waitFor(() => expect(copyAllButton()).toBeInTheDocument())

      await user.click(copyAllButton()!)

      expect(await navigator.clipboard.readText()).toBe(
        `a@b.com\t${inviteLinkFor('tok-a')}\nc@d.com\t${inviteLinkFor('tok-c')}`
      )
    })

    it('hides the Copy action for invites without a token', async () => {
      mockInviteListAfterSend([
        pendingInviteFor('a@b.com', 'tok-a'),
        pendingInviteFor('c@d.com')
      ])
      const { user } = renderDialog()

      await inviteAndConfirm(user, 'a@b.com,c@d.com{Enter}')

      await waitFor(() => expect(copyLinkButtons()).toHaveLength(1))
      expect(screen.getByText('c@d.com')).toBeInTheDocument()
      // One copyable row: the footer action stays, in its singular form.
      expect(copyAllButton()).toBeInTheDocument()
    })

    it('keeps the copy affordance when the clipboard write fails', async () => {
      mockInviteListAfterSend([pendingInviteFor('a@b.com', 'tok-a')])
      const { user } = renderDialog()
      await inviteAndConfirm(user, 'a@b.com{Enter}')
      await waitFor(() => expect(copyLinkButtons()).toHaveLength(1))

      const writeText = vi
        .spyOn(navigator.clipboard, 'writeText')
        .mockRejectedValueOnce(new Error('denied'))
      await user.click(copyLinkButtons()[0])

      expect(
        screen.queryByRole('button', {
          name: 'workspacePanel.inviteLinks.copied'
        })
      ).not.toBeInTheDocument()
      expect(copyLinkButtons()).toHaveLength(1)
      writeText.mockRestore()
    })

    it('reverts Copied back to the copy affordance after the reset window', async () => {
      vi.useFakeTimers()
      try {
        mockInviteListAfterSend([pendingInviteFor('a@b.com', 'tok-a')])
        const user = userEvent.setup({
          advanceTimers: vi.advanceTimersByTime
        })
        renderDialog()
        await inviteAndConfirm(user, 'a@b.com{Enter}')
        await waitFor(() => expect(copyLinkButtons()).toHaveLength(1))

        await user.click(copyLinkButtons()[0])
        expect(
          await screen.findByRole('button', {
            name: 'workspacePanel.inviteLinks.copied'
          })
        ).toBeInTheDocument()

        await vi.advanceTimersByTimeAsync(2100)
        expect(
          screen.queryByRole('button', {
            name: 'workspacePanel.inviteLinks.copied'
          })
        ).not.toBeInTheDocument()
        expect(copyLinkButtons()).toHaveLength(1)
      } finally {
        vi.useRealTimers()
      }
    })

    it('copies the bare URL from the singular footer action', async () => {
      mockInviteListAfterSend([pendingInviteFor('a@b.com', 'tok-a')])
      const { user } = renderDialog()

      await inviteAndConfirm(user, 'a@b.com{Enter}')

      await waitFor(() => expect(copyAllButton()).toBeInTheDocument())
      await user.click(copyAllButton()!)
      await waitFor(async () => {
        expect(await navigator.clipboard.readText()).toBe(
          buildInviteLink('tok-a')
        )
      })
    })

    it('renders rows without Copy actions when the invite list fetch fails', async () => {
      vi.mocked(useTeamWorkspaceStore().fetchPendingInvites)
        .mockResolvedValueOnce([])
        .mockRejectedValue(new Error('nope'))
      const consoleError = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {})
      const { user } = renderDialog()

      await inviteAndConfirm(user, 'a@b.com{Enter}')

      expect(screen.getByText('a@b.com')).toBeInTheDocument()
      expect(copyLinkButtons()).toHaveLength(0)
      consoleError.mockRestore()
    })

    // pendingInviteFor derives the id from the email, so the tests above pass
    // under either join. These two decouple the two fields so the id-keyed
    // lookup is what is actually pinned.
    it('ignores a token from a different invite with the same address', async () => {
      mockInviteListAfterSend([
        { ...pendingInviteFor('a@b.com', 'tok-elsewhere'), id: 'inv-unrelated' }
      ])
      const { user } = renderDialog()

      await inviteAndConfirm(user, 'a@b.com{Enter}')

      expect(
        await screen.findByText(
          'workspacePanel.inviteMemberDialog.invitedMessage'
        )
      ).toBeInTheDocument()
      expect(copyLinkButtons()).toHaveLength(0)
    })

    it('takes the token from the matching id when the stored address differs', async () => {
      mockInviteListAfterSend([
        { ...pendingInviteFor('a@b.com', 'tok-a'), email: 'A@B.com' }
      ])
      const { user } = renderDialog()

      await inviteAndConfirm(user, 'a@b.com{Enter}')

      await waitFor(() => expect(copyLinkButtons()).toHaveLength(1))
      await user.click(copyLinkButtons()[0])

      expect(await navigator.clipboard.readText()).toBe(
        buildInviteLink('tok-a')
      )
    })
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
