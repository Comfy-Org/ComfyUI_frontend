import { computed } from 'vue'
import type { ComputedRef } from 'vue'

import type { ExecutionErrorWsMessage } from '@/schemas/apiSchema'
import type { TaskItemImpl } from '@/stores/queueStore'

type CopyHandler = (value: string) => void | Promise<void>

export type JobErrorDialogService = {
  showExecutionErrorDialog: (error: ExecutionErrorWsMessage) => void
  showErrorDialog: (
    error: Error,
    options?: {
      reportType?: string
      [key: string]: unknown
    }
  ) => void
}

type JobExecutionError = {
  detail?: ExecutionErrorWsMessage
  message: string
}

export const extractExecutionError = (
  task: TaskItemImpl | null
): JobExecutionError | null => {
  const status = (task as TaskItemImpl | null)?.status
  const messages = (status as { messages?: unknown[] } | undefined)?.messages
  if (!Array.isArray(messages) || !messages.length) return null
  const record = messages.find((entry: unknown) => {
    return Array.isArray(entry) && entry[0] === 'execution_error'
  }) as [string, ExecutionErrorWsMessage?] | undefined
  if (!record) return null
  const detail = record[1]
  const message = String(detail?.exception_message ?? '')
  return {
    detail,
    message
  }
}

export type UseJobErrorReportingOptions = {
  taskForJob: ComputedRef<TaskItemImpl | null>
  copyToClipboard: CopyHandler
  dialog: JobErrorDialogService
}

export const useJobErrorReporting = ({
  taskForJob,
  copyToClipboard,
  dialog
}: UseJobErrorReportingOptions) => {
  const errorMessageValue = computed(() => {
    const error = extractExecutionError(taskForJob.value)
    return error?.message ?? ''
  })

  const copyErrorMessage = () => {
    if (errorMessageValue.value) {
      void copyToClipboard(errorMessageValue.value)
    }
  }

  const reportJobError = () => {
    const error = extractExecutionError(taskForJob.value)
    if (error?.detail) {
      dialog.showExecutionErrorDialog(error.detail)
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
