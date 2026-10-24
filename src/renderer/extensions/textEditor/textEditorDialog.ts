import { useEventListener } from '@vueuse/core'

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
  isInExperiment?: boolean
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
  maximized = false,
  isInExperiment = true,
  onEdit
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
    ...(isInExperiment &&
      usePromptEditorExperimentStore().experimentPropertiesFor(
        experimentArmOf(trigger)
      ))
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
      onEdit: (value: string) => {
        inputCount++
        onEdit(value)
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
        if (inputCount > 0)
          useWorkflowStore().activeWorkflow?.changeTracker.captureCanvasState()
      }
    }
  })

  return () => {
    if (isOpen) dialogStore.closeDialog({ key: TEXT_EDITOR_DIALOG_KEY })
  }
}
