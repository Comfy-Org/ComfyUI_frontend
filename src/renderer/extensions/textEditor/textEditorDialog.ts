import { t } from '@/i18n'
import { useTelemetry } from '@/platform/telemetry'
import type { PromptEditorOpenedMetadata } from '@/platform/telemetry/types'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import TextEditorDialogContent from '@/renderer/extensions/textEditor/components/TextEditorDialogContent.vue'
import TextEditorDialogHeader from '@/renderer/extensions/textEditor/components/TextEditorDialogHeader.vue'
import { usePromptEditorExperimentStore } from '@/renderer/extensions/textEditor/promptEditorExperimentStore'
import { TEXT_EDITOR_DIALOG_KEY } from '@/renderer/extensions/textEditor/textEditorDialogKey'
import { useDialogStore } from '@/stores/dialogStore'

interface TextEditorOptions {
  readText: () => string
  widgetLabel: string
  nodeTitle?: string
  readOnly: () => boolean
  trigger?: PromptEditorOpenedMetadata['trigger']
  onEdit: (text: string) => void
}

/**
 * Opens the shared text editor dialog on the text `readText` returns, kept in
 * sync while it is open. Each edit goes to `onEdit`, and closing
 * after an edit records one undo step. Returns a close function that only
 * closes the dialog this call opened.
 */
export function showTextEditor({
  readText,
  widgetLabel,
  nodeTitle,
  readOnly,
  trigger = 'expand_button',
  onEdit
}: TextEditorOptions): () => void {
  const dialogStore = useDialogStore()
  dialogStore.closeDialog({ key: TEXT_EDITOR_DIALOG_KEY })

  let isOpen = true
  let inputCount = 0
  const openedAt = performance.now()
  const openedMetadata: PromptEditorOpenedMetadata = {
    surface: 'dialog',
    trigger,
    ...usePromptEditorExperimentStore().experimentProperties
  }
  useTelemetry()?.trackPromptEditorOpened(openedMetadata)

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
        inputCount++
        onEdit(value)
      }
    },
    dialogComponentProps: {
      size: 'lg',
      flush: true,
      maximizable: true,
      onRemoved: () => {
        isOpen = false
        if (inputCount > 0)
          useWorkflowStore().activeWorkflow?.changeTracker.captureCanvasState()
        useTelemetry()?.trackPromptEditorClosed({
          ...openedMetadata,
          duration_ms: Math.round(performance.now() - openedAt),
          input_count: inputCount,
          node_switch_count: 0
        })
      }
    }
  })

  return () => {
    if (isOpen) dialogStore.closeDialog({ key: TEXT_EDITOR_DIALOG_KEY })
  }
}
