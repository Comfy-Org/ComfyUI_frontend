import { merge } from 'es-toolkit/compat'
import type { Component } from 'vue'

import type MissingModelsWarning from '@/components/dialog/content/MissingModelsWarning.vue'
import type MissingNodesContent from '@/components/dialog/content/MissingNodesContent.vue'
import { t } from '@/i18n'
import { isCloud } from '@/platform/distribution/types'
import { useSubscription } from '@/platform/cloud/subscription/composables/useSubscription'
import { useTelemetry } from '@/platform/telemetry'
import { useDialogStore } from '@/stores/dialogStore'
import type {
  DialogComponentProps,
  ShowDialogOptions
} from '@/stores/dialogStore'
import type { ConflictDetectionResult } from '@/workbench/extensions/manager/types/conflictDetectionTypes'
import type { ComponentAttrs } from 'vue-component-type-helpers'

import type {
  ConfirmationDialogType,
  ExecutionErrorDialogInput
} from './dialogTypes'

export type {
  ConfirmationDialogType,
  ExecutionErrorDialogInput
} from './dialogTypes'

export const useDialogService = () => {
  const dialogStore = useDialogStore()

  async function showLoadWorkflowWarning(
    props: ComponentAttrs<typeof MissingNodesContent>
  ) {
    const [
      { default: MissingNodesHeader },
      { default: MissingNodesFooter },
      { default: MissingNodesContent }
    ] = await Promise.all([
      import('@/components/dialog/content/MissingNodesHeader.vue'),
      import('@/components/dialog/content/MissingNodesFooter.vue'),
      import('@/components/dialog/content/MissingNodesContent.vue')
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
    const { default: MissingModelsWarning } =
      await import('@/components/dialog/content/MissingModelsWarning.vue')
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
      import('@/components/dialog/header/SettingDialogHeader.vue'),
      import('@/platform/settings/components/SettingDialogContent.vue')
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
      import('@/components/dialog/header/SettingDialogHeader.vue'),
      import('@/platform/settings/components/SettingDialogContent.vue')
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

  async function showExecutionErrorDialog(
    executionError: ExecutionErrorDialogInput
  ) {
    const { default: ErrorDialogContent } =
      await import('@/components/dialog/content/ErrorDialogContent.vue')
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
  async function showErrorDialog(
    error: unknown,
    options: {
      title?: string
      reportType?: string
    } = {}
  ) {
    const { default: ErrorDialogContent } =
      await import('@/components/dialog/content/ErrorDialogContent.vue')
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
      await Promise.all([
        import('@/components/dialog/content/ApiNodesSignInContent.vue'),
        import('@/components/dialog/header/ComfyOrgHeader.vue')
      ])
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
      await Promise.all([
        import('@/components/dialog/content/SignInContent.vue'),
        import('@/components/dialog/header/ComfyOrgHeader.vue')
      ])
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
    const { default: PromptDialogContent } =
      await import('@/components/dialog/content/PromptDialogContent.vue')
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
    const { default: ConfirmationDialogContent } =
      await import('@/components/dialog/content/ConfirmationDialogContent.vue')
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
      await import('@/components/dialog/content/TopUpCreditsDialogContent.vue')
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
      await Promise.all([
        import('@/components/dialog/content/UpdatePasswordContent.vue'),
        import('@/components/dialog/header/ComfyOrgHeader.vue')
      ])
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
    const { dialogComponentProps, conflictedPackages } = options

    const [
      { default: ImportFailedNodeHeader },
      { default: ImportFailedNodeFooter },
      { default: ImportFailedNodeContent }
    ] = await Promise.all([
      import('@/workbench/extensions/manager/components/manager/ImportFailedNodeHeader.vue'),
      import('@/workbench/extensions/manager/components/manager/ImportFailedNodeFooter.vue'),
      import('@/workbench/extensions/manager/components/manager/ImportFailedNodeContent.vue')
    ])

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
    const {
      dialogComponentProps,
      buttonText,
      onButtonClick,
      showAfterWhatsNew,
      conflictedPackages
    } = options

    const [
      { default: NodeConflictHeader },
      { default: NodeConflictFooter },
      { default: NodeConflictDialogContent }
    ] = await Promise.all([
      import('@/workbench/extensions/manager/components/manager/NodeConflictHeader.vue'),
      import('@/workbench/extensions/manager/components/manager/NodeConflictFooter.vue'),
      import('@/workbench/extensions/manager/components/manager/NodeConflictDialogContent.vue')
    ])

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

  async function showBillingComingSoonDialog() {
    const { default: ConfirmationDialogContent } =
      await import('@/components/dialog/content/ConfirmationDialogContent.vue')
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
