import { vi } from 'vitest'

import type { useWorkspaceDialogs as realUseWorkspaceDialogs } from '../useWorkspaceDialogs'

type WorkspaceDialogs = ReturnType<typeof realUseWorkspaceDialogs>

const dialog: Awaited<
  ReturnType<WorkspaceDialogs['showDeleteWorkspaceDialog']>
> = {
  key: 'test-dialog',
  visible: true,
  component: {},
  contentProps: {},
  dialogComponentProps: {},
  priority: 1
}

const workspaceDialogs = vi.mockObject<WorkspaceDialogs>(
  {
    showDeleteWorkspaceDialog: async () => dialog,
    showCreateWorkspaceDialog: async () => dialog,
    showTeamWorkspacesDialog: async () => dialog,
    showLeaveWorkspaceDialog: async () => dialog,
    showEditWorkspaceDialog: async () => dialog,
    showRemoveMemberDialog: async () => dialog,
    showChangeMemberRoleDialog: async () => dialog,
    showSetMemberCreditLimitDialog: async () => dialog,
    showRevokeInviteDialog: async () => dialog,
    showInviteMemberDialog: async () => dialog,
    showInviteMemberUpsellDialog: async () => dialog,
    showInviteLinkInvalidDialog: async () => dialog,
    showInviteWrongAccountDialog: async () => dialog
  },
  { spy: true }
)

export const useWorkspaceDialogs = vi.fn(() => workspaceDialogs)
