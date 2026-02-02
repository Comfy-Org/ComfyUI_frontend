import { merge } from 'es-toolkit/compat'
import type { Component } from 'vue'

import ConfirmationDialogContent from '@/components/dialog/content/ConfirmationDialogContent.vue'
import ErrorDialogContent from '@/components/dialog/content/ErrorDialogContent.vue'
import PromptDialogContent from '@/components/dialog/content/PromptDialogContent.vue'
import { t } from '@/i18n'
import { useTelemetry } from '@/platform/telemetry'
import { isCloud } from '@/platform/distribution/types'
import { useSubscription } from '@/platform/cloud/subscription/composables/useSubscription'
import { useDialogStore } from '@/stores/dialogStore'
import type {
  DialogComponentProps,
  ShowDialogOptions
} from '@/stores/dialogStore'

import type { ConflictDetectionResult } from '@/workbench/extensions/manager/types/conflictDetectionTypes'
import type { ComponentAttrs } from 'vue-component-type-helpers'

// Type-only imports for ComponentAttrs inference (no runtime cost)
import type MissingNodesContent from '@/components/dialog/content/MissingNodesContent.vue'
import type MissingModelsWarning from '@/components/dialog/content/MissingModelsWarning.vue'

// Lazy loaders for dialogs - components are loaded on first use
const lazyMissingNodesContent = () =>
  import('@/components/dialog/content/MissingNodesContent.vue')
const lazyMissingNodesHeader = () =>
  import('@/components/dialog/content/MissingNodesHeader.vue')
const lazyMissingNodesFooter = () =>
  import('@/components/dialog/content/MissingNodesFooter.vue')
const lazyMissingModelsWarning = () =>
  import('@/components/dialog/content/MissingModelsWarning.vue')
const lazyApiNodesSignInContent = () =>
  import('@/components/dialog/content/ApiNodesSignInContent.vue')
const lazySignInContent = () =>
  import('@/components/dialog/content/SignInContent.vue')
const lazyTopUpCreditsDialogContent = () =>
  import('@/components/dialog/content/TopUpCreditsDialogContent.vue')
const lazyUpdatePasswordContent = () =>
  import('@/components/dialog/content/UpdatePasswordContent.vue')
const lazyComfyOrgHeader = () =>
  import('@/components/dialog/header/ComfyOrgHeader.vue')
const lazySettingDialogHeader = () =>
  import('@/components/dialog/header/SettingDialogHeader.vue')
const lazySettingDialogContent = () =>
  import('@/platform/settings/components/SettingDialogContent.vue')
const lazyImportFailedNodeContent = () =>
  import('@/workbench/extensions/manager/components/manager/ImportFailedNodeContent.vue')
const lazyImportFailedNodeHeader = () =>
  import('@/workbench/extensions/manager/components/manager/ImportFailedNodeHeader.vue')
const lazyImportFailedNodeFooter = () =>
  import('@/workbench/extensions/manager/components/manager/ImportFailedNodeFooter.vue')
const lazyNodeConflictDialogContent = () =>
  import('@/workbench/extensions/manager/components/manager/NodeConflictDialogContent.vue')
const lazyNodeConflictHeader = () =>
  import('@/workbench/extensions/manager/components/manager/NodeConflictHeader.vue')
const lazyNodeConflictFooter = () =>
  import('@/workbench/extensions/manager/components/manager/NodeConflictFooter.vue')

export type ConfirmationDialogType =
  | 'default'
  | 'overwrite'
  | 'overwriteBlueprint'
  | 'delete'
  | 'dirtyClose'
  | 'reinstall'
  | 'info'

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

  async function showLoadWorkflowWarning(
    props: ComponentAttrs<typeof MissingNodesContent>
  ) {
    const [
      { default: MissingNodesContent },
      { default: MissingNodesHeader },
      { default: MissingNodesFooter }
    ] = await Promise.all([
      lazyMissingNodesContent(),
      lazyMissingNodesHeader(),
      lazyMissingNodesFooter()
    ])

    dialogStore.showDialog({
      key: 'global-missing-nodes',
      headerComponent: MissingNodesHeader,
      footerComponent: MissingNodesFooter,
      component: MissingNodesContent,
      dialogComponentProps: {
        closable: true,
        pt: {
          root: { class: 'bg-base-background border-border-default' },
          header: { class: '!p-0 !m-0' },
          content: { class: '!p-0 overflow-y-hidden' },
          footer: { class: '!p-0' },
          pcCloseButton: {
            root: {
              class: '!w-7 !h-7 !border-none !outline-none !p-2 !m-1.5'
            }
          }
        }
      },
      props
    })
  }

  async function showMissingModelsWarning(
    props: ComponentAttrs<typeof MissingModelsWarning>
  ) {
    const { default: MissingModelsWarning } = await lazyMissingModelsWarning()
    dialogStore.showDialog({
      key: 'global-missing-models-warning',
      component: MissingModelsWarning,
      props
    })
  }

  async function showSettingsDialog(
    panel?:
      | 'about'
      | 'keybinding'
      | 'extension'
      | 'server-config'
      | 'user'
      | 'credits'
      | 'subscription'
      | 'workspace'
  ) {
    const [
      { default: SettingDialogHeader },
      { default: SettingDialogContent }
    ] = await Promise.all([
      lazySettingDialogHeader(),
      lazySettingDialogContent()
    ])

    const props = panel ? { props: { defaultPanel: panel } } : undefined

    dialogStore.showDialog({
      key: 'global-settings',
      headerComponent: SettingDialogHeader,
      component: SettingDialogContent,
      ...props
    })
  }

  async function showAboutDialog() {
    const [
      { default: SettingDialogHeader },
      { default: SettingDialogContent }
    ] = await Promise.all([
      lazySettingDialogHeader(),
      lazySettingDialogContent()
    ])

    dialogStore.showDialog({
      key: 'global-settings',
      headerComponent: SettingDialogHeader,
      component: SettingDialogContent,
      props: {
        defaultPanel: 'about'
      }
    })
  }

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
        onClose: () => {
          useTelemetry()?.trackUiButtonClicked({
            button_id: 'error_dialog_closed'
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
        traceback: errorProps.stackTrace ?? t('errorDialog.noStackTrace'),
        reportType: options.reportType
      }
    }

    dialogStore.showDialog({
      key: 'global-error',
      component: ErrorDialogContent,
      props,
      dialogComponentProps: {
        onClose: () => {
          useTelemetry()?.trackUiButtonClicked({
            button_id: 'error_dialog_closed'
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
    hint
  }: {
    /** Dialog heading */
    title: string
    /** The main message body */
    message: string
    /** Pre-configured dialog type */
    type?: ConfirmationDialogType
    /** Displayed as an unordered list immediately below the message body */
    itemList?: string[]
    hint?: string
  }): Promise<boolean | null> {
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
          hint
        },
        dialogComponentProps: {
          onClose: () => resolve(null)
        }
      }

      dialogStore.showDialog(options)
    })
  }

  async function showTopUpCreditsDialog(options?: {
    isInsufficientCredits?: boolean
  }) {
    const { isActiveSubscription } = useSubscription()
    if (!isActiveSubscription.value) return

    const { default: TopUpCreditsDialogContent } =
      await lazyTopUpCreditsDialogContent()

    return dialogStore.showDialog({
      key: 'top-up-credits',
      component: TopUpCreditsDialogContent,
      props: options,
      dialogComponentProps: {
        headless: true,
        pt: {
          header: { class: 'p-0! hidden' },
          content: { class: 'p-0! m-0! rounded-2xl' },
          root: { class: 'rounded-2xl' }
        }
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

  function showLayoutDialog(options: {
    key: string
    component: Component
    props: { onClose: () => void } & Record<string, unknown>
    dialogComponentProps?: DialogComponentProps
  }) {
    const layoutDefaultProps: DialogComponentProps = {
      headless: true,
      modal: true,
      closable: false,
      pt: {
        root: {
          class: 'rounded-2xl overflow-hidden'
        },
        header: {
          class: 'p-0! hidden'
        },
        content: {
          class: 'p-0! m-0!'
        }
      }
    }

    return dialogStore.showDialog({
      ...options,
      dialogComponentProps: merge(
        layoutDefaultProps,
        options.dialogComponentProps || {}
      )
    })
  }

  async function showImportFailedNodeDialog(
    options: {
      conflictedPackages?: ConflictDetectionResult[]
      dialogComponentProps?: DialogComponentProps
    } = {}
  ) {
    const [
      { default: ImportFailedNodeHeader },
      { default: ImportFailedNodeFooter },
      { default: ImportFailedNodeContent }
    ] = await Promise.all([
      lazyImportFailedNodeHeader(),
      lazyImportFailedNodeFooter(),
      lazyImportFailedNodeContent()
    ])

    const { dialogComponentProps, conflictedPackages } = options

    return dialogStore.showDialog({
      key: 'global-import-failed',
      headerComponent: ImportFailedNodeHeader,
      footerComponent: ImportFailedNodeFooter,
      component: ImportFailedNodeContent,
      dialogComponentProps: {
        closable: true,
        pt: {
          root: { class: 'bg-base-background border-border-default' },
          header: { class: '!p-0 !m-0' },
          content: { class: '!p-0 overflow-y-hidden' },
          footer: { class: '!p-0' },
          pcCloseButton: {
            root: {
              class: '!w-7 !h-7 !border-none !outline-none !p-2 !m-1.5'
            }
          }
        },
        ...dialogComponentProps
      },
      props: {
        conflictedPackages: conflictedPackages ?? []
      },
      footerProps: {
        conflictedPackages: conflictedPackages ?? []
      }
    })
  }

  async function showNodeConflictDialog(
    options: {
      showAfterWhatsNew?: boolean
      conflictedPackages?: ConflictDetectionResult[]
      dialogComponentProps?: DialogComponentProps
      buttonText?: string
      onButtonClick?: () => void
    } = {}
  ) {
    const [
      { default: NodeConflictHeader },
      { default: NodeConflictFooter },
      { default: NodeConflictDialogContent }
    ] = await Promise.all([
      lazyNodeConflictHeader(),
      lazyNodeConflictFooter(),
      lazyNodeConflictDialogContent()
    ])

    const {
      dialogComponentProps,
      buttonText,
      onButtonClick,
      showAfterWhatsNew,
      conflictedPackages
    } = options

    return dialogStore.showDialog({
      key: 'global-node-conflict',
      headerComponent: NodeConflictHeader,
      footerComponent: NodeConflictFooter,
      component: NodeConflictDialogContent,
      dialogComponentProps: {
        closable: true,
        pt: {
          header: { class: '!p-0 !m-0' },
          content: { class: '!p-0 overflow-y-hidden' },
          footer: { class: '!p-0' },
          pcCloseButton: {
            root: {
              class:
                '!w-7 !h-7 !border-none !outline-none !p-2 !m-1.5 bg-dialog-surface text-white'
            }
          }
        },
        ...dialogComponentProps
      },
      props: {
        showAfterWhatsNew,
        conflictedPackages
      },
      footerProps: {
        buttonText,
        onButtonClick
      }
    })
  }

  async function showSubscriptionRequiredDialog() {
    if (!isCloud || !window.__CONFIG__?.subscription_required) {
      return
    }

    const { useSubscriptionDialog } =
      await import('@/platform/cloud/subscription/composables/useSubscriptionDialog')
    const { show } = useSubscriptionDialog()
    show()
  }

  // Workspace dialogs - dynamically imported to avoid bundling when feature flag is off
  const workspaceDialogPt = {
    headless: true,
    pt: {
      header: { class: 'p-0! hidden' },
      content: { class: 'p-0! m-0! rounded-2xl' },
      root: { class: 'rounded-2xl' }
    }
  } as const

  async function showDeleteWorkspaceDialog(options?: {
    workspaceId?: string
    workspaceName?: string
  }) {
    const { default: component } =
      await import('@/components/dialog/content/workspace/DeleteWorkspaceDialogContent.vue')
    return dialogStore.showDialog({
      key: 'delete-workspace',
      component,
      props: options,
      dialogComponentProps: workspaceDialogPt
    })
  }

  async function showCreateWorkspaceDialog(
    onConfirm?: (name: string) => void | Promise<void>
  ) {
    const { default: component } =
      await import('@/components/dialog/content/workspace/CreateWorkspaceDialogContent.vue')
    return dialogStore.showDialog({
      key: 'create-workspace',
      component,
      props: { onConfirm },
      dialogComponentProps: {
        ...workspaceDialogPt,
        pt: {
          ...workspaceDialogPt.pt,
          root: { class: 'rounded-2xl max-w-[400px] w-full' }
        }
      }
    })
  }

  async function showLeaveWorkspaceDialog() {
    const { default: component } =
      await import('@/components/dialog/content/workspace/LeaveWorkspaceDialogContent.vue')
    return dialogStore.showDialog({
      key: 'leave-workspace',
      component,
      dialogComponentProps: workspaceDialogPt
    })
  }

  async function showEditWorkspaceDialog() {
    const { default: component } =
      await import('@/components/dialog/content/workspace/EditWorkspaceDialogContent.vue')
    return dialogStore.showDialog({
      key: 'edit-workspace',
      component,
      dialogComponentProps: {
        ...workspaceDialogPt,
        pt: {
          ...workspaceDialogPt.pt,
          root: { class: 'rounded-2xl max-w-[400px] w-full' }
        }
      }
    })
  }

  async function showRemoveMemberDialog(memberId: string) {
    const { default: component } =
      await import('@/components/dialog/content/workspace/RemoveMemberDialogContent.vue')
    return dialogStore.showDialog({
      key: 'remove-member',
      component,
      props: { memberId },
      dialogComponentProps: workspaceDialogPt
    })
  }

  async function showInviteMemberDialog() {
    const { default: component } =
      await import('@/components/dialog/content/workspace/InviteMemberDialogContent.vue')
    return dialogStore.showDialog({
      key: 'invite-member',
      component,
      dialogComponentProps: {
        ...workspaceDialogPt,
        pt: {
          ...workspaceDialogPt.pt,
          root: { class: 'rounded-2xl max-w-[512px] w-full' }
        }
      }
    })
  }

  async function showRevokeInviteDialog(inviteId: string) {
    const { default: component } =
      await import('@/components/dialog/content/workspace/RevokeInviteDialogContent.vue')
    return dialogStore.showDialog({
      key: 'revoke-invite',
      component,
      props: { inviteId },
      dialogComponentProps: workspaceDialogPt
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
        pt: {
          root: { class: 'max-w-[360px]' }
        }
      }
    })
  }

  return {
    showLoadWorkflowWarning,
    showMissingModelsWarning,
    showSettingsDialog,
    showAboutDialog,
    showExecutionErrorDialog,
    showApiNodesSignInDialog,
    showSignInDialog,
    showSubscriptionRequiredDialog,
    showTopUpCreditsDialog,
    showUpdatePasswordDialog,
    showExtensionDialog,
    prompt,
    showErrorDialog,
    confirm,
    showLayoutDialog,
    showImportFailedNodeDialog,
    showNodeConflictDialog,
    showDeleteWorkspaceDialog,
    showCreateWorkspaceDialog,
    showLeaveWorkspaceDialog,
    showEditWorkspaceDialog,
    showRemoveMemberDialog,
    showRevokeInviteDialog,
    showInviteMemberDialog,
    showBillingComingSoonDialog
  }
}
