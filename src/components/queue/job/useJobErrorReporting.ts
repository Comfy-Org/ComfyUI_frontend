import { computed } from 'vue'
import type { ComputedRef } from 'vue'

import type { ExecutionErrorWsMessage } from '@/schemas/apiSchema'
import type { TaskItemImpl } from '@/stores/queueStore'

type CopyHandler = (value: string) => void | Promise<void>

export type JobErrorDialogService = {
  showExecutionErrorDialog: (executionError: ExecutionErrorWsMessage) => void
  showErrorDialog: (
    error: Error,
    options?: {
      reportType?: string
      [key: string]: unknown
    }
  ) => void
}

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
  const errorMessageValue = computed(() => taskForJob.value?.errorMessage ?? '')

  const copyErrorMessage = () => {
    if (errorMessageValue.value) {
      void copyToClipboard(errorMessageValue.value)
    }
  }

  const reportJobError = () => {
    const task = taskForJob.value

    // Use execution_error from list response if available (includes prompt_id, timestamp)
    const executionError = task?.executionError
    if (executionError) {
      dialog.showExecutionErrorDialog(executionError as ExecutionErrorWsMessage)
      return
    }

    // Fall back to simple error dialog
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
