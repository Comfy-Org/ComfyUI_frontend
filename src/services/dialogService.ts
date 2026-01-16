import { merge } from 'es-toolkit/compat'
import type { Component } from 'vue'

import ApiNodesSignInContent from '@/components/dialog/content/ApiNodesSignInContent.vue'
import CreateWorkspaceDialogContent from '@/components/dialog/content/workspace/CreateWorkspaceDialogContent.vue'
import DeleteWorkspaceDialogContent from '@/components/dialog/content/workspace/DeleteWorkspaceDialogContent.vue'
import InviteMemberDialogContent from '@/components/dialog/content/workspace/InviteMemberDialogContent.vue'
import LeaveWorkspaceDialogContent from '@/components/dialog/content/workspace/LeaveWorkspaceDialogContent.vue'
import RemoveMemberDialogContent from '@/components/dialog/content/workspace/RemoveMemberDialogContent.vue'
import RevokeInviteDialogContent from '@/components/dialog/content/workspace/RevokeInviteDialogContent.vue'
import MissingNodesContent from '@/components/dialog/content/MissingNodesContent.vue'
import MissingNodesFooter from '@/components/dialog/content/MissingNodesFooter.vue'
import MissingNodesHeader from '@/components/dialog/content/MissingNodesHeader.vue'
import ConfirmationDialogContent from '@/components/dialog/content/ConfirmationDialogContent.vue'
import ErrorDialogContent from '@/components/dialog/content/ErrorDialogContent.vue'
import MissingModelsWarning from '@/components/dialog/content/MissingModelsWarning.vue'
import PromptDialogContent from '@/components/dialog/content/PromptDialogContent.vue'
import SignInContent from '@/components/dialog/content/SignInContent.vue'
import TopUpCreditsDialogContent from '@/components/dialog/content/TopUpCreditsDialogContent.vue'
import UpdatePasswordContent from '@/components/dialog/content/UpdatePasswordContent.vue'
import ComfyOrgHeader from '@/components/dialog/header/ComfyOrgHeader.vue'
import SettingDialogHeader from '@/components/dialog/header/SettingDialogHeader.vue'
import { t } from '@/i18n'
import { useTelemetry } from '@/platform/telemetry'
import { isCloud } from '@/platform/distribution/types'
import { useSubscription } from '@/platform/cloud/subscription/composables/useSubscription'
import SettingDialogContent from '@/platform/settings/components/SettingDialogContent.vue'
import { useDialogStore } from '@/stores/dialogStore'
import type {
  DialogComponentProps,
  ShowDialogOptions
} from '@/stores/dialogStore'

import ImportFailedNodeContent from '@/workbench/extensions/manager/components/manager/ImportFailedNodeContent.vue'
import ImportFailedNodeFooter from '@/workbench/extensions/manager/components/manager/ImportFailedNodeFooter.vue'
import ImportFailedNodeHeader from '@/workbench/extensions/manager/components/manager/ImportFailedNodeHeader.vue'
import NodeConflictDialogContent from '@/workbench/extensions/manager/components/manager/NodeConflictDialogContent.vue'
import NodeConflictFooter from '@/workbench/extensions/manager/components/manager/NodeConflictFooter.vue'
import NodeConflictHeader from '@/workbench/extensions/manager/components/manager/NodeConflictHeader.vue'
import type { ConflictDetectionResult } from '@/workbench/extensions/manager/types/conflictDetectionTypes'
import type { ComponentAttrs } from 'vue-component-type-helpers'

export type ConfirmationDialogType =
  | 'default'
  | 'overwrite'
  | 'overwriteBlueprint'
  | 'delete'
  | 'dirtyClose'
  | 'reinstall'

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

  function showLoadWorkflowWarning(
    props: ComponentAttrs<typeof MissingNodesContent>
  ) {
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

  function showMissingModelsWarning(
    props: ComponentAttrs<typeof MissingModelsWarning>
  ) {
    dialogStore.showDialog({
      key: 'global-missing-models-warning',
      component: MissingModelsWarning,
      props
    })
  }

  function showSettingsDialog(
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
    const props = panel ? { props: { defaultPanel: panel } } : undefined

    dialogStore.showDialog({
      key: 'global-settings',
      headerComponent: SettingDialogHeader,
      component: SettingDialogContent,
      ...props
    })
  }

  function showAboutDialog() {
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

  function showTopUpCreditsDialog(options?: {
    isInsufficientCredits?: boolean
  }) {
    const { isActiveSubscription } = useSubscription()
    if (!isActiveSubscription.value) return

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
  function showUpdatePasswordDialog() {
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

  function showImportFailedNodeDialog(
    options: {
      conflictedPackages?: ConflictDetectionResult[]
      dialogComponentProps?: DialogComponentProps
    } = {}
  ) {
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

  function showNodeConflictDialog(
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

  function showLeaveWorkspaceDialog(onConfirm: () => void | Promise<void>) {
    return dialogStore.showDialog({
      key: 'leave-workspace',
      component: LeaveWorkspaceDialogContent,
      props: { onConfirm },
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

  function showDeleteWorkspaceDialog(onConfirm: () => void | Promise<void>) {
    return dialogStore.showDialog({
      key: 'delete-workspace',
      component: DeleteWorkspaceDialogContent,
      props: { onConfirm },
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

  function showRemoveMemberDialog(onConfirm: () => void | Promise<void>) {
    return dialogStore.showDialog({
      key: 'remove-member',
      component: RemoveMemberDialogContent,
      props: { onConfirm },
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

  function showRevokeInviteDialog(onConfirm: () => void | Promise<void>) {
    return dialogStore.showDialog({
      key: 'revoke-invite',
      component: RevokeInviteDialogContent,
      props: { onConfirm },
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

  function showInviteMemberDialog(
    onConfirm: (email: string) => void | Promise<void>
  ) {
    return dialogStore.showDialog({
      key: 'invite-member',
      component: InviteMemberDialogContent,
      props: { onConfirm },
      dialogComponentProps: {
        headless: true,
        pt: {
          header: { class: 'p-0! hidden' },
          content: { class: 'p-0! m-0! rounded-2xl' },
          root: { class: 'rounded-2xl max-w-[512px] w-full' }
        }
      }
    })
  }

  function showCreateWorkspaceDialog(
    onConfirm?: (name: string) => void | Promise<void>
  ) {
    return dialogStore.showDialog({
      key: 'create-workspace',
      component: CreateWorkspaceDialogContent,
      props: { onConfirm },
      dialogComponentProps: {
        headless: true,
        pt: {
          header: { class: 'p-0! hidden' },
          content: { class: 'p-0! m-0! rounded-2xl' },
          root: { class: 'rounded-2xl max-w-[400px] w-full' }
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
    showLeaveWorkspaceDialog,
    showDeleteWorkspaceDialog,
    showRemoveMemberDialog,
    showRevokeInviteDialog,
    showInviteMemberDialog,
    showCreateWorkspaceDialog,
    showExtensionDialog,
    prompt,
    showErrorDialog,
    confirm,
    showLayoutDialog,
    showImportFailedNodeDialog,
    showNodeConflictDialog
  }
}
