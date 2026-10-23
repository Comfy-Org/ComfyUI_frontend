import { useEventListener } from '@vueuse/core'
import type { TextareaHTMLAttributes } from 'vue'

import { t } from '@/i18n'
import { useTelemetry } from '@/platform/telemetry'
import type {
  PromptEditorClosedMetadata,
  PromptEditorOpenedMetadata,
  PromptEditorSurfaceVariant
} from '@/platform/telemetry/types'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import TextEditorDialogContent from '@/renderer/extensions/textEditor/components/TextEditorDialogContent.vue'
import TextEditorDialogHeader from '@/renderer/extensions/textEditor/components/TextEditorDialogHeader.vue'
import { usePromptEditorExperimentStore } from '@/renderer/extensions/textEditor/promptEditorExperimentStore'
import { TEXT_EDITOR_DIALOG_KEY } from '@/renderer/extensions/textEditor/textEditorDialogKey'
import { useDialogStore } from '@/stores/dialogStore'

function experimentArmOf(
  trigger: PromptEditorOpenedMetadata['trigger']
): PromptEditorSurfaceVariant {
  return trigger === 'focus_view' ? 'panel' : 'control'
}

interface TextEditorOptions {
  readText: () => string
  widgetLabel: string
  nodeTitle?: string
  readOnly: () => boolean
  trigger?: PromptEditorOpenedMetadata['trigger']
  maximized?: boolean
  onEdit: (text: string) => void
  textareaAttributes?: () => TextareaHTMLAttributes
}

export function showTextEditor({
  readText,
  widgetLabel,
  nodeTitle,
  readOnly,
  trigger = 'expand_button',
  maximized = false,
  onEdit,
  textareaAttributes
}: TextEditorOptions): () => void {
  const dialogStore = useDialogStore()
  dialogStore.closeDialog({ key: TEXT_EDITOR_DIALOG_KEY })

  let isOpen = true
  let inputCount = 0
  let hasReportedEnd = false
  const openedAt = performance.now()
  const openedMetadata: PromptEditorOpenedMetadata = {
    surface: 'dialog',
    trigger,
    ...usePromptEditorExperimentStore().experimentPropertiesFor(
      experimentArmOf(trigger)
    )
  }
  useTelemetry()?.trackPromptEditorOpened(openedMetadata)

  function reportEnd(endReason: PromptEditorClosedMetadata['end_reason']) {
    if (hasReportedEnd) return
    hasReportedEnd = true
    useTelemetry()?.trackPromptEditorClosed({
      ...openedMetadata,
      end_reason: endReason,
      duration_ms: Math.round(performance.now() - openedAt),
      input_count: inputCount,
      node_switch_count: 0
    })
  }
  const stopPageHideReport = useEventListener(window, 'pagehide', () =>
    reportEnd('pagehide')
  )

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
      attributes: textareaAttributes,
      onEdit: (value: string) => {
        inputCount++
        onEdit(value)
        useWorkflowStore().activeWorkflow?.changeTracker.markModified()
      }
    },
    dialogComponentProps: {
      size: 'lg',
      flush: true,
      maximizable: true,
      maximized,
      onRemoved: () => {
        isOpen = false
        stopPageHideReport()
        reportEnd('close')
        if (inputCount > 0) {
          const changeTracker = useWorkflowStore().activeWorkflow?.changeTracker
          changeTracker?.captureCanvasState()
          changeTracker?.updateModified()
        }
      }
    }
  })

  return () => {
    if (isOpen) dialogStore.closeDialog({ key: TEXT_EDITOR_DIALOG_KEY })
  }
}
