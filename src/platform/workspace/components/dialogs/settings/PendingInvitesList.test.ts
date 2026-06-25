import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Slots } from 'vue'
import { h } from 'vue'
import { createI18n } from 'vue-i18n'

import PendingInvitesList from './PendingInvitesList.vue'

import type { PendingInvite } from '../../../stores/teamWorkspaceStore'

const mockMenuClose = vi.hoisted(() => vi.fn())

vi.mock('@/components/button/MoreButton.vue', () => ({
  default: (_: unknown, { slots }: { slots: Slots }) =>
    h('div', slots.default?.({ close: mockMenuClose }))
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: {} },
  missingWarn: false,
  fallbackWarn: false
})

function createInvite(overrides: Partial<PendingInvite> = {}): PendingInvite {
  return {
    id: 'invite-1',
    email: 'invitee@example.com',
    inviteDate: new Date('2025-03-01'),
    expiryDate: new Date('2025-04-01'),
    ...overrides
  }
}

function renderComponent(invites: PendingInvite[]) {
  return render(PendingInvitesList, {
    props: {
      invites,
      gridCols: 'grid-cols-[50%_20%_20%_10%]'
    },
    global: { plugins: [i18n] }
  })
}

describe('PendingInvitesList', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows the empty state without action buttons when there are no invites', () => {
    renderComponent([])

    expect(screen.getByText('workspacePanel.members.noInvites')).toBeTruthy()
    expect(screen.queryAllByRole('button')).toHaveLength(0)
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
