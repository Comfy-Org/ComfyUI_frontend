import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import type { ComputedRef } from 'vue'

import type { TaskItemImpl } from '@/stores/queueStore'
import type { JobErrorDialogService } from '@/components/queue/job/useJobErrorReporting'
import { useJobErrorReporting } from '@/components/queue/job/useJobErrorReporting'

const fetchJobDetailMock = vi.fn()
vi.mock('@/platform/remote/comfyui/jobs', () => ({
  fetchJobDetail: (...args: unknown[]) => fetchJobDetailMock(...args)
}))

const createTaskWithError = (
  promptId: string,
  errorMessage?: string
): TaskItemImpl => ({ promptId, errorMessage }) as unknown as TaskItemImpl

describe('useJobErrorReporting', () => {
  let taskState = ref<TaskItemImpl | null>(null)
  let taskForJob: ComputedRef<TaskItemImpl | null>
  let copyToClipboard: ReturnType<typeof vi.fn>
  let showErrorDialog: ReturnType<typeof vi.fn>
  let showExecutionErrorDialog: ReturnType<typeof vi.fn>
  let dialog: JobErrorDialogService
  let composable: ReturnType<typeof useJobErrorReporting>

  beforeEach(() => {
    vi.clearAllMocks()
    taskState = ref<TaskItemImpl | null>(null)
    taskForJob = computed(() => taskState.value)
    copyToClipboard = vi.fn()
    showErrorDialog = vi.fn()
    showExecutionErrorDialog = vi.fn()
    dialog = { showErrorDialog, showExecutionErrorDialog }
    fetchJobDetailMock.mockResolvedValue(undefined)
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
    taskState.value = createTaskWithError('job-1', 'First failure')
    expect(composable.errorMessageValue.value).toBe('First failure')

    taskState.value = createTaskWithError('job-2', 'Second failure')
    expect(composable.errorMessageValue.value).toBe('Second failure')
  })

  it('returns empty string when no error message', () => {
    taskState.value = createTaskWithError('job-1')
    expect(composable.errorMessageValue.value).toBe('')
  })

  it('only calls the copy handler when a message exists', () => {
    taskState.value = createTaskWithError('job-1', 'Clipboard failure')
    composable.copyErrorMessage()
    expect(copyToClipboard).toHaveBeenCalledTimes(1)
    expect(copyToClipboard).toHaveBeenCalledWith('Clipboard failure')

    copyToClipboard.mockClear()
    taskState.value = createTaskWithError('job-2')
    composable.copyErrorMessage()
    expect(copyToClipboard).not.toHaveBeenCalled()
  })

  it('shows simple error dialog when no fetchApi provided', async () => {
    taskState.value = createTaskWithError('job-1', 'Queue job error')
    await composable.reportJobError()

    expect(fetchJobDetailMock).not.toHaveBeenCalled()
    expect(showErrorDialog).toHaveBeenCalledTimes(1)
    const [errorArg, optionsArg] = showErrorDialog.mock.calls[0]
    expect(errorArg).toBeInstanceOf(Error)
    expect(errorArg.message).toBe('Queue job error')
    expect(optionsArg).toEqual({ reportType: 'queueJobError' })
  })

  it('does nothing when no task exists', async () => {
    taskState.value = null
    await composable.reportJobError()
    expect(showErrorDialog).not.toHaveBeenCalled()
    expect(showExecutionErrorDialog).not.toHaveBeenCalled()
  })

  describe('with fetchApi provided', () => {
    let fetchApi: ReturnType<typeof vi.fn>

    beforeEach(() => {
      fetchApi = vi.fn()
      composable = useJobErrorReporting({
        taskForJob,
        copyToClipboard,
        dialog,
        fetchApi
      })
    })

    it('shows rich error dialog when execution_error available', async () => {
      const executionError = {
        node_id: '5',
        node_type: 'KSampler',
        executed: ['1', '2'],
        exception_message: 'CUDA out of memory',
        exception_type: 'RuntimeError',
        traceback: ['line 1', 'line 2'],
        current_inputs: {},
        current_outputs: {}
      }
      fetchJobDetailMock.mockResolvedValue({
        id: 'job-1',
        create_time: 12345,
        execution_error: executionError
      })
      taskState.value = createTaskWithError('job-1', 'CUDA out of memory')

      await composable.reportJobError()

      expect(fetchJobDetailMock).toHaveBeenCalledWith(fetchApi, 'job-1')
      expect(showExecutionErrorDialog).toHaveBeenCalledTimes(1)
      expect(showExecutionErrorDialog).toHaveBeenCalledWith({
        prompt_id: 'job-1',
        timestamp: 12345,
        ...executionError
      })
      expect(showErrorDialog).not.toHaveBeenCalled()
    })

    it('falls back to simple error dialog when no execution_error', async () => {
      fetchJobDetailMock.mockResolvedValue({
        id: 'job-1',
        execution_error: null
      })
      taskState.value = createTaskWithError('job-1', 'Job failed')

      await composable.reportJobError()

      expect(fetchJobDetailMock).toHaveBeenCalledWith(fetchApi, 'job-1')
      expect(showExecutionErrorDialog).not.toHaveBeenCalled()
      expect(showErrorDialog).toHaveBeenCalledTimes(1)
      const [errorArg, optionsArg] = showErrorDialog.mock.calls[0]
      expect(errorArg).toBeInstanceOf(Error)
      expect(errorArg.message).toBe('Job failed')
      expect(optionsArg).toEqual({ reportType: 'queueJobError' })
    })

    it('falls back to simple error dialog when fetch fails', async () => {
      fetchJobDetailMock.mockResolvedValue(undefined)
      taskState.value = createTaskWithError('job-1', 'Job failed')

      await composable.reportJobError()

      expect(showExecutionErrorDialog).not.toHaveBeenCalled()
      expect(showErrorDialog).toHaveBeenCalledTimes(1)
    })

    it('does nothing when no error message and no execution_error', async () => {
      fetchJobDetailMock.mockResolvedValue({
        id: 'job-1',
        execution_error: null
      })
      taskState.value = createTaskWithError('job-1')

      await composable.reportJobError()

      expect(showErrorDialog).not.toHaveBeenCalled()
      expect(showExecutionErrorDialog).not.toHaveBeenCalled()
    })
  })
})
