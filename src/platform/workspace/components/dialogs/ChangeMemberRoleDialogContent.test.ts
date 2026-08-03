import { render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import ChangeMemberRoleDialogContent from './ChangeMemberRoleDialogContent.vue'

import type { WorkspaceRole } from '@/platform/workspace/api/workspaceApi'

const { mockChangeMemberRole, mockCloseDialog, mockToastAdd } = vi.hoisted(
  () => ({
    mockChangeMemberRole: vi.fn(),
    mockCloseDialog: vi.fn(),
    mockToastAdd: vi.fn()
  })
)

vi.mock('@/platform/workspace/stores/teamWorkspaceStore', () => ({
  useTeamWorkspaceStore: () => ({
    changeMemberRole: mockChangeMemberRole
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

function renderDialog(targetRole: WorkspaceRole) {
  const user = userEvent.setup()
  const result = render(ChangeMemberRoleDialogContent, {
    props: { memberId: 'mem-1', memberName: 'Jane', targetRole },
    global: { plugins: [i18n] }
  })
  return { ...result, user }
}

describe('ChangeMemberRoleDialogContent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockChangeMemberRole.mockResolvedValue(undefined)
  })

  it('shows promote copy and confirms with Make owner', async () => {
    const { user } = renderDialog('owner')

    expect(
      screen.getByText('workspacePanel.changeRoleDialog.promoteTitle')
    ).toBeInTheDocument()
    expect(
      screen.getByText('workspacePanel.changeRoleDialog.promoteIntro')
    ).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(3)

    await user.click(
      screen.getByRole('button', {
        name: 'workspacePanel.changeRoleDialog.promoteConfirm'
      })
    )

    expect(mockChangeMemberRole).toHaveBeenCalledWith('mem-1', 'owner')
    await waitFor(() =>
      expect(mockCloseDialog).toHaveBeenCalledWith({
        key: 'change-member-role'
      })
    )
    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'success' })
    )
  })

  it('shows demote copy and confirms with Demote to member', async () => {
    const { user } = renderDialog('member')

    expect(
      screen.getByText('workspacePanel.changeRoleDialog.demoteTitle')
    ).toBeInTheDocument()
    expect(
      screen.getByText('workspacePanel.changeRoleDialog.demoteMessage')
    ).toBeInTheDocument()

    await user.click(
      screen.getByRole('button', {
        name: 'workspacePanel.changeRoleDialog.demoteConfirm'
      })
    )

    expect(mockChangeMemberRole).toHaveBeenCalledWith('mem-1', 'member')
  })

  it('keeps the dialog open and toasts on failure', async () => {
    mockChangeMemberRole.mockRejectedValue(new Error('boom'))
    const { user } = renderDialog('owner')

    await user.click(
      screen.getByRole('button', {
        name: 'workspacePanel.changeRoleDialog.promoteConfirm'
      })
    )

    await waitFor(() =>
      expect(mockToastAdd).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'error' })
      )
    )
    expect(mockCloseDialog).not.toHaveBeenCalled()
  })

  it('closes without changing the role on cancel', async () => {
    const { user } = renderDialog('owner')

    await user.click(screen.getByRole('button', { name: 'g.cancel' }))

    expect(mockCloseDialog).toHaveBeenCalledWith({ key: 'change-member-role' })
    expect(mockChangeMemberRole).not.toHaveBeenCalled()
  })
})
