import { merge } from 'es-toolkit/compat'
import { watch } from 'vue'
import type { Component } from 'vue'

import ConfirmationDialogContent from '@/components/dialog/content/ConfirmationDialogContent.vue'
import ErrorDialogContent from '@/components/dialog/content/ErrorDialogContent.vue'
import PromptDialogContent from '@/components/dialog/content/PromptDialogContent.vue'
import TopUpCreditsDialogContentLegacy from '@/components/dialog/content/TopUpCreditsDialogContentLegacy.vue'
import TopUpCreditsDialogContentWorkspace from '@/platform/workspace/components/TopUpCreditsDialogContentWorkspace.vue'
import { t } from '@/i18n'
import { useTelemetry } from '@/platform/telemetry'
import { isCloud } from '@/platform/distribution/types'
import { useBillingContext } from '@/composables/billing/useBillingContext'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { useDialogStore } from '@/stores/dialogStore'
import type {
  DialogComponentProps,
  ShowDialogOptions
} from '@/stores/dialogStore'

import type { ComponentAttrs } from 'vue-component-type-helpers'
import type { SubscriptionDialogOptions } from '@/platform/cloud/subscription/composables/useSubscriptionDialog'
import type { WorkspaceRole } from '@/platform/workspace/api/workspaceApi'
import type { DowngradeToPersonalResult } from '@/platform/workspace/composables/useDowngradeToPersonal'

// Lazy loaders for dialogs - components are loaded on first use
const lazyApiNodesSignInContent = () =>
  import('@/components/dialog/content/ApiNodesSignInContent.vue')
const lazySignInContent = () =>
  import('@/components/dialog/content/SignInContent.vue')
const lazyUpdatePasswordContent = () =>
  import('@/components/dialog/content/UpdatePasswordContent.vue')
const lazyComfyOrgHeader = () =>
  import('@/components/dialog/header/ComfyOrgHeader.vue')
const lazyCloudNotificationContent = () =>
  import('@/platform/cloud/notification/components/CloudNotificationContent.vue')
const lazyPublishDialog = () =>
  import('@/platform/workflow/sharing/components/publish/ComfyHubPublishDialog.vue')

/**
 * Shrink-wrap the Reka DialogContent around the content's intrinsic width,
 * like the auto-sized PrimeVue root it replaces.
 */
const HUG_CONTENT_CLASS =
  'w-fit max-w-[calc(100vw-1rem)] sm:max-w-[calc(100vw-1rem)]'

/**
 * Reka chrome for headless dialogs whose content draws its own panel
 * (background/border/rounding) — neutralize the DialogContent box and
 * shrink-wrap it around the content.
 */
const SELF_STYLED_PANEL_CONTENT_CLASS = `${HUG_CONTENT_CLASS} border-none bg-transparent shadow-none`

export type ConfirmationDialogType =
  | 'default'
  | 'overwrite'
  | 'overwriteBlueprint'
  | 'delete'
  | 'dirtyClose'
  | 'reinstall'
  | 'info'

interface BaseConfirmOptions {
  /** Dialog heading */
  title: string
  /** The main message body */
  message: string
  /** Displayed as an unordered list immediately below the message body */
  itemList?: string[]
  hint?: string
}

type ConfirmOptions = BaseConfirmOptions &
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
  node_id: string | number
  node_type: string
  traceback: string[]
}

export const useDialogService = () => {
  const dialogStore = useDialogStore()

  function showExecutionErrorDialog(executionError: ExecutionErrorDialogInput) {
    const props: ComponentAttrs<typeof ErrorDialogContent> = {
      error: {
        exceptionType: executionError.exception_type,
        exceptionMessage: executionError.exception_message,
        nodeId: executionError.node_id?.toString(),
        nodeType: executionError.node_type,
        traceback: executionError.traceback.join('\n'),
        reportType: 'graphExecutionError'
      }
    }

    dialogStore.showDialog({
      key: 'global-execution-error',
      component: ErrorDialogContent,
      props,
      dialogComponentProps: {
        renderer: 'reka',
        size: 'lg',
        onClose: () => {
          useTelemetry()?.trackUiButtonClicked({
            button_id: 'error_dialog_closed',
            element_group: 'error_dialog'
          })
        }
      }
    })
  }

  function parseError(error: Error) {
    const filename =
      'fileName' in error
        ? (error.fileName as string)
        : error.stack?.match(/(\/extensions\/.*\.js)/)?.[1]

    const extensionFile = filename
      ? filename.substring(filename.indexOf('/extensions/'))
      : undefined

    return {
      errorMessage: error.toString(),
      stackTrace: error.stack,
      extensionFile
    }
  }

  /**
   * Show a error dialog to the user when an error occurs.
   * @param error The error to show
   * @param options The options for the dialog
   */
  function showErrorDialog(
    error: unknown,
    options: {
      title?: string
      reportType?: string
    } = {}
  ) {
    const errorProps: {
      errorMessage: string
      stackTrace?: string
      extensionFile?: string
    } =
      error instanceof Error
        ? parseError(error)
        : {
            errorMessage: String(error)
          }

    const props: ComponentAttrs<typeof ErrorDialogContent> = {
      error: {
        exceptionType: options.title ?? 'Unknown Error',
        exceptionMessage: errorProps.errorMessage,
        extensionFile: errorProps.extensionFile,
        traceback: errorProps.stackTrace ?? t('errorDialog.noStackTrace'),
        reportType: options.reportType
      }
    }

    dialogStore.showDialog({
      key: 'global-error',
      component: ErrorDialogContent,
      props,
      dialogComponentProps: {
        renderer: 'reka',
        size: 'lg',
        onClose: () => {
          useTelemetry()?.trackUiButtonClicked({
            button_id: 'error_dialog_closed',
            element_group: 'error_dialog'
          })
        }
      }
    })
  }

  /**
   * Shows a dialog requiring sign in for API nodes
   * @returns Promise that resolves to true if user clicks login, false if cancelled
   */
  async function showApiNodesSignInDialog(
    apiNodeNames: string[]
  ): Promise<boolean> {
    const [{ default: ApiNodesSignInContent }, { default: ComfyOrgHeader }] =
      await Promise.all([lazyApiNodesSignInContent(), lazyComfyOrgHeader()])

    return new Promise<boolean>((resolve) => {
      dialogStore.showDialog({
        key: 'api-nodes-signin',
        component: ApiNodesSignInContent,
        props: {
          apiNodeNames,
          onLogin: () => showSignInDialog().then((result) => resolve(result)),
          onCancel: () => resolve(false)
        },
        headerComponent: ComfyOrgHeader,
        dialogComponentProps: {
          renderer: 'reka',
          contentClass: HUG_CONTENT_CLASS,
          closable: false,
          onClose: () => resolve(false)
        }
      })
    }).then((result) => {
      dialogStore.closeDialog({ key: 'api-nodes-signin' })
      return result
    })
  }

  async function showSignInDialog(): Promise<boolean> {
    const [{ default: SignInContent }, { default: ComfyOrgHeader }] =
      await Promise.all([lazySignInContent(), lazyComfyOrgHeader()])

    return new Promise<boolean>((resolve) => {
      dialogStore.showDialog({
        key: 'global-signin',
        component: SignInContent,
        headerComponent: ComfyOrgHeader,
        props: {
          onSuccess: () => resolve(true)
        },
        dialogComponentProps: {
          renderer: 'reka',
          // SignInContent is a fixed w-96 — size 'sm' (max-w-sm) leaves only
          // 352px after the body padding; hug the intrinsic width instead.
          contentClass: HUG_CONTENT_CLASS,
          closable: true,
          onClose: () => resolve(false)
        }
      })
    }).then((result) => {
      dialogStore.closeDialog({ key: 'global-signin' })
      return result
    })
  }

  async function prompt({
    title,
    message,
    defaultValue = '',
    placeholder
  }: {
    title: string
    message: string
    defaultValue?: string
    placeholder?: string
  }): Promise<string | null> {
    return new Promise((resolve) => {
      dialogStore.showDialog({
        key: 'global-prompt',
        title,
        component: PromptDialogContent,
        props: {
          message,
          defaultValue,
          onConfirm: (value: string) => {
            resolve(value)
          },
          placeholder
        },
        dialogComponentProps: {
          renderer: 'reka',
          size: 'md',
          onClose: () => {
            resolve(null)
          }
        }
      })
    })
  }

  /**
   * @returns `true` if the user confirms the dialog,
   * `false` if denied (e.g. no in yes/no/cancel), or
   * `null` if the dialog is cancelled or closed
   */
  async function confirm({
    title,
    message,
    type = 'default',
    itemList = [],
    hint,
    denyLabel
  }: ConfirmOptions): Promise<boolean | null> {
    return new Promise((resolve) => {
      const options: ShowDialogOptions = {
        key: 'global-prompt',
        title,
        component: ConfirmationDialogContent,
        props: {
          message,
          type,
          itemList,
          onConfirm: resolve,
          hint,
          denyLabel
        },
        dialogComponentProps: {
          renderer: 'reka',
          size: 'md',
          onClose: () => resolve(null)
        }
      }

      dialogStore.showDialog(options)
    })
  }

  async function showTopUpCreditsDialog(options?: {
    isInsufficientCredits?: boolean
  }) {
    const { isActiveSubscription, isFreeTier, type } = useBillingContext()
    if (!isActiveSubscription.value || isFreeTier.value) {
      await showSubscriptionRequiredDialog({
        reason: options?.isInsufficientCredits
          ? 'out_of_credits'
          : 'top_up_blocked'
      })
      return
    }

    const component =
      type.value === 'workspace'
        ? TopUpCreditsDialogContentWorkspace
        : TopUpCreditsDialogContentLegacy

    return dialogStore.showDialog({
      key: 'top-up-credits',
      component,
      props: options,
      dialogComponentProps: {
        renderer: 'reka',
        headless: true,
        contentClass: SELF_STYLED_PANEL_CONTENT_CLASS
      }
    })
  }

  /**
   * Shows a dialog for updating the current user's password.
   */
  async function showUpdatePasswordDialog() {
    const [{ default: UpdatePasswordContent }, { default: ComfyOrgHeader }] =
      await Promise.all([lazyUpdatePasswordContent(), lazyComfyOrgHeader()])

    return dialogStore.showDialog({
      key: 'global-update-password',
      component: UpdatePasswordContent,
      headerComponent: ComfyOrgHeader,
      props: {
        onSuccess: () =>
          dialogStore.closeDialog({ key: 'global-update-password' })
      },
      dialogComponentProps: {
        renderer: 'reka',
        contentClass: HUG_CONTENT_CLASS
      }
    })
  }

  /**
   * Shows a dialog from a third party extension.
   * @param options - The dialog options.
   * @param options.key - The dialog key.
   * @param options.title - The dialog title.
   * @param options.headerComponent - The dialog header component.
   * @param options.footerComponent - The dialog footer component.
   * @param options.component - The dialog component.
   * @param options.props - The dialog props.
   * @returns The dialog instance and a function to close the dialog.
   */
  function showExtensionDialog(options: ShowDialogOptions & { key: string }) {
    return {
      dialog: dialogStore.showExtensionDialog(options),
      closeDialog: () => dialogStore.closeDialog({ key: options.key })
    }
  }

  function showLayoutDialog<C extends Component>(options: {
    key: string
    component: C
    props: ComponentAttrs<C>
    dialogComponentProps?: DialogComponentProps
  }) {
    const layoutDefaultProps: DialogComponentProps = {
      renderer: 'reka',
      headless: true,
      modal: true,
      closable: true
    }

    return dialogStore.showDialog({
      ...options,
      dialogComponentProps: merge(
        layoutDefaultProps,
        options.dialogComponentProps || {}
      )
    })
  }

  function showSmallLayoutDialog(
    options: Omit<ShowDialogOptions, 'dialogComponentProps'> & {
      dialogComponentProps?: Omit<DialogComponentProps, 'pt'>
    }
  ) {
    const { dialogComponentProps: callerProps, ...rest } = options

    return dialogStore.showDialog({
      ...rest,
      dialogComponentProps: {
        renderer: 'reka',
        closable: true,
        // Contents bring their own width and separators — shrink-wrap the
        // chrome and zero the section padding.
        contentClass:
          'w-fit max-w-[calc(100vw-1rem)] sm:max-w-[calc(100vw-1rem)] border-border-default',
        headerClass: 'p-0',
        bodyClass: 'p-0 overflow-y-hidden',
        footerClass: 'p-0',
        ...callerProps
      }
    })
  }

  async function showSubscriptionRequiredDialog(
    options?: SubscriptionDialogOptions
  ) {
    if (!isCloud || !window.__CONFIG__?.subscription_required) {
      return
    }

    const { useSubscriptionDialog } =
      await import('@/platform/cloud/subscription/composables/useSubscriptionDialog')
    const { show } = useSubscriptionDialog()
    show(options)
  }

  // Workspace dialogs - dynamically imported to avoid bundling when feature flag is off
  const workspaceDialogProps = {
    renderer: 'reka',
    headless: true,
    contentClass: SELF_STYLED_PANEL_CONTENT_CLASS
  } as const

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

  function showBillingComingSoonDialog() {
    return dialogStore.showDialog({
      key: 'billing-coming-soon',
      title: t('subscription.billingComingSoon.title'),
      component: ConfirmationDialogContent,
      props: {
        message: t('subscription.billingComingSoon.message'),
        type: 'info' as ConfirmationDialogType,
        onConfirm: () => {}
      },
      dialogComponentProps: {
        renderer: 'reka',
        size: 'sm',
        contentClass: 'max-w-[360px]'
      }
    })
  }

  async function showCancelSubscriptionDialog(cancelAt?: string) {
    const { default: component } =
      await import('@/components/dialog/content/subscription/CancelSubscriptionDialogContent.vue')
    return dialogStore.showDialog({
      key: 'cancel-subscription',
      component,
      props: { cancelAt },
      dialogComponentProps: {
        ...workspaceDialogProps
      }
    })
  }

  /**
   * Downgrade a team plan to a personal plan (FE-977). Skips the type-"I
   * understand" confirm dialog when the workspace has no other members;
   * failures on that path surface as an error toast.
   */
  async function showDowngradeToPersonalDialog(options: {
    planName: string
    planSlug: string
  }): Promise<DowngradeToPersonalResult | null> {
    const { useDowngradeToPersonal } =
      await import('@/platform/workspace/composables/useDowngradeToPersonal')
    const { hasOtherMembers, refreshMembers, downgradeToPersonal } =
      useDowngradeToPersonal()

    try {
      await refreshMembers()
      if (!hasOtherMembers.value) {
        return await downgradeToPersonal(options.planSlug)
      }
    } catch (error) {
      useToastStore().add({
        severity: 'error',
        summary: t('subscription.downgrade.failed'),
        detail: error instanceof Error ? error.message : t('g.unknownError')
      })
      return null
    }

    const { default: component } =
      await import('@/platform/workspace/components/dialogs/DowngradeRemoveMembersDialogContent.vue')
    const dialogKey = 'downgrade-remove-members'
    dialogStore.closeDialog({ key: dialogKey })
    return new Promise((resolve) => {
      const stopWatching = watch(
        () => dialogStore.isDialogOpen(dialogKey),
        (isOpen) => {
          if (!isOpen) resolveResult(null)
        },
        { flush: 'sync' }
      )
      function resolveResult(result: DowngradeToPersonalResult | null) {
        stopWatching()
        resolve(result)
      }

      dialogStore.showDialog({
        key: dialogKey,
        component,
        props: {
          planName: options.planName,
          planSlug: options.planSlug,
          onConfirm: async (planSlug: string) => {
            const result = await downgradeToPersonal(planSlug)
            resolveResult(result)
          }
        },
        dialogComponentProps: {
          ...workspaceDialogProps,
          closable: false,
          dismissableMask: false,
          onClose: () => resolveResult(null)
        }
      })
    })
  }

  /** Shows one-time cloud notification modal for macOS desktop users. */
  async function showCloudNotification(): Promise<void> {
    const { default: component } = await lazyCloudNotificationContent()
    return new Promise<void>((resolve) => {
      showLayoutDialog({
        key: 'global-cloud-notification',
        component,
        props: {},
        dialogComponentProps: {
          closable: false,
          contentClass:
            'w-170 max-w-[calc(100vw-1rem)] sm:max-w-[42.5rem] rounded-2xl overflow-hidden',
          onClose: () => resolve()
        }
      })
    })
  }

  async function showPublishDialog(): Promise<void> {
    const { default: ComfyHubPublishDialog } = await lazyPublishDialog()
    const key = 'global-comfyhub-publish'
    showLayoutDialog({
      key,
      component: ComfyHubPublishDialog,
      props: {
        onClose: () => dialogStore.closeDialog({ key }),
        // Falls through to the BaseModalLayout root — keeps the e2e
        // publish-dialog selector working without the PrimeVue pt hook.
        'data-testid': 'publish-dialog'
      },
      dialogComponentProps: {
        contentClass: SELF_STYLED_PANEL_CONTENT_CLASS
      }
    })
  }

  return {
    showExecutionErrorDialog,
    showApiNodesSignInDialog,
    showSignInDialog,
    showPublishDialog,
    showSubscriptionRequiredDialog,
    showTopUpCreditsDialog,
    showUpdatePasswordDialog,
    showExtensionDialog,
    showCloudNotification,
    prompt,
    showErrorDialog,
    confirm,
    showLayoutDialog,
    showSmallLayoutDialog,
    showDeleteWorkspaceDialog,
    showCreateWorkspaceDialog,
    showTeamWorkspacesDialog,
    showLeaveWorkspaceDialog,
    showEditWorkspaceDialog,
    showRemoveMemberDialog,
    showChangeMemberRoleDialog,
    showRevokeInviteDialog,
    showInviteMemberDialog,
    showInviteMemberUpsellDialog,
    showBillingComingSoonDialog,
    showCancelSubscriptionDialog,
    showDowngradeToPersonalDialog
  }
}
