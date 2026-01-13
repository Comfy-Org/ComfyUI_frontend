import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import type { ComputedRef } from 'vue'

import type { ExecutionErrorWsMessage, TaskStatus } from '@/schemas/apiSchema'
import { TaskItemImpl } from '@/stores/queueStore'
import type { JobErrorDialogService } from '@/components/queue/job/useJobErrorReporting'
import { useJobErrorReporting } from '@/components/queue/job/useJobErrorReporting'

const createExecutionErrorMessage = (
  overrides: Partial<ExecutionErrorWsMessage> = {}
): ExecutionErrorWsMessage => ({
  prompt_id: 'prompt',
  timestamp: 100,
  node_id: 'node-1',
  node_type: 'KSampler',
  executed: [],
  exception_message: 'default failure',
  exception_type: 'RuntimeError',
  traceback: ['Trace line'],
  current_inputs: {},
  current_outputs: {},
  ...overrides
})

/**
 * Creates a real TaskItemImpl with the given status messages.
 * Uses the actual TaskItemImpl class to test the real errorMessage/executionError getters.
 */
function createTaskWithMessages(
  messages: TaskStatus['messages'] = []
): TaskItemImpl {
  const status: TaskStatus = {
    status_str: 'error',
    completed: false,
    messages
  }
  return new TaskItemImpl(
    'History',
    [0, 'test-prompt-id', {}, { client_id: 'test-client' }, []],
    status
  )
}

describe('useJobErrorReporting', () => {
  let taskState = ref<TaskItemImpl | null>(null)
  let taskForJob: ComputedRef<TaskItemImpl | null>
  let copyToClipboard: ReturnType<typeof vi.fn>
  let showExecutionErrorDialog: ReturnType<typeof vi.fn>
  let showErrorDialog: ReturnType<typeof vi.fn>
  let dialog: JobErrorDialogService
  let composable: ReturnType<typeof useJobErrorReporting>

  beforeEach(() => {
    taskState = ref<TaskItemImpl | null>(null)
    taskForJob = computed(() => taskState.value)
    copyToClipboard = vi.fn()
    showExecutionErrorDialog = vi.fn()
    showErrorDialog = vi.fn()
    dialog = {
      showExecutionErrorDialog,
      showErrorDialog
    } as unknown as JobErrorDialogService
    composable = useJobErrorReporting({
      taskForJob,
      copyToClipboard: copyToClipboard as (
        value: string
      ) => void | Promise<void>,
      dialog
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('exposes a computed message that reflects the current task error', () => {
    taskState.value = createTaskWithMessages([
      [
        'execution_error',
        createExecutionErrorMessage({ exception_message: 'First failure' })
      ]
    ])
    expect(composable.errorMessageValue.value).toBe('First failure')

    taskState.value = createTaskWithMessages([
      [
        'execution_error',
        createExecutionErrorMessage({ exception_message: 'Second failure' })
      ]
    ])
    expect(composable.errorMessageValue.value).toBe('Second failure')
  })

  it('returns empty string when task has no error', () => {
    taskState.value = null
    expect(composable.errorMessageValue.value).toBe('')

    taskState.value = createTaskWithMessages([])
    expect(composable.errorMessageValue.value).toBe('')
  })

  it('only calls the copy handler when a message exists', () => {
    taskState.value = createTaskWithMessages([
      [
        'execution_error',
        createExecutionErrorMessage({ exception_message: 'Clipboard failure' })
      ]
    ])
    composable.copyErrorMessage()
    expect(copyToClipboard).toHaveBeenCalledTimes(1)
    expect(copyToClipboard).toHaveBeenCalledWith('Clipboard failure')

    copyToClipboard.mockClear()
    taskState.value = createTaskWithMessages([])
    composable.copyErrorMessage()
    expect(copyToClipboard).not.toHaveBeenCalled()
  })

  it('prefers the detailed execution dialog when detail is available', () => {
    const detail = createExecutionErrorMessage({
      exception_message: 'Detailed failure'
    })
    taskState.value = createTaskWithMessages([['execution_error', detail]])
    composable.reportJobError()
    expect(showExecutionErrorDialog).toHaveBeenCalledTimes(1)
    expect(showExecutionErrorDialog).toHaveBeenCalledWith(detail)
    expect(showErrorDialog).not.toHaveBeenCalled()
  })

  it('shows a fallback dialog when only a message is available', () => {
    const message = 'Queue job error'
    taskState.value = createTaskWithMessages([])
    const valueSpy = vi
      .spyOn(composable.errorMessageValue, 'value', 'get')
      .mockReturnValue(message)

    expect(composable.errorMessageValue.value).toBe(message)
    composable.reportJobError()
    expect(showExecutionErrorDialog).not.toHaveBeenCalled()
    expect(showErrorDialog).toHaveBeenCalledTimes(1)
    const [errorArg, optionsArg] = showErrorDialog.mock.calls[0]
    expect(errorArg).toBeInstanceOf(Error)
    expect(errorArg.message).toBe(message)
    expect(optionsArg).toEqual({ reportType: 'queueJobError' })
    valueSpy.mockRestore()
  })

  it('does nothing when no error could be extracted', () => {
    taskState.value = createTaskWithMessages([])
    composable.reportJobError()
    expect(showExecutionErrorDialog).not.toHaveBeenCalled()
    expect(showErrorDialog).not.toHaveBeenCalled()
  })
})
