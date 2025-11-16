import { computed } from 'vue'
import type { ComputedRef } from 'vue'

import type { TaskItemImpl } from '@/stores/queueStore'

type CopyHandler = (value: string) => void | Promise<void>

export type JobErrorDialogService = {
  showErrorDialog: (
    error: Error,
    options?: {
      reportType?: string
      [key: string]: unknown
    }
  ) => void
}

/**
 * Extracts error message from a task.
 * Returns the simple error_message string from the jobs API.
 *
 * Note: Detailed execution errors (with traceback, node info, etc.) are only
 * available via WebSocket during live execution. Historical job errors only
 * have the simple error_message string.
 */
export const extractErrorMessage = (task: TaskItemImpl | null): string | null =>
  task?.errorMessage ?? null

type UseJobErrorReportingOptions = {
  taskForJob: ComputedRef<TaskItemImpl | null>
  copyToClipboard: CopyHandler
  dialog: JobErrorDialogService
}

export const useJobErrorReporting = ({
  taskForJob,
  copyToClipboard,
  dialog
}: UseJobErrorReportingOptions) => {
  const errorMessageValue = computed(
    () => extractErrorMessage(taskForJob.value) ?? ''
  )

  const copyErrorMessage = () => {
    if (errorMessageValue.value) {
      void copyToClipboard(errorMessageValue.value)
    }
  }

  const reportJobError = () => {
    if (errorMessageValue.value) {
      dialog.showErrorDialog(new Error(errorMessageValue.value), {
        reportType: 'queueJobError'
      })
    }
  }

  return {
    errorMessageValue,
    copyErrorMessage,
    reportJobError
  }
}
