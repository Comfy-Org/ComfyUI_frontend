import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Slots } from 'vue'
import { h } from 'vue'
import { createI18n } from 'vue-i18n'

import { useToastStore } from '@/platform/updates/common/toastStore'

import PendingInvitesList from './PendingInvitesList.vue'

import type { WorkspacePendingInvite } from '../../../stores/teamWorkspaceStore'

const mockMenuClose = vi.hoisted(() => vi.fn())

vi.mock<unknown>(import('@/components/button/MoreButton.vue'), () => ({
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

function renderComponent(invites: WorkspacePendingInvite[]) {
  return render(PendingInvitesList, {
    props: {
      invites,
      gridCols: 'grid-cols-[50%_20%_20%_10%]'
    },
    global: { plugins: [i18n] }
  })
}

describe('PendingInvitesList', () => {
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

  it('copies the invite link from the menu when the invite has a token', async () => {
    const writeText = vi.fn<(text: string) => Promise<void>>()
    writeText.mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true
    })
    renderComponent([createInvite({ token: 'tok-9' })])

    await userEvent.click(
      screen.getByRole('button', {
        name: 'workspacePanel.members.actions.copyInviteLink'
      })
    )

    expect(writeText).toHaveBeenCalledWith(
      `${window.location.origin}/?invite=tok-9`
    )
    expect(mockMenuClose).toHaveBeenCalled()
    expect(vi.mocked(useToastStore().add)).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: 'success',
        summary: 'workspacePanel.inviteLinks.copiedToast'
      })
    )
  })

  it('hides the copy item for expired invites without a token', () => {
    renderComponent([createInvite()])

    expect(
      screen.queryByRole('button', {
        name: 'workspacePanel.members.actions.copyInviteLink'
      })
    ).not.toBeInTheDocument()
  })

  it('reports a rejected clipboard write with an error toast and keeps the copy item usable', async () => {
    const writeText = vi.fn<(text: string) => Promise<void>>()
    writeText.mockRejectedValue(new Error('denied'))
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true
    })
    Object.defineProperty(document, 'execCommand', {
      value: vi.fn().mockReturnValue(false),
      configurable: true
    })
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    renderComponent([createInvite({ token: 'tok-9' })])

    await userEvent.click(
      screen.getByRole('button', {
        name: 'workspacePanel.members.actions.copyInviteLink'
      })
    )

    expect(writeText).toHaveBeenCalledWith(
      `${window.location.origin}/?invite=tok-9`
    )
    expect(vi.mocked(useToastStore().add)).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: 'error',
        summary: 'workspacePanel.inviteLinks.copyFailedToast'
      })
    )
    expect(
      screen.getByRole('button', {
        name: 'workspacePanel.members.actions.copyInviteLink'
      })
    ).toBeInTheDocument()
    consoleError.mockRestore()
    Reflect.deleteProperty(document, 'execCommand')
  })
})
