// This module is mocked in tests-ui/
// Import vue components here to avoid tests-ui/ reporting errors
// about importing primevue components.
import { useDialogStore } from '@/stores/dialogStore'
import LoadWorkflowWarning from '@/components/dialog/content/LoadWorkflowWarning.vue'
import MissingModelsWarning from '@/components/dialog/content/MissingModelsWarning.vue'
import SettingDialogContent from '@/components/dialog/content/SettingDialogContent.vue'
import SettingDialogHeader from '@/components/dialog/header/SettingDialogHeader.vue'
import type { ExecutionErrorWsMessage } from '@/types/apiTypes'
import ExecutionErrorDialogContent from '@/components/dialog/content/ExecutionErrorDialogContent.vue'
import TemplateWorkflowsContent from '@/components/templates/TemplateWorkflowsContent.vue'
import PromptDialogContent from '@/components/dialog/content/PromptDialogContent.vue'
import { i18n } from '@/i18n'
import type { MissingNodeType } from '@/types/comfy'

export function showLoadWorkflowWarning(props: {
  missingNodeTypes: MissingNodeType[]
  [key: string]: any
}) {
  const dialogStore = useDialogStore()
  dialogStore.showDialog({
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
    component: MissingModelsWarning,
    props
  })
}

export function showSettingsDialog() {
  useDialogStore().showDialog({
    headerComponent: SettingDialogHeader,
    component: SettingDialogContent
  })
}

export function showExecutionErrorDialog(error: ExecutionErrorWsMessage) {
  useDialogStore().showDialog({
    component: ExecutionErrorDialogContent,
    props: {
      error
    }
  })
}

export function showTemplateWorkflowsDialog() {
  useDialogStore().showDialog({
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
