import { refreshBilling } from '@/platform/billing/billingRefresh'
import type { WorkspaceRole } from '@/platform/workspace/api/workspaceApi'
import { useDialogStore } from '@/stores/dialogStore'

export function useWorkspaceDialogs() {
  const dialogStore = useDialogStore()

  async function showDeleteWorkspaceDialog(options?: {
    workspaceId?: string
    workspaceName?: string
  }) {
    const { default: component } =
      await import('@/platform/workspace/components/dialogs/DeleteWorkspaceDialogContent.vue')
    return dialogStore.showDialog({
      key: 'delete-workspace',
      component,
      props: options,
      dialogComponentProps: { headless: true }
    })
  }

  async function showCreateWorkspaceDialog(
    onConfirm?: (name: string) => void | Promise<void>
  ) {
    const { default: component } =
      await import('@/platform/workspace/components/dialogs/CreateWorkspaceDialogContent.vue')
    return dialogStore.showDialog({
      key: 'create-workspace',
      component,
      props: { onConfirm },
      dialogComponentProps: {
        headless: true
      }
    })
  }

  async function showTeamWorkspacesDialog(
    onConfirm?: (name: string) => void | Promise<void>
  ) {
    const { default: component } =
      await import('@/platform/account/components/dialogs/TeamWorkspacesDialogContent.vue')
    return dialogStore.showDialog({
      key: 'team-workspaces',
      component,
      props: { onConfirm },
      dialogComponentProps: {
        headless: true
      }
    })
  }

  async function showLeaveWorkspaceDialog() {
    const { default: component } =
      await import('@/platform/workspace/components/dialogs/LeaveWorkspaceDialogContent.vue')
    return dialogStore.showDialog({
      key: 'leave-workspace',
      component,
      dialogComponentProps: { headless: true }
    })
  }

  async function showEditWorkspaceDialog() {
    const { default: component } =
      await import('@/platform/workspace/components/dialogs/EditWorkspaceDialogContent.vue')
    return dialogStore.showDialog({
      key: 'edit-workspace',
      component,
      dialogComponentProps: {
        headless: true
      }
    })
  }

  async function showRemoveMemberDialog(memberId: string) {
    const { default: component } =
      await import('@/platform/workspace/components/dialogs/RemoveMemberDialogContent.vue')
    return dialogStore.showDialog({
      key: 'remove-member',
      component,
      props: {
        memberId,
        onRemoved: () => void refreshBilling('account')
      },
      dialogComponentProps: { headless: true }
    })
  }

  async function showChangeMemberRoleDialog(props: {
    memberId: string
    memberName: string
    targetRole: WorkspaceRole
  }) {
    const { default: component } =
      await import('@/platform/workspace/components/dialogs/ChangeMemberRoleDialogContent.vue')
    return dialogStore.showDialog({
      key: 'change-member-role',
      component,
      props,
      dialogComponentProps: { headless: true }
    })
  }

  async function showSetMemberCreditLimitDialog(props: {
    memberId: string
    memberName: string
    creditsUsed?: number
    currentLimit?: number | null
  }) {
    const { default: component } =
      await import('@/platform/workspace/components/dialogs/SetMemberCreditLimitDialogContent.vue')
    return dialogStore.showDialog({
      key: 'set-member-credit-limit',
      component,
      props,
      dialogComponentProps: { headless: true }
    })
  }

  async function showInviteMemberDialog() {
    const { default: component } =
      await import('@/platform/account/components/dialogs/InviteMemberDialogContent.vue')
    return dialogStore.showDialog({
      key: 'invite-member',
      component,
      dialogComponentProps: {
        headless: true
      }
    })
  }

  async function showInviteMemberUpsellDialog() {
    const { default: component } =
      await import('@/platform/billing/components/dialogs/InviteMemberUpsellDialogContent.vue')
    return dialogStore.showDialog({
      key: 'invite-member-upsell',
      component,
      dialogComponentProps: {
        headless: true
      }
    })
  }

  async function showInviteLinkInvalidDialog() {
    const { default: component } =
      await import('@/platform/workspace/components/dialogs/InviteLinkInvalidDialogContent.vue')
    return dialogStore.showDialog({
      key: 'invite-link-invalid',
      component,
      dialogComponentProps: {
        headless: true
      }
    })
  }

  async function showInviteWrongAccountDialog(props: { inviteToken: string }) {
    const { default: component } =
      await import('@/platform/workspace/components/dialogs/InviteWrongAccountDialogContent.vue')
    dialogStore.closeDialog({ key: 'invite-wrong-account' })
    return dialogStore.showDialog({
      key: 'invite-wrong-account',
      component,
      props,
      dialogComponentProps: {
        headless: true
      }
    })
  }

  async function showRevokeInviteDialog(inviteId: string) {
    const { default: component } =
      await import('@/platform/workspace/components/dialogs/RevokeInviteDialogContent.vue')
    return dialogStore.showDialog({
      key: 'revoke-invite',
      component,
      props: {
        inviteId,
        onRevoked: () => void refreshBilling('account')
      },
      dialogComponentProps: { headless: true }
    })
  }
  return {
    showDeleteWorkspaceDialog,
    showCreateWorkspaceDialog,
    showTeamWorkspacesDialog,
    showLeaveWorkspaceDialog,
    showEditWorkspaceDialog,
    showRemoveMemberDialog,
    showChangeMemberRoleDialog,
    showSetMemberCreditLimitDialog,
    showRevokeInviteDialog,
    showInviteMemberDialog,
    showInviteMemberUpsellDialog,
    showInviteLinkInvalidDialog,
    showInviteWrongAccountDialog
  }
}
