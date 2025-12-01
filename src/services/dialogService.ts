import { merge } from 'es-toolkit/compat'
import type { Component } from 'vue'

import ApiNodesSignInContent from '@/components/dialog/content/ApiNodesSignInContent.vue'
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
import type { ExecutionErrorWsMessage } from '@/schemas/apiSchema'
import { useDialogStore } from '@/stores/dialogStore'
import type {
  DialogComponentProps,
  ShowDialogOptions
} from '@/stores/dialogStore'
import ManagerProgressDialogContent from '@/workbench/extensions/manager/components/ManagerProgressDialogContent.vue'
import ManagerProgressFooter from '@/workbench/extensions/manager/components/ManagerProgressFooter.vue'
import ManagerProgressHeader from '@/workbench/extensions/manager/components/ManagerProgressHeader.vue'
import ManagerDialogContent from '@/workbench/extensions/manager/components/manager/ManagerDialogContent.vue'
import ManagerHeader from '@/workbench/extensions/manager/components/manager/ManagerHeader.vue'
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

export const useDialogService = () => {
  const dialogStore = useDialogStore()

  /**
   * Open the global missing-nodes dialog and forward the provided props to its content component.
   *
   * @param props - Props passed through to the MissingNodesContent component
   */
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

  /**
   * Show the global missing-models warning dialog.
   *
   * @param props - Props forwarded to the MissingModelsWarning component
   */
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
  ) {
    const props = panel ? { props: { defaultPanel: panel } } : undefined

    dialogStore.showDialog({
      key: 'global-settings',
      headerComponent: SettingDialogHeader,
      component: SettingDialogContent,
      ...props
    })
  }

  /**
   * Opens the global settings dialog with the About panel selected.
   *
   * Displays the settings dialog and sets its default inner panel to "about".
   */
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

  /**
   * Shows the global execution error dialog populated from a websocket execution error message.
   *
   * Displays a dialog containing the error details from `executionError` and records a telemetry event when the dialog is closed.
   *
   * @param executionError - Websocket execution error message containing `exception_type`, `exception_message`, `node_id`, `node_type`, and `traceback`
   */
  function showExecutionErrorDialog(executionError: ExecutionErrorWsMessage) {
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

  /**
   * Opens the global manager dialog using the default manager layout and styling and forwards props to the dialog content.
   *
   * @param props - Props to pass through to ManagerDialogContent (defaults to an empty object)
   */
  function showManagerDialog(
    props: ComponentAttrs<typeof ManagerDialogContent> = {}
  ) {
    dialogStore.showDialog({
      key: 'global-manager',
      component: ManagerDialogContent,
      headerComponent: ManagerHeader,
      dialogComponentProps: {
        closable: true,
        pt: {
          pcCloseButton: {
            root: {
              class: 'bg-dialog-surface w-9 h-9 p-1.5 rounded-full text-white'
            }
          },
          header: { class: 'py-0! px-6 m-0! h-[68px]' },
          content: {
            class: 'p-0! h-full w-[90vw] max-w-full flex-1 overflow-hidden'
          },
          root: { class: 'manager-dialog' }
        }
      },
      props
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
   * Displays a global error dialog for the given error and tracks the dialog close event for telemetry.
   *
   * @param error - An Error or any value to display; if an Error is provided it will be parsed for message, stack trace, and extension file.
   * @param options - Optional configuration for the dialog
   * @param options.title - Title used as the exception type shown in the dialog
   * @param options.reportType - Optional report type forwarded to the dialog for reporting purposes
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

  function showManagerProgressDialog(options?: {
    props?: InstanceType<typeof ManagerProgressDialogContent>['$props']
  }) {
    return dialogStore.showDialog({
      key: 'global-manager-progress-dialog',
      component: ManagerProgressDialogContent,
      headerComponent: ManagerProgressHeader,
      footerComponent: ManagerProgressFooter,
      props: options?.props,
      priority: 2,
      dialogComponentProps: {
        closable: false,
        modal: false,
        position: 'bottom',
        pt: {
          root: { class: 'w-[80%] max-w-2xl mx-auto border-none' },
          content: { class: 'p-0!' },
          header: { class: 'p-0! border-none' },
          footer: { class: 'p-0! border-none' }
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
      headerComponent: ComfyOrgHeader,
      props: options,
      dialogComponentProps: {
        pt: {
          header: { class: 'p-3!' }
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
   * Show a dialog provided by a third-party extension.
   *
   * @param options - Dialog configuration including `key`, optional `title`, header/footer components, dialog `component`, and `props` passed to the component.
   * @returns An object with `dialog`, the dialog instance returned by the dialog store, and `closeDialog`, a function that closes the dialog using the provided `key`.
   */
  function showExtensionDialog(options: ShowDialogOptions & { key: string }) {
    return {
      dialog: dialogStore.showExtensionDialog(options),
      closeDialog: () => dialogStore.closeDialog({ key: options.key })
    }
  }

  /**
   * Toggles the global manager dialog's visibility.
   *
   * If the global manager dialog is open, it will be closed; otherwise it will be shown.
   *
   * @param props - Optional props to pass to the ManagerDialogContent when opening the dialog
   */
  function toggleManagerDialog(
    props?: ComponentAttrs<typeof ManagerDialogContent>
  ) {
    if (dialogStore.isDialogOpen('global-manager')) {
      dialogStore.closeDialog({ key: 'global-manager' })
    } else {
      showManagerDialog(props)
    }
  }

  /**
   * Toggles the global manager progress dialog: closes it if open, otherwise opens it.
   *
   * @param props - Optional props to pass to the ManagerProgressDialogContent when opening the dialog
   */
  function toggleManagerProgressDialog(
    props?: ComponentAttrs<typeof ManagerProgressDialogContent>
  ) {
    if (dialogStore.isDialogOpen('global-manager-progress-dialog')) {
      dialogStore.closeDialog({ key: 'global-manager-progress-dialog' })
    } else {
      showManagerProgressDialog({ props })
    }
  }

  function showLayoutDialog(options: {
    key: string
    component: Component
    props: { onClose: () => void }
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

    const { useSubscriptionDialog } = await import(
      '@/platform/cloud/subscription/composables/useSubscriptionDialog'
    )
    const { show } = useSubscriptionDialog()
    show()
  }

  return {
    showLoadWorkflowWarning,
    showMissingModelsWarning,
    showSettingsDialog,
    showAboutDialog,
    showExecutionErrorDialog,
    showManagerDialog,
    showManagerProgressDialog,
    showApiNodesSignInDialog,
    showSignInDialog,
    showSubscriptionRequiredDialog,
    showTopUpCreditsDialog,
    showUpdatePasswordDialog,
    showExtensionDialog,
    prompt,
    showErrorDialog,
    confirm,
    toggleManagerDialog,
    toggleManagerProgressDialog,
    showLayoutDialog,
    showNodeConflictDialog
  }
}
