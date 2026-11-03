import userEvent from '@testing-library/user-event'
import { render, screen, waitFor } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'

import type {
  WorkspaceInvite,
  WorkspaceInviteCommands
} from '@comfyorg/account-core/billing'

import CheckoutTeamSuccess from './CheckoutTeamSuccess.vue'
import { inviteCopy, successCopy, teamPlan } from './__fixtures__/copy'

function invite(email: string): WorkspaceInvite {
  return {
    id: `inv_${email}`,
    email,
    invited_at: '2026-09-27T00:00:00Z',
    expires_at: '2026-10-04T00:00:00Z'
  }
}

function fakeInvites(
  pending: WorkspaceInvite[] = [],
  refuse: readonly string[] = []
): WorkspaceInviteCommands {
  return {
    listPendingInvites: vi.fn(async () => ({
      status: 'ok' as const,
      value: pending
    })),
    createInvite: vi.fn(async (email: string) =>
      refuse.includes(email)
        ? { status: 'error' as const, code: 'REQUEST_FAILED' as const }
        : { status: 'ok' as const, value: invite(email) }
    )
  }
}

type Props = InstanceType<typeof CheckoutTeamSuccess>['$props']

function renderSuccess(props: Partial<Props> = {}) {
  const invites = props.invites ?? fakeInvites()
  const result = render(CheckoutTeamSuccess, {
    props: {
      plan: teamPlan,
      copy: successCopy,
      inviteCopy,
      locale: 'en',
      maxSeats: 20,
      occupiedSeats: 1,
      invites,
      ...props
    }
  })
  return { ...result, invites }
}

async function typeEmails(text: string) {
  await userEvent.type(
    screen.getByRole('textbox', { name: inviteCopy.placeholder }),
    `${text},`
  )
}

describe('CheckoutTeamSuccess', () => {
  it('offers no invite for a single-seat workspace', () => {
    renderSuccess({ maxSeats: 1 })
    expect(screen.queryByText('Invite your team')).toBeNull()
    expect(screen.getByRole('button', { name: 'Close' })).toBeTruthy()
  })

  it('sends one invite per address and confirms them', async () => {
    const onInvited = vi.fn()
    const { invites } = renderSuccess({ onInvited })

    await typeEmails('ada@example.com')
    await typeEmails('bob@example.com')
    await userEvent.click(screen.getByRole('button', { name: 'Send invites' }))

    expect(
      await screen.findByText(
        'Invites were sent to ada@example.com, bob@example.com'
      )
    ).toBeTruthy()
    expect(invites.createInvite).toHaveBeenCalledTimes(2)
    expect(onInvited).toHaveBeenCalledWith([
      'ada@example.com',
      'bob@example.com'
    ])
    expect(screen.queryByRole('button', { name: 'Send invites' })).toBeNull()
  })

  it('sends nothing when the pending list arriving after Send already holds every address', async () => {
    let releasePending: (value: WorkspaceInvite[]) => void = () => {}
    const invites: WorkspaceInviteCommands = {
      listPendingInvites: vi.fn(
        () =>
          new Promise<
            Awaited<ReturnType<WorkspaceInviteCommands['listPendingInvites']>>
          >((resolve) => {
            releasePending = (value) => resolve({ status: 'ok', value })
          })
      ),
      createInvite: vi.fn(async (email: string) => ({
        status: 'ok' as const,
        value: invite(email)
      }))
    }
    const onInvited = vi.fn()
    renderSuccess({ invites, onInvited })

    await typeEmails('ada@example.com')
    await userEvent.click(screen.getByRole('button', { name: 'Send invites' }))
    releasePending([invite('ada@example.com')])

    expect(
      await screen.findByText('This person already has a pending invite')
    ).toBeTruthy()
    await waitFor(() =>
      expect(
        screen.getByRole<HTMLButtonElement>('button', { name: 'Send invites' })
          .disabled
      ).toBe(true)
    )
    expect(invites.createInvite).not.toHaveBeenCalled()
    expect(onInvited).not.toHaveBeenCalled()
    expect(screen.queryByText(/Invites were sent to/)).toBeNull()
  })

  it('keeps the addresses that failed and reports them', async () => {
    const onInvitesFailed = vi.fn()
    renderSuccess({
      invites: fakeInvites([], ['bob@example.com']),
      onInvitesFailed
    })

    await typeEmails('ada@example.com')
    await typeEmails('bob@example.com')
    await userEvent.click(screen.getByRole('button', { name: 'Send invites' }))

    await waitFor(() =>
      expect(onInvitesFailed).toHaveBeenCalledWith(
        "Couldn't send 1 invite(s). Try again."
      )
    )
    expect(screen.getByText('bob@example.com')).toBeTruthy()
    expect(screen.queryByText('ada@example.com')).toBeNull()
  })

  it.for([
    ['an invalid address', 'not-an-email', '1 invalid email address(es)'],
    [
      'an address already invited',
      'ada@example.com',
      'This person already has a pending invite'
    ]
  ] as const)('holds the send for %s', async ([, email, hint]) => {
    renderSuccess({ invites: fakeInvites([invite('ada@example.com')]) })
    await screen.findByRole('textbox')
    await typeEmails(email)

    expect(await screen.findByText(hint)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Send invites' })).toHaveProperty(
      'disabled',
      true
    )
  })

  it('holds the send beyond the seat cap', async () => {
    renderSuccess({ maxSeats: 2, occupiedSeats: 1 })
    await typeEmails('ada@example.com')
    await typeEmails('bob@example.com')

    expect(
      screen.getByText(
        'This workspace is capped at 2 members. Remove 1 to continue.'
      )
    ).toBeTruthy()
  })
})
