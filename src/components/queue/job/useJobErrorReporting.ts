import { computed } from 'vue'
import type { ComputedRef } from 'vue'

import type { ExecutionErrorDialogInput } from '@/services/dialogService'
import type { TaskItemImpl } from '@/stores/queueStore'

type CopyHandler = (value: string) => void | Promise<void>

export type JobErrorDialogService = {
  showExecutionErrorDialog: (executionError: ExecutionErrorDialogInput) => void
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

export function useJobErrorReporting({
  taskForJob,
  copyToClipboard,
  dialog
}: UseJobErrorReportingOptions) {
  const errorMessageValue = computed(() => taskForJob.value?.errorMessage ?? '')

  function copyErrorMessage() {
    if (errorMessageValue.value) {
      void copyToClipboard(errorMessageValue.value)
    }
  }

  function reportJobError() {
    const executionError = taskForJob.value?.executionError
    if (executionError) {
      dialog.showExecutionErrorDialog(executionError)
      return
    }

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
