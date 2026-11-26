import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

import LeaveWorkspaceDialogContent from './LeaveWorkspaceDialogContent.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

function renderDialog() {
  const user = userEvent.setup()
  render(LeaveWorkspaceDialogContent, { global: { plugins: [i18n] } })
  return user
}

describe('LeaveWorkspaceDialogContent', () => {
  beforeEach(() => {
    vi.stubGlobal('location', { reload: vi.fn() })
    vi.mocked(useTeamWorkspaceStore().leaveWorkspace).mockResolvedValue(
      undefined
    )
  })

  it('shows the design copy', () => {
    renderDialog()

    expect(screen.getByText('Leave this workspace?')).toBeInTheDocument()
    expect(
      screen.getByText(
        "You won't be able to join again unless you contact the workspace owner."
      )
    ).toBeInTheDocument()
  })

  it('leaves the workspace when confirmed', async () => {
    const user = renderDialog()

    await user.click(screen.getByRole('button', { name: 'Leave' }))

    expect(useTeamWorkspaceStore().leaveWorkspace).toHaveBeenCalledOnce()
    expect(location.reload).toHaveBeenCalledOnce()
  })

  it('does nothing to the workspace when cancelled', async () => {
    const user = renderDialog()

    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(useTeamWorkspaceStore().leaveWorkspace).not.toHaveBeenCalled()
    expect(location.reload).not.toHaveBeenCalled()
  })

  it('keeps the page when the server refuses', async () => {
    vi.mocked(useTeamWorkspaceStore().leaveWorkspace).mockRejectedValue(
      new Error('CANNOT_LEAVE_AS_CREATOR')
    )
    const user = renderDialog()

    await user.click(screen.getByRole('button', { name: 'Leave' }))

    expect(useTeamWorkspaceStore().leaveWorkspace).toHaveBeenCalledOnce()
    expect(location.reload).not.toHaveBeenCalled()
  })
})
