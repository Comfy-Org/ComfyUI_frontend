import { computed } from 'vue'
import type { ComputedRef } from 'vue'

import { fetchJobDetail } from '@/platform/remote/comfyui/jobs'
import type { ExecutionErrorWsMessage } from '@/schemas/apiSchema'
import type { TaskItemImpl } from '@/stores/queueStore'

type CopyHandler = (value: string) => void | Promise<void>
type FetchApi = (url: string) => Promise<Response>

export type JobErrorDialogService = {
  showErrorDialog: (
    error: Error,
    options?: {
      reportType?: string
      [key: string]: unknown
    }
  ) => void
  showExecutionErrorDialog?: (executionError: ExecutionErrorWsMessage) => void
}

type UseJobErrorReportingOptions = {
  taskForJob: ComputedRef<TaskItemImpl | null>
  copyToClipboard: CopyHandler
  dialog: JobErrorDialogService
  /** Optional fetch function to enable rich error dialogs with traceback */
  fetchApi?: FetchApi
}

export const useJobErrorReporting = ({
  taskForJob,
  copyToClipboard,
  dialog,
  fetchApi
}: UseJobErrorReportingOptions) => {
  const errorMessageValue = computed(() => taskForJob.value?.errorMessage ?? '')

  const copyErrorMessage = () => {
    if (errorMessageValue.value) {
      void copyToClipboard(errorMessageValue.value)
    }
  }

  const reportJobError = async () => {
    const task = taskForJob.value
    if (!task) return

    // Try to fetch rich error details if fetchApi is provided
    if (fetchApi && dialog.showExecutionErrorDialog) {
      const jobDetail = await fetchJobDetail(fetchApi, task.promptId)
      const executionError = jobDetail?.execution_error

      if (executionError) {
        dialog.showExecutionErrorDialog({
          prompt_id: task.promptId,
          timestamp: jobDetail?.create_time ?? Date.now(),
          ...executionError
        })
        return
      }
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
