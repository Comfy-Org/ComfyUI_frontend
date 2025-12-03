import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import type { ComputedRef } from 'vue'

import type { TaskItemImpl } from '@/stores/queueStore'
import type { JobErrorDialogService } from '@/components/queue/job/useJobErrorReporting'
import { useJobErrorReporting } from '@/components/queue/job/useJobErrorReporting'

const createTaskWithError = (errorMessage?: string): TaskItemImpl =>
  ({ errorMessage }) as unknown as TaskItemImpl

describe('useJobErrorReporting', () => {
  let taskState = ref<TaskItemImpl | null>(null)
  let taskForJob: ComputedRef<TaskItemImpl | null>
  let copyToClipboard: ReturnType<typeof vi.fn>
  let showErrorDialog: ReturnType<typeof vi.fn>
  let dialog: JobErrorDialogService
  let composable: ReturnType<typeof useJobErrorReporting>

  beforeEach(() => {
    taskState = ref<TaskItemImpl | null>(null)
    taskForJob = computed(() => taskState.value)
    copyToClipboard = vi.fn()
    showErrorDialog = vi.fn()
    dialog = { showErrorDialog }
    composable = useJobErrorReporting({
      taskForJob,
      copyToClipboard,
      dialog
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('exposes a computed message that reflects the current task error', () => {
    taskState.value = createTaskWithError('First failure')
    expect(composable.errorMessageValue.value).toBe('First failure')

    taskState.value = createTaskWithError('Second failure')
    expect(composable.errorMessageValue.value).toBe('Second failure')
  })

  it('returns empty string when no error message', () => {
    taskState.value = createTaskWithError()
    expect(composable.errorMessageValue.value).toBe('')
  })

  it('only calls the copy handler when a message exists', () => {
    taskState.value = createTaskWithError('Clipboard failure')
    composable.copyErrorMessage()
    expect(copyToClipboard).toHaveBeenCalledTimes(1)
    expect(copyToClipboard).toHaveBeenCalledWith('Clipboard failure')

    copyToClipboard.mockClear()
    taskState.value = createTaskWithError()
    composable.copyErrorMessage()
    expect(copyToClipboard).not.toHaveBeenCalled()
  })

  it('shows error dialog with the error message', () => {
    taskState.value = createTaskWithError('Queue job error')
    composable.reportJobError()

    expect(showErrorDialog).toHaveBeenCalledTimes(1)
    const [errorArg, optionsArg] = showErrorDialog.mock.calls[0]
    expect(errorArg).toBeInstanceOf(Error)
    expect(errorArg.message).toBe('Queue job error')
    expect(optionsArg).toEqual({ reportType: 'queueJobError' })
  })

  it('does nothing when no error message exists', () => {
    taskState.value = createTaskWithError()
    composable.reportJobError()
    expect(showErrorDialog).not.toHaveBeenCalled()
  })
})
