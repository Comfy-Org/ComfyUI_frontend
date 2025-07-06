import ApiNodesSignInContent from '@/components/dialog/content/ApiNodesSignInContent.vue'
import ConfirmationDialogContent from '@/components/dialog/content/ConfirmationDialogContent.vue'
import ErrorDialogContent from '@/components/dialog/content/ErrorDialogContent.vue'
import IssueReportDialogContent from '@/components/dialog/content/IssueReportDialogContent.vue'
import LoadWorkflowWarning from '@/components/dialog/content/LoadWorkflowWarning.vue'
import ManagerProgressDialogContent from '@/components/dialog/content/ManagerProgressDialogContent.vue'
import MissingModelsWarning from '@/components/dialog/content/MissingModelsWarning.vue'
import PromptDialogContent from '@/components/dialog/content/PromptDialogContent.vue'
import SettingDialogContent from '@/components/dialog/content/SettingDialogContent.vue'
import SignInContent from '@/components/dialog/content/SignInContent.vue'
import TopUpCreditsDialogContent from '@/components/dialog/content/TopUpCreditsDialogContent.vue'
import UpdatePasswordContent from '@/components/dialog/content/UpdatePasswordContent.vue'
import ManagerDialogContent from '@/components/dialog/content/manager/ManagerDialogContent.vue'
import ManagerHeader from '@/components/dialog/content/manager/ManagerHeader.vue'
import ManagerProgressFooter from '@/components/dialog/footer/ManagerProgressFooter.vue'
import ComfyOrgHeader from '@/components/dialog/header/ComfyOrgHeader.vue'
import ManagerProgressHeader from '@/components/dialog/header/ManagerProgressHeader.vue'
import SettingDialogHeader from '@/components/dialog/header/SettingDialogHeader.vue'
import TemplateWorkflowsContent from '@/components/templates/TemplateWorkflowsContent.vue'
import TemplateWorkflowsDialogHeader from '@/components/templates/TemplateWorkflowsDialogHeader.vue'
import { t } from '@/i18n'
import type { ExecutionErrorWsMessage } from '@/schemas/apiSchema'
import { type ShowDialogOptions, useDialogStore } from '@/stores/dialogStore'

export type ConfirmationDialogType =
  | 'default'
  | 'overwrite'
  | 'delete'
  | 'dirtyClose'
  | 'reinstall'

export const useDialogService = () => {
  const dialogStore = useDialogStore()
  function showLoadWorkflowWarning(
    props: InstanceType<typeof LoadWorkflowWarning>['$props']
  ) {
    dialogStore.showDialog({
      key: 'global-load-workflow-warning',
      component: LoadWorkflowWarning,
      props
    })
  }

  function showMissingModelsWarning(
    props: InstanceType<typeof MissingModelsWarning>['$props']
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

  function showExecutionErrorDialog(executionError: ExecutionErrorWsMessage) {
    const props: InstanceType<typeof ErrorDialogContent>['$props'] = {
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
      props
    })
  }

  function showTemplateWorkflowsDialog(
    props: InstanceType<typeof TemplateWorkflowsContent>['$props'] = {}
  ) {
    dialogStore.showDialog({
      key: 'global-template-workflows',
      title: t('templateWorkflows.title'),
      component: TemplateWorkflowsContent,
      headerComponent: TemplateWorkflowsDialogHeader,
      dialogComponentProps: {
        pt: {
          content: { class: '!px-0 overflow-y-hidden' }
        }
      },
      props
    })
  }

  function showIssueReportDialog(
    props: InstanceType<typeof IssueReportDialogContent>['$props']
  ) {
    dialogStore.showDialog({
      key: 'global-issue-report',
      component: IssueReportDialogContent,
      props
    })
  }

  function showManagerDialog(
    props: InstanceType<typeof ManagerDialogContent>['$props'] = {}
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
              class:
                'bg-gray-500 dark-theme:bg-neutral-700 w-9 h-9 p-1.5 rounded-full text-white'
            }
          },
          header: { class: '!py-0 px-6 !m-0 h-[68px]' },
          content: {
            class: '!p-0 h-full w-[90vw] max-w-full flex-1 overflow-hidden'
          },
          root: { class: 'manager-dialog' }
        }
      },
      props
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
          content: { class: '!p-0' },
          header: { class: '!p-0 border-none' },
          footer: { class: '!p-0 border-none' }
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

    const props: InstanceType<typeof ErrorDialogContent>['$props'] = {
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
      props
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
          closable: false,
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
    defaultValue = ''
  }: {
    title: string
    message: string
    defaultValue?: string
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
          }
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
    return dialogStore.showDialog({
      key: 'top-up-credits',
      component: TopUpCreditsDialogContent,
      headerComponent: ComfyOrgHeader,
      props: options,
      dialogComponentProps: {
        pt: {
          header: { class: '!p-3' }
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

  function toggleManagerDialog(
    props?: InstanceType<typeof ManagerDialogContent>['$props']
  ) {
    if (dialogStore.isDialogOpen('global-manager')) {
      dialogStore.closeDialog({ key: 'global-manager' })
    } else {
      showManagerDialog(props)
    }
  }

  function toggleManagerProgressDialog(
    props?: InstanceType<typeof ManagerProgressDialogContent>['$props']
  ) {
    if (dialogStore.isDialogOpen('global-manager-progress-dialog')) {
      dialogStore.closeDialog({ key: 'global-manager-progress-dialog' })
    } else {
      showManagerProgressDialog({ props })
    }
  }

  return {
    showLoadWorkflowWarning,
    showMissingModelsWarning,
    showSettingsDialog,
    showAboutDialog,
    showExecutionErrorDialog,
    showTemplateWorkflowsDialog,
    showIssueReportDialog,
    showManagerDialog,
    showManagerProgressDialog,
    showErrorDialog,
    showApiNodesSignInDialog,
    showSignInDialog,
    showTopUpCreditsDialog,
    showUpdatePasswordDialog,
    showExtensionDialog,
    prompt,
    confirm,
    toggleManagerDialog,
    toggleManagerProgressDialog
  }
}
