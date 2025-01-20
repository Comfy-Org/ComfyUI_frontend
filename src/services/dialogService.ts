import ConfirmationDialogContent from '@/components/dialog/content/ConfirmationDialogContent.vue'
import ExecutionErrorDialogContent from '@/components/dialog/content/ExecutionErrorDialogContent.vue'
import IssueReportDialogContent from '@/components/dialog/content/IssueReportDialogContent.vue'
import LoadWorkflowWarning from '@/components/dialog/content/LoadWorkflowWarning.vue'
import MissingModelsWarning from '@/components/dialog/content/MissingModelsWarning.vue'
import PromptDialogContent from '@/components/dialog/content/PromptDialogContent.vue'
import SettingDialogContent from '@/components/dialog/content/SettingDialogContent.vue'
import SettingDialogHeader from '@/components/dialog/header/SettingDialogHeader.vue'
import TemplateWorkflowsContent from '@/components/templates/TemplateWorkflowsContent.vue'
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
    itemList = []
  }: {
    /** Dialog heading */
    title: string
    /** The main message body */
    message: string
    /** Pre-configured dialog type */
    type?: ConfirmationDialogType
    /** Displayed as an unorderd list immediately below the message body */
    itemList?: string[]
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
          onConfirm: resolve
        },
        dialogComponentProps: {
          onClose: () => resolve(null)
        }
      }

      dialogStore.showDialog(options)
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
    prompt,
    confirm
  }
}
