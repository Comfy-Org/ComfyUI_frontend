import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

import DeleteWorkspaceDialogContent from './DeleteWorkspaceDialogContent.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

function renderDialog() {
  const user = userEvent.setup()
  render(DeleteWorkspaceDialogContent, {
    props: { workspaceName: 'Team Comfy' },
    global: { plugins: [i18n] }
  })
  return user
}

describe('DeleteWorkspaceDialogContent', () => {
  beforeEach(() => {
    vi.stubGlobal('location', { reload: vi.fn() })
    vi.mocked(useTeamWorkspaceStore().deleteWorkspace).mockResolvedValue(
      undefined
    )
  })

  it('shows the design copy', () => {
    renderDialog()

    expect(screen.getByText('Delete this workspace?')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Delete "Team Comfy"? Any unused credits or unsaved assets will be lost. This action cannot be undone.'
      )
    ).toBeInTheDocument()
  })

  it('deletes the workspace when confirmed', async () => {
    const user = renderDialog()

    await user.click(screen.getByRole('button', { name: 'Delete' }))

    expect(useTeamWorkspaceStore().deleteWorkspace).toHaveBeenCalledOnce()
    expect(location.reload).toHaveBeenCalledOnce()
  })

  it('does nothing to the workspace when cancelled', async () => {
    const user = renderDialog()

    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(useTeamWorkspaceStore().deleteWorkspace).not.toHaveBeenCalled()
    expect(location.reload).not.toHaveBeenCalled()
  })

  it('keeps the page when the server refuses', async () => {
    vi.mocked(useTeamWorkspaceStore().deleteWorkspace).mockRejectedValue(
      new Error('NOT_ORIGINAL_OWNER')
    )
    const user = renderDialog()

    await user.click(screen.getByRole('button', { name: 'Delete' }))

    expect(useTeamWorkspaceStore().deleteWorkspace).toHaveBeenCalledOnce()
    expect(location.reload).not.toHaveBeenCalled()
  })
})
