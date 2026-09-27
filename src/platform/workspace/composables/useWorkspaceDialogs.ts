import { SELF_STYLED_PANEL_DIALOG_PROPS } from '@/components/dialog/dialogContentClasses'
import type { WorkspaceRole } from '@/platform/workspace/api/workspaceApi'
import { useDialogStore } from '@/stores/dialogStore'

// Workspace dialogs - dynamically imported to avoid bundling when feature flag is off
const workspaceDialogProps = SELF_STYLED_PANEL_DIALOG_PROPS

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
      dialogComponentProps: workspaceDialogProps
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
        ...workspaceDialogProps
      }
    })
  }

  /**
   * Show the team workspaces dialog for creating or switching workspaces.
   * Optionally calls `onConfirm` after a workspace is successfully created.
   */
  async function showTeamWorkspacesDialog(
    onConfirm?: (name: string) => void | Promise<void>
  ) {
    const { default: component } =
      await import('@/platform/workspace/components/dialogs/TeamWorkspacesDialogContent.vue')
    return dialogStore.showDialog({
      key: 'team-workspaces',
      component,
      props: { onConfirm },
      dialogComponentProps: {
        ...workspaceDialogProps
      }
    })
  }

  async function showLeaveWorkspaceDialog() {
    const { default: component } =
      await import('@/platform/workspace/components/dialogs/LeaveWorkspaceDialogContent.vue')
    return dialogStore.showDialog({
      key: 'leave-workspace',
      component,
      dialogComponentProps: workspaceDialogProps
    })
  }

  async function showEditWorkspaceDialog() {
    const { default: component } =
      await import('@/platform/workspace/components/dialogs/EditWorkspaceDialogContent.vue')
    return dialogStore.showDialog({
      key: 'edit-workspace',
      component,
      dialogComponentProps: {
        ...workspaceDialogProps
      }
    })
  }

  async function showRemoveMemberDialog(memberId: string) {
    const { default: component } =
      await import('@/platform/workspace/components/dialogs/RemoveMemberDialogContent.vue')
    return dialogStore.showDialog({
      key: 'remove-member',
      component,
      props: { memberId },
      dialogComponentProps: workspaceDialogProps
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
      dialogComponentProps: workspaceDialogProps
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
      dialogComponentProps: workspaceDialogProps
    })
  }

  async function showInviteMemberDialog() {
    const { default: component } =
      await import('@/platform/workspace/components/dialogs/InviteMemberDialogContent.vue')
    return dialogStore.showDialog({
      key: 'invite-member',
      component,
      dialogComponentProps: {
        ...workspaceDialogProps
      }
    })
  }

  async function showInviteMemberUpsellDialog() {
    const { default: component } =
      await import('@/platform/workspace/components/dialogs/InviteMemberUpsellDialogContent.vue')
    return dialogStore.showDialog({
      key: 'invite-member-upsell',
      component,
      dialogComponentProps: {
        ...workspaceDialogProps
      }
    })
  }

  async function showRevokeInviteDialog(inviteId: string) {
    const { default: component } =
      await import('@/platform/workspace/components/dialogs/RevokeInviteDialogContent.vue')
    return dialogStore.showDialog({
      key: 'revoke-invite',
      component,
      props: { inviteId },
      dialogComponentProps: workspaceDialogProps
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
    showInviteMemberUpsellDialog
  }
}
