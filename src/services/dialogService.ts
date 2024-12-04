// This module is mocked in tests-ui/
// Import vue components here to avoid tests-ui/ reporting errors
// about importing primevue components.
import { useDialogStore, type ShowDialogOptions } from '@/stores/dialogStore'
import LoadWorkflowWarning from '@/components/dialog/content/LoadWorkflowWarning.vue'
import MissingModelsWarning from '@/components/dialog/content/MissingModelsWarning.vue'
import SettingDialogContent from '@/components/dialog/content/SettingDialogContent.vue'
import SettingDialogHeader from '@/components/dialog/header/SettingDialogHeader.vue'
import type { ExecutionErrorWsMessage } from '@/types/apiTypes'
import ExecutionErrorDialogContent from '@/components/dialog/content/ExecutionErrorDialogContent.vue'
import TemplateWorkflowsContent from '@/components/templates/TemplateWorkflowsContent.vue'
import PromptDialogContent from '@/components/dialog/content/PromptDialogContent.vue'
import ConfirmationDialogContent from '@/components/dialog/content/ConfirmationDialogContent.vue'
import { i18n } from '@/i18n'
import type { MissingNodeType } from '@/types/comfy'

export function showLoadWorkflowWarning(props: {
  missingNodeTypes: MissingNodeType[]
  [key: string]: any
}) {
  const dialogStore = useDialogStore()
  dialogStore.showDialog({
    key: 'global-load-workflow-warning',
    component: LoadWorkflowWarning,
    props
  })
}

export function showMissingModelsWarning(props: {
  missingModels: any[]
  paths: Record<string, string[]>
  [key: string]: any
}) {
  const dialogStore = useDialogStore()
  dialogStore.showDialog({
    key: 'global-missing-models-warning',
    component: MissingModelsWarning,
    props
  })
}

export function showSettingsDialog() {
  useDialogStore().showDialog({
    key: 'global-settings',
    headerComponent: SettingDialogHeader,
    component: SettingDialogContent
  })
}

export function showExecutionErrorDialog(error: ExecutionErrorWsMessage) {
  useDialogStore().showDialog({
    key: 'global-execution-error',
    component: ExecutionErrorDialogContent,
    props: {
      error
    }
  })
}

export function showTemplateWorkflowsDialog() {
  useDialogStore().showDialog({
    key: 'global-template-workflows',
    title: i18n.global.t('templateWorkflows.title'),
    component: TemplateWorkflowsContent
  })
}

export async function showPromptDialog({
  title,
  message,
  defaultValue = ''
}: {
  title: string
  message: string
  defaultValue?: string
}): Promise<string | null> {
  const dialogStore = useDialogStore()

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
 *
 * @returns `true` if the user confirms the dialog,
 * `false` if denied (e.g. no in yes/no/cancel), or
 * `null` if the dialog is cancelled or closed
 */
export async function showConfirmationDialog({
  title,
  type,
  message,
  itemList = []
}: {
  /** Dialog heading */
  title: string
  /** Pre-configured dialog type */
  type: 'overwrite' | 'delete' | 'dirtyClose'
  /** The main message body */
  message: string
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

    useDialogStore().showDialog(options)
  })
}
