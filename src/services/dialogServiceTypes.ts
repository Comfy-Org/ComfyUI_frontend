import type { Component } from 'vue'
import type { ComponentAttrs } from 'vue-component-type-helpers'

import type { ConfirmationDialogType } from '@/components/dialog/content/confirmationDialogTypes'
import type {
  DowngradeToPersonalResult,
  SubscriptionDialogOptions,
  TopUpCreditsDialogOptions
} from '@/composables/billing/types'
import type { PaymentIntentSource } from '@/platform/telemetry/types'
import type { WorkspaceRole } from '@/platform/workspace/api/workspaceApi'
import type {
  DialogComponentProps,
  DialogInstance,
  ShowDialogOptions
} from '@/stores/dialogStore'

interface BaseConfirmOptions {
  /** Dialog heading */
  title: string
  /** The main message body */
  message: string
  /** Displayed as an unordered list immediately below the message body */
  itemList?: string[]
  hint?: string
  /**
   * Dialog-stack key, defaulting to the shared `global-prompt`. `showDialog`
   * reuses an existing entry with the same key and discards the new resolver,
   * leaving the caller's promise pending forever — a flow whose confirmation
   * must survive an already-open shared prompt passes its own key.
   */
  key?: string
}

export type ConfirmOptions = BaseConfirmOptions &
  (
    | {
        /** Pre-configured dialog type */
        type: 'dirtyClose'
        /** Override the deny button label. Defaults to `g.no`. */
        denyLabel?: string
      }
    | {
        /** Pre-configured dialog type */
        type?: Exclude<ConfirmationDialogType, 'dirtyClose'>
        denyLabel?: never
      }
  )

/**
 * Minimal interface for execution error dialogs.
 * Satisfied by both ExecutionErrorWsMessage (WebSocket) and ExecutionError (Jobs API).
 */
export interface ExecutionErrorDialogInput {
  exception_type: string
  exception_message: string
  node_id?: string | number | null
  node_type?: string | null
  traceback?: string[] | null
}

export interface CoreDialogService {
  showExecutionErrorDialog(executionError: ExecutionErrorDialogInput): void
  showErrorDialog(
    error: unknown,
    options?: { title?: string; reportType?: string }
  ): void
  prompt(options: {
    title: string
    message: string
    defaultValue?: string
    placeholder?: string
  }): Promise<string | null>
  confirm(options: ConfirmOptions): Promise<boolean | null>
  showExtensionDialog(options: ShowDialogOptions & { key: string }): {
    dialog: DialogInstance | undefined
    closeDialog: () => void
  }
  showLayoutDialog<C extends Component>(options: {
    key: string
    component: C
    props: ComponentAttrs<C>
    dialogComponentProps?: DialogComponentProps
  }): DialogInstance
  showSmallLayoutDialog(
    options: Omit<ShowDialogOptions, 'dialogComponentProps'> & {
      dialogComponentProps?: Omit<DialogComponentProps, 'pt'>
    }
  ): DialogInstance
}

/**
 * Dialog surface exposed to extensions via `app.extensionManager.dialog`.
 * Feature dialogs live in their own composables; `createExtensionDialogService`
 * assembles them so this module never imports the features it fronts.
 */
export interface ExtensionDialogService extends CoreDialogService {
  showApiNodesSignInDialog(apiNodeNames: string[]): Promise<boolean>
  showSignInDialog(): Promise<boolean>
  showUpdatePasswordDialog(): Promise<DialogInstance>
  showTopUpCreditsDialog(
    options?: TopUpCreditsDialogOptions
  ): Promise<DialogInstance | undefined>
  showSubscriptionRequiredDialog(
    options?: SubscriptionDialogOptions
  ): Promise<void>
  showBillingComingSoonDialog(): DialogInstance
  showCancelSubscriptionDialog(
    cancelAt?: string,
    flowAlreadyOpened?: boolean,
    isScopeCurrent?: () => boolean,
    flowAlreadyConfirmed?: boolean
  ): Promise<DialogInstance | false>
  showCancelSubscriptionFlow(cancelAt?: string): Promise<void>
  showDowngradeToPersonalDialog(options: {
    planName: string
    planSlug: string
    paymentIntentSource?: PaymentIntentSource
  }): Promise<DowngradeToPersonalResult | null>
  showDeleteWorkspaceDialog(options?: {
    workspaceId?: string
    workspaceName?: string
  }): Promise<DialogInstance>
  showCreateWorkspaceDialog(
    onConfirm?: (name: string) => void | Promise<void>
  ): Promise<DialogInstance>
  showTeamWorkspacesDialog(
    onConfirm?: (name: string) => void | Promise<void>
  ): Promise<DialogInstance>
  showLeaveWorkspaceDialog(): Promise<DialogInstance>
  showEditWorkspaceDialog(): Promise<DialogInstance>
  showRemoveMemberDialog(memberId: string): Promise<DialogInstance>
  showChangeMemberRoleDialog(props: {
    memberId: string
    memberName: string
    targetRole: WorkspaceRole
  }): Promise<DialogInstance>
  showSetMemberCreditLimitDialog(props: {
    memberId: string
    memberName: string
    creditsUsed?: number
    currentLimit?: number | null
  }): Promise<DialogInstance>
  showInviteMemberDialog(): Promise<DialogInstance>
  showInviteMemberUpsellDialog(): Promise<DialogInstance>
  showInviteLinkInvalidDialog(): Promise<DialogInstance>
  showInviteWrongAccountDialog(props: {
    inviteToken: string
  }): Promise<DialogInstance>
  showRevokeInviteDialog(inviteId: string): Promise<DialogInstance>
  showCloudNotification(): Promise<void>
  showPublishDialog(): Promise<void>
}
