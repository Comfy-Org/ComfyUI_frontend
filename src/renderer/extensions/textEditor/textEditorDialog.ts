import { t } from '@/i18n'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import TextEditorDialogContent from '@/renderer/extensions/textEditor/components/TextEditorDialogContent.vue'
import TextEditorDialogHeader from '@/renderer/extensions/textEditor/components/TextEditorDialogHeader.vue'
import { TEXT_EDITOR_DIALOG_KEY } from '@/renderer/extensions/textEditor/textEditorDialogKey'
import { useDialogStore } from '@/stores/dialogStore'

interface TextEditorOptions {
  readText: () => string
  widgetLabel: string
  nodeTitle?: string
  readOnly: () => boolean
  onEdit: (text: string) => void
}

export function showTextEditor({
  readText,
  widgetLabel,
  nodeTitle,
  readOnly,
  onEdit
}: TextEditorOptions): () => void {
  const dialogStore = useDialogStore()
  dialogStore.closeDialog({ key: TEXT_EDITOR_DIALOG_KEY })

  let isOpen = true
  let isEdited = false

  dialogStore.showDialog({
    key: TEXT_EDITOR_DIALOG_KEY,
    headerComponent: TextEditorDialogHeader,
    headerProps: {
      title: nodeTitle
        ? t('textEditor.title', { widget: widgetLabel, node: nodeTitle })
        : widgetLabel
    },
    component: TextEditorDialogContent,
    props: {
      readText,
      label: widgetLabel,
      readOnly,
      onEdit: (value: string) => {
        isEdited = true
        onEdit(value)
      }
    },
    dialogComponentProps: {
      size: 'lg',
      flush: true,
      maximizable: true,
      onRemoved: () => {
        isOpen = false
        if (isEdited)
          useWorkflowStore().activeWorkflow?.changeTracker.captureCanvasState()
      }
    }
  })

  return () => {
    if (isOpen) dialogStore.closeDialog({ key: TEXT_EDITOR_DIALOG_KEY })
  }
}
