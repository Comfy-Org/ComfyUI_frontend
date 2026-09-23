import { vi } from 'vitest'

import type { useDialogService as realUseDialogService } from '../dialogService'

type DialogService = ReturnType<typeof realUseDialogService>

const dialog: ReturnType<DialogService['showLayoutDialog']> = {
  key: 'test-dialog',
  visible: true,
  component: {},
  contentProps: {},
  dialogComponentProps: {},
  priority: 1
}

const dialogService = vi.mockObject<DialogService>(
  {
    showExecutionErrorDialog: () => {},
    showApiNodesSignInDialog: async () => false,
    showSignInDialog: async () => false,
    showPublishDialog: async () => {},
    showSubscriptionRequiredDialog: async () => {},
    showTopUpCreditsDialog: async () => undefined,
    showUpdatePasswordDialog: async () => dialog,
    showExtensionDialog: () => ({ dialog, closeDialog: vi.fn() }),
    showCloudNotification: async () => {},
    prompt: async () => null,
    showErrorDialog: () => {},
    confirm: async () => null,
    showLayoutDialog: () => dialog,
    showSmallLayoutDialog: () => dialog,
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
    showBillingComingSoonDialog: () => dialog,
    showCancelSubscriptionDialog: async () => dialog,
    showCancelSubscriptionFlow: async () => {},
    showDowngradeToPersonalDialog: async () => null
  },
  { spy: true }
)

export const useDialogService = vi.fn(() => dialogService)
