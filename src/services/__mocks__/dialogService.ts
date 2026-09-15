import { vi } from 'vitest'

import type { useDialogService as realUseDialogService } from '../dialogService'

type DialogService = ReturnType<typeof realUseDialogService>

function createDialog(): ReturnType<DialogService['showLayoutDialog']> {
  return {
    key: 'test-dialog',
    visible: true,
    component: {},
    contentProps: {},
    dialogComponentProps: {},
    priority: 1
  }
}

const dialogService: DialogService = {
  showExecutionErrorDialog: vi.fn<DialogService['showExecutionErrorDialog']>(),
  showApiNodesSignInDialog: vi.fn<DialogService['showApiNodesSignInDialog']>(
    async () => false
  ),
  showSignInDialog: vi.fn<DialogService['showSignInDialog']>(async () => false),
  showPublishDialog: vi.fn<DialogService['showPublishDialog']>(async () => {}),
  showSubscriptionRequiredDialog: vi.fn<
    DialogService['showSubscriptionRequiredDialog']
  >(async () => {}),
  showTopUpCreditsDialog: vi.fn<DialogService['showTopUpCreditsDialog']>(
    async () => undefined
  ),
  showUpdatePasswordDialog: vi.fn<DialogService['showUpdatePasswordDialog']>(
    async () => createDialog()
  ),
  showExtensionDialog: vi.fn<DialogService['showExtensionDialog']>(() => ({
    dialog: createDialog(),
    closeDialog: vi.fn()
  })),
  showCloudNotification: vi.fn<DialogService['showCloudNotification']>(
    async () => {}
  ),
  prompt: vi.fn<DialogService['prompt']>(async () => null),
  showErrorDialog: vi.fn<DialogService['showErrorDialog']>(),
  confirm: vi.fn<DialogService['confirm']>(async () => null),
  showLayoutDialog: vi.fn<DialogService['showLayoutDialog']>(createDialog),
  showSmallLayoutDialog:
    vi.fn<DialogService['showSmallLayoutDialog']>(createDialog),
  showDeleteWorkspaceDialog: vi.fn<DialogService['showDeleteWorkspaceDialog']>(
    async () => createDialog()
  ),
  showCreateWorkspaceDialog: vi.fn<DialogService['showCreateWorkspaceDialog']>(
    async () => createDialog()
  ),
  showTeamWorkspacesDialog: vi.fn<DialogService['showTeamWorkspacesDialog']>(
    async () => createDialog()
  ),
  showLeaveWorkspaceDialog: vi.fn<DialogService['showLeaveWorkspaceDialog']>(
    async () => createDialog()
  ),
  showEditWorkspaceDialog: vi.fn<DialogService['showEditWorkspaceDialog']>(
    async () => createDialog()
  ),
  showRemoveMemberDialog: vi.fn<DialogService['showRemoveMemberDialog']>(
    async () => createDialog()
  ),
  showChangeMemberRoleDialog: vi.fn<
    DialogService['showChangeMemberRoleDialog']
  >(async () => createDialog()),
  showSetMemberCreditLimitDialog: vi.fn<
    DialogService['showSetMemberCreditLimitDialog']
  >(async () => createDialog()),
  showRevokeInviteDialog: vi.fn<DialogService['showRevokeInviteDialog']>(
    async () => createDialog()
  ),
  showInviteMemberDialog: vi.fn<DialogService['showInviteMemberDialog']>(
    async () => createDialog()
  ),
  showInviteMemberUpsellDialog: vi.fn<
    DialogService['showInviteMemberUpsellDialog']
  >(async () => createDialog()),
  showBillingComingSoonDialog:
    vi.fn<DialogService['showBillingComingSoonDialog']>(createDialog),
  showCancelSubscriptionDialog: vi.fn<
    DialogService['showCancelSubscriptionDialog']
  >(async () => createDialog()),
  showCancelSubscriptionFlow: vi.fn<
    DialogService['showCancelSubscriptionFlow']
  >(async () => {}),
  showDowngradeToPersonalDialog: vi.fn<
    DialogService['showDowngradeToPersonalDialog']
  >(async () => null)
}

export const useDialogService = vi.fn<typeof realUseDialogService>(
  () => dialogService
)
