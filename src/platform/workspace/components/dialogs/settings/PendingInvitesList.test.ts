import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Slots } from 'vue'
import { h } from 'vue'
import { createI18n } from 'vue-i18n'

import PendingInvitesList from './PendingInvitesList.vue'

import type { WorkspacePendingInvite } from '../../../stores/teamWorkspaceStore'

const mockMenuClose = vi.hoisted(() => vi.fn())

vi.mock('@/components/button/MoreButton.vue', () => ({
  default: (_: unknown, { slots }: { slots: Slots }) =>
    h('div', slots.default?.({ close: mockMenuClose }))
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      workspacePanel: {
        members: {
          noInvites: 'No pending invites',
          noInvitesMatch: 'No invites match "{query}"'
        }
      }
    }
  },
  missingWarn: false,
  fallbackWarn: false
})

function createInvite(
  overrides: Partial<WorkspacePendingInvite> = {}
): WorkspacePendingInvite {
  return {
    id: 'invite-1',
    email: 'invitee@example.com',
    inviteDate: new Date('2025-03-01'),
    expiryDate: new Date('2025-04-01'),
    ...overrides
  }
}

function renderComponent(
  invites: WorkspacePendingInvite[],
  props: { searchQuery?: string; loaded?: boolean } = {}
) {
  return render(PendingInvitesList, {
    props: {
      invites,
      gridCols: 'grid-cols-[50%_20%_20%_10%]',
      loaded: true,
      ...props
    },
    global: { plugins: [i18n] }
  })
}

describe('PendingInvitesList', () => {
  it('shows the empty state without action buttons when there are no invites', () => {
    renderComponent([])

    expect(screen.getByText('No pending invites')).toBeInTheDocument()
    expect(screen.queryAllByRole('button')).toHaveLength(0)
  })

  it('names the query when a search matches no invite', () => {
    renderComponent([], { searchQuery: 'nobody' })

    expect(screen.getByText('No invites match "nobody"')).toBeInTheDocument()
    expect(screen.queryByText('No pending invites')).not.toBeInTheDocument()
  })

  it('renders no empty copy before the first request completes', () => {
    renderComponent([], { loaded: false, searchQuery: 'nobody' })

    expect(screen.queryByText('No pending invites')).not.toBeInTheDocument()
    expect(
      screen.queryByText('No invites match "nobody"')
    ).not.toBeInTheDocument()
  })

  it('emits resend with the invite and closes the menu', async () => {
    const invite = createInvite({ id: 'inv-7' })
    const { emitted } = renderComponent([invite])

    await userEvent.click(
      screen.getByRole('button', {
        name: 'workspacePanel.members.actions.resendInvite'
      })
    )

    expect(emitted('resend')).toEqual([[invite]])
    expect(mockMenuClose).toHaveBeenCalled()
  })

  it('emits revoke with the invite from the cancel item', async () => {
    const invite = createInvite({ id: 'inv-8' })
    const { emitted } = renderComponent([invite])

    await userEvent.click(
      screen.getByRole('button', {
        name: 'workspacePanel.members.actions.cancelInvite'
      })
    )

    expect(emitted('revoke')).toEqual([[invite]])
  })
})
