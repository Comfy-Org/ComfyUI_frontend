import ConfirmationDialogContent from '@/components/dialog/content/ConfirmationDialogContent.vue'
import ExecutionErrorDialogContent from '@/components/dialog/content/ExecutionErrorDialogContent.vue'
import ImportModelDialogContent from '@/components/dialog/content/ImportModelDialogContent.vue'
import IssueReportDialogContent from '@/components/dialog/content/IssueReportDialogContent.vue'
import LoadWorkflowWarning from '@/components/dialog/content/LoadWorkflowWarning.vue'
import ManagerProgressDialogContent from '@/components/dialog/content/ManagerProgressDialogContent.vue'
import MissingModelsWarning from '@/components/dialog/content/MissingModelsWarning.vue'
import PromptDialogContent from '@/components/dialog/content/PromptDialogContent.vue'
import SettingDialogContent from '@/components/dialog/content/SettingDialogContent.vue'
import ManagerDialogContent from '@/components/dialog/content/manager/ManagerDialogContent.vue'
import ManagerHeader from '@/components/dialog/content/manager/ManagerHeader.vue'
import ManagerProgressFooter from '@/components/dialog/footer/ManagerProgressFooter.vue'
import ManagerProgressHeader from '@/components/dialog/header/ManagerProgressHeader.vue'
import SettingDialogHeader from '@/components/dialog/header/SettingDialogHeader.vue'
import TemplateWorkflowsContent from '@/components/templates/TemplateWorkflowsContent.vue'
import TemplateWorkflowsDialogHeader from '@/components/templates/TemplateWorkflowsDialogHeader.vue'
import { t } from '@/i18n'
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
    panel?: 'about' | 'keybinding' | 'extension' | 'server-config'
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

  function showExecutionErrorDialog(
    props: InstanceType<typeof ExecutionErrorDialogContent>['$props']
  ) {
    dialogStore.showDialog({
      key: 'global-execution-error',
      component: ExecutionErrorDialogContent,
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
        closable: false,
        pt: {
          header: { class: '!p-0 !m-0' },
          content: { class: '!px-0 h-[83vh] w-[90vw] overflow-y-hidden' }
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

  function showImportModelDialog(
    props: InstanceType<typeof ImportModelDialogContent>['$props']
  ) {
    dialogStore.showDialog({
      key: 'global-import-model',
      component: ImportModelDialogContent,
      props
    })
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
    showImportModelDialog,
    showManagerProgressDialog,
    prompt,
    confirm
  }
}
